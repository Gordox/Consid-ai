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

// The draft's stored revision, as a screen would have read it.
export async function draftRevision(
  db: Awaited<ReturnType<typeof databaseWithDraft>>,
  roundId: string = ROUND_ID,
): Promise<number> {
  const row = db.raw.prepare('SELECT draft_revision FROM rounds WHERE id = ?').get(roundId);
  const revision: unknown = row?.draft_revision;
  if (typeof revision !== 'number') throw new Error('No draft revision');
  return revision;
}

// Four calibration taps on a 3024 × 4032 photo: top, right, bottom, left.
export const TEST_CALIBRATION = [
  { x: 1500, y: 500 },
  { x: 2500, y: 2000 },
  { x: 1500, y: 3500 },
  { x: 500, y: 2000 },
] as const;

// Writes a confirmed round directly, as an earlier app version or rule could have stored it. The
// app itself only confirms through confirmRound, which builds the result from the draft.
export function storeConfirmedRound(
  db: Awaited<ReturnType<typeof databaseWithDraft>>,
  roundId: string,
  result: {
    readonly subtotal: number;
    readonly status: 'complete' | 'incomplete';
    readonly actualShots: number;
    readonly declaredMisses: number;
    readonly unresolvedShots: number;
  },
  confirmedAtUtc: string,
): void {
  db.raw
    .prepare(
      `UPDATE rounds SET state = 'confirmed', confirmed_at_utc = ?, confirmed_json = ?,
         confirmed_subtotal = ?, confirmed_complete = ?, actual_shots = ?, declared_misses = ?,
         unresolved_shots = ?
       WHERE id = ? AND state = 'draft'`,
    )
    .run(
      confirmedAtUtc,
      JSON.stringify(result),
      result.subtotal,
      result.status === 'complete' ? 1 : 0,
      result.actualShots,
      result.declaredMisses,
      result.unresolvedShots,
      roundId,
    );
}
