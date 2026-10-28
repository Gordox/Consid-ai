import { LATEST_SCHEMA_VERSION, MIGRATIONS } from '../../src/persistence/migrations';
import { openNodeSqlite } from './nodeSqliteDatabase';

export const SESSION_ID = '11111111-1111-4111-8111-111111111111';
export const ROUND_ID = '22222222-2222-4222-8222-222222222222';

// A migrated in-memory database with one session and one draft round.
export async function databaseWithDraft() {
  const db = openNodeSqlite();
  for (const sql of MIGRATIONS.slice(0, LATEST_SCHEMA_VERSION)) {
    await db.execAsync(sql);
  }
  db.raw.exec(`INSERT INTO sessions VALUES ('${SESSION_ID}','2026-10-01T10:00:00.000Z',
    'Europe/Stockholm','P1','pistol','9 mm',25,5,NULL,NULL)`);
  db.raw.exec(`INSERT INTO rounds (id, session_id, sequence, state, created_at_utc, actual_shots,
    declared_misses, unresolved_shots, target_id, hit_diameter_mm)
    VALUES ('${ROUND_ID}','${SESSION_ID}',1,'draft','t',5,0,0,'demo-synthetic-v1',9)`);
  return db;
}
