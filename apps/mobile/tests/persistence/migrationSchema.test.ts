import { FIREARM_TYPES } from '../../src/domain/session/firearmType';
import {
  CALIBRE_LABEL_MAX_CODE_POINTS,
  DISTANCE_TENTHS_RANGE,
  FIREARM_NAME_MAX_CODE_POINTS,
  PLANNED_ROUNDS_RANGE,
  PLANNED_SHOTS_PER_ROUND_RANGE,
} from '../../src/domain/session/sessionLimits';
import {
  ACTUAL_SHOTS_RANGE,
  HIT_DIAMETER_MM_RANGE,
  SHOTS_PER_HOLE_RANGE,
} from '../../src/domain/round/roundRules';
import { LATEST_SCHEMA_VERSION, MIGRATIONS } from '../../src/persistence/migrations';

// Migration 1 may already exist on devices. This copy fails the test if it is edited;
// schema changes belong in a new migration.
const FROZEN_MIGRATION_1 = `CREATE TABLE sessions (
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

// Migration 2 is on the owner's S20 since the first MVP. Same rule as migration 1.
const FROZEN_MIGRATION_2 = `ALTER TABLE sessions ADD COLUMN finished_at_utc TEXT;
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

describe('MIGRATIONS', () => {
  const migration1 = MIGRATIONS[0] ?? '';

  it('keeps migration 1 unchanged', () => {
    expect(migration1).toBe(FROZEN_MIGRATION_1);
  });

  it('derives the latest schema version from the migration list', () => {
    expect(LATEST_SCHEMA_VERSION).toBe(MIGRATIONS.length);
    expect(LATEST_SCHEMA_VERSION).toBe(4);
  });

  // If a domain limit changes, this fails and forces a decision about stored rows and a
  // new migration instead of silently diverging from the schema.
  it('matches the current domain limits in its CHECK constraints', () => {
    const firearmTypes = FIREARM_TYPES.map((type) => `'${type}'`).join(',');
    expect(migration1).toContain(`firearm_type IN (${firearmTypes})`);
    expect(migration1).toContain(
      `length(firearm_name) BETWEEN 1 AND ${FIREARM_NAME_MAX_CODE_POINTS}`,
    );
    expect(migration1).toContain(
      `length(calibre_label) BETWEEN 1 AND ${CALIBRE_LABEL_MAX_CODE_POINTS}`,
    );
    expect(migration1).toContain(
      `distance_m BETWEEN ${DISTANCE_TENTHS_RANGE.min / 10} AND ${DISTANCE_TENTHS_RANGE.max / 10}`,
    );
    expect(migration1).toContain(
      `planned_shots_per_round BETWEEN ${PLANNED_SHOTS_PER_ROUND_RANGE.min} AND ${PLANNED_SHOTS_PER_ROUND_RANGE.max}`,
    );
    expect(migration1).toContain(
      `planned_rounds BETWEEN ${PLANNED_ROUNDS_RANGE.min} AND ${PLANNED_ROUNDS_RANGE.max}`,
    );
  });

  it('stores no session status or target columns', () => {
    expect(migration1).not.toMatch(/status|target/i);
  });

  it('keeps migration 2 unchanged', () => {
    expect(MIGRATIONS[1]).toBe(FROZEN_MIGRATION_2);
  });

  // Later migrations run on devices with saved sessions and rounds: they may only add.
  it.each(MIGRATIONS.slice(2).map((sql, index) => [index + 3, sql] as const))(
    'only adds to the schema in migration %i',
    (_version, sql) => {
      expect(sql).not.toMatch(/\bDROP\b|\bDELETE\b|\bRENAME\b/i);
      expect(sql).not.toMatch(/\bUPDATE\s+\w+\s+SET\b(?![\s\S]*WHERE)/i);
    },
  );

  // Migration 2 must keep existing sessions: it may only add tables, indexes and a column.
  it('only adds to the schema in migration 2', () => {
    const migration2 = MIGRATIONS[1] ?? '';
    expect(migration2).not.toMatch(/\bDROP\b|\bDELETE\b|\bUPDATE\b|\bRENAME\b/i);
    expect(migration2.match(/ALTER TABLE/g)).toHaveLength(1);
    expect(migration2).toContain('ALTER TABLE sessions ADD COLUMN finished_at_utc TEXT;');
  });

  it('matches the round limits in migration 2', () => {
    const migration2 = MIGRATIONS[1] ?? '';
    expect(migration2).toContain(
      `actual_shots BETWEEN ${ACTUAL_SHOTS_RANGE.min} AND ${ACTUAL_SHOTS_RANGE.max}`,
    );
    expect(migration2).toContain(
      `hit_diameter_mm BETWEEN ${HIT_DIAMETER_MM_RANGE.min} AND ${HIT_DIAMETER_MM_RANGE.max}`,
    );
    expect(migration2).toContain(
      `shots BETWEEN ${SHOTS_PER_HOLE_RANGE.min} AND ${SHOTS_PER_HOLE_RANGE.max}`,
    );
  });
});
