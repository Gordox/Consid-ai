import { DatabaseStateError, type SessionDatabase } from './database';

// Settings are stored in their own columns as a historical copy of the session setup.
// CHECK limits mirror the domain limits at the time of this migration; see PLAN.md for
// how later rule changes must be handled without editing this migration.
const MIGRATION_1_CREATE_SESSIONS = `CREATE TABLE sessions (
  id TEXT PRIMARY KEY NOT NULL,
  created_at_utc TEXT NOT NULL,
  created_time_zone TEXT NOT NULL CHECK (length(created_time_zone) > 0),
  firearm_name TEXT NOT NULL CHECK (length(firearm_name) BETWEEN 1 AND 100),
  firearm_type TEXT NOT NULL CHECK (firearm_type IN ('pistol','revolver','rifle','other')),
  calibre_label TEXT NOT NULL CHECK (length(calibre_label) BETWEEN 1 AND 50),
  distance_m REAL NOT NULL CHECK (distance_m BETWEEN 0.1 AND 1000),
  planned_shots_per_round INTEGER NOT NULL CHECK (planned_shots_per_round BETWEEN 1 AND 100),
  planned_rounds INTEGER CHECK (planned_rounds IS NULL OR planned_rounds BETWEEN 1 AND 100)
) STRICT;
CREATE INDEX sessions_created_at_idx ON sessions (created_at_utc DESC, id DESC);`;

// Rounds, photos, marks and analysis attempts. Only adds: existing sessions keep their rows and
// become in-progress sessions (finished_at_utc NULL). Confirmed rounds keep a fixed result
// snapshot in confirmed_json plus summary columns for lists. JSON columns are validated when read.
const MIGRATION_2_ADD_ROUNDS = `ALTER TABLE sessions ADD COLUMN finished_at_utc TEXT;
CREATE TABLE rounds (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES sessions (id),
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  state TEXT NOT NULL CHECK (state IN ('draft','confirmed')),
  created_at_utc TEXT NOT NULL,
  actual_shots INTEGER NOT NULL CHECK (actual_shots BETWEEN 0 AND 100),
  declared_misses INTEGER NOT NULL CHECK (declared_misses BETWEEN 0 AND 100),
  unresolved_shots INTEGER NOT NULL CHECK (unresolved_shots BETWEEN 0 AND 100),
  target_id TEXT NOT NULL,
  hit_diameter_mm REAL NOT NULL CHECK (hit_diameter_mm BETWEEN 1 AND 30),
  calibration_json TEXT,
  confirmed_at_utc TEXT,
  confirmed_json TEXT,
  confirmed_subtotal INTEGER,
  confirmed_complete INTEGER CHECK (confirmed_complete IS NULL OR confirmed_complete IN (0,1)),
  UNIQUE (session_id, sequence)
) STRICT;
CREATE INDEX rounds_session_idx ON rounds (session_id, sequence);
CREATE TABLE round_photos (
  round_id TEXT NOT NULL REFERENCES rounds (id),
  role TEXT NOT NULL CHECK (role IN ('before','after')),
  file_name TEXT NOT NULL,
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  added_at_utc TEXT NOT NULL,
  PRIMARY KEY (round_id, role)
) STRICT;
CREATE TABLE round_marks (
  id TEXT PRIMARY KEY NOT NULL,
  round_id TEXT NOT NULL REFERENCES rounds (id),
  ordinal INTEGER NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  shots INTEGER NOT NULL CHECK (shots BETWEEN 1 AND 10),
  source TEXT NOT NULL CHECK (source IN ('manual','suggested','suggestedEdited')),
  uncertain INTEGER NOT NULL CHECK (uncertain IN (0,1)),
  candidate_id TEXT
) STRICT;
CREATE INDEX round_marks_round_idx ON round_marks (round_id, ordinal);
CREATE TABLE analysis_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  round_id TEXT NOT NULL REFERENCES rounds (id),
  created_at_utc TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('service','demo')),
  status TEXT NOT NULL CHECK (status IN ('pending','succeeded','failed')),
  algorithm_version TEXT,
  error_code TEXT,
  result_json TEXT
) STRICT;
CREATE INDEX analysis_attempts_round_idx ON analysis_attempts (round_id, created_at_utc);`;

// Append only: index + 1 is the schema version. Never edit or reorder a shipped entry.
export const MIGRATIONS: readonly string[] = [MIGRATION_1_CREATE_SESSIONS, MIGRATION_2_ADD_ROUNDS];

export const LATEST_SCHEMA_VERSION = MIGRATIONS.length;

export class DatabaseVersionTooNewError extends Error {
  constructor(
    readonly databaseVersion: number,
    readonly supportedVersion: number,
  ) {
    super(
      `Database schema version ${databaseVersion} is newer than the supported version ${supportedVersion}`,
    );
    this.name = 'DatabaseVersionTooNewError';
  }
}

export class JournalModeError extends Error {
  constructor(readonly journalMode: string) {
    super(`Expected WAL journal mode, got ${journalMode}`);
    this.name = 'JournalModeError';
  }
}

export class MigrationFailedError extends Error {
  constructor(
    readonly version: number,
    cause: unknown,
  ) {
    super(`Migration to schema version ${version} failed`);
    this.name = 'MigrationFailedError';
    this.cause = cause;
  }
}

function readPragmaValue(row: unknown, key: string): unknown {
  return typeof row === 'object' && row !== null && Object.prototype.hasOwnProperty.call(row, key)
    ? Reflect.get(row, key)
    : undefined;
}

async function readUserVersion(db: SessionDatabase): Promise<number> {
  const version = readPragmaValue(
    await db.getFirstAsync('PRAGMA user_version', []),
    'user_version',
  );
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    throw new DatabaseStateError('PRAGMA user_version did not return a non-negative integer');
  }
  return version;
}

// Must run outside a transaction: SQLite cannot change the journal mode inside one.
// WAL is stored in the database file, so it also applies to the transaction connection.
async function enableWriteAheadLog(db: SessionDatabase): Promise<void> {
  const mode = readPragmaValue(
    await db.getFirstAsync('PRAGMA journal_mode = WAL', []),
    'journal_mode',
  );
  if (typeof mode !== 'string') {
    throw new DatabaseStateError('PRAGMA journal_mode did not return a string');
  }
  if (mode !== 'wal') {
    throw new JournalModeError(mode);
  }
}

// Order: check the version before any write (a newer database is left untouched),
// enable WAL, then apply each pending migration atomically together with its version bump.
export async function migrateDatabase(
  db: SessionDatabase,
  migrations: readonly string[] = MIGRATIONS,
): Promise<void> {
  const currentVersion = await readUserVersion(db);
  if (currentVersion > migrations.length) {
    throw new DatabaseVersionTooNewError(currentVersion, migrations.length);
  }

  await enableWriteAheadLog(db);

  for (let version = currentVersion + 1; version <= migrations.length; version += 1) {
    const sql = migrations[version - 1];
    if (sql === undefined) {
      throw new DatabaseStateError(`Migration ${version} is missing`);
    }
    try {
      // All statements must use txn: the exclusive transaction runs on its own connection.
      await db.withExclusiveTransactionAsync(async (txn) => {
        const versionInTransaction = await readUserVersion(txn);
        if (versionInTransaction >= version) {
          return; // Another initialization applied this migration first.
        }
        if (versionInTransaction !== version - 1) {
          throw new DatabaseStateError(
            `Expected schema version ${version - 1} before migration ${version}, found ${versionInTransaction}`,
          );
        }
        await txn.execAsync(sql);
        // version is an internal integer, never user input.
        await txn.execAsync(`PRAGMA user_version = ${version}`);
      });
    } catch (error) {
      throw new MigrationFailedError(version, error);
    }
  }
}
