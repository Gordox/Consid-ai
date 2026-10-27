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

// Append only: index + 1 is the schema version. Never edit or reorder a shipped entry.
export const MIGRATIONS: readonly string[] = [MIGRATION_1_CREATE_SESSIONS];

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
