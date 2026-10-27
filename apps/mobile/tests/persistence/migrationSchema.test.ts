import { FIREARM_TYPES } from '../../src/domain/session/firearmType';
import {
  CALIBRE_LABEL_MAX_CODE_POINTS,
  DISTANCE_TENTHS_RANGE,
  FIREARM_NAME_MAX_CODE_POINTS,
  PLANNED_ROUNDS_RANGE,
  PLANNED_SHOTS_PER_ROUND_RANGE,
} from '../../src/domain/session/sessionLimits';
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

describe('MIGRATIONS', () => {
  const migration1 = MIGRATIONS[0] ?? '';

  it('keeps migration 1 unchanged', () => {
    expect(migration1).toBe(FROZEN_MIGRATION_1);
  });

  it('derives the latest schema version from the migration list', () => {
    expect(LATEST_SCHEMA_VERSION).toBe(MIGRATIONS.length);
    expect(LATEST_SCHEMA_VERSION).toBe(1);
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
});
