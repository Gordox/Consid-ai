import { inspectionMarkers, loadInspection } from '../../../src/features/inspection/inspection';
import { MIGRATIONS } from '../../../src/persistence/migrations';
import { openNodeSqlite } from '../../support/nodeSqliteDatabase';

// A round confirmed by an early version, when suggestions counted at once and results did not
// record where a hit came from, carried through every later migration.
const SESSION = '11111111-1111-4111-8111-111111111111';
const ROUND = '22222222-2222-4222-8222-222222222222';

async function confirmedAtSchema3() {
  const db = openNodeSqlite();
  for (const sql of MIGRATIONS.slice(0, 3)) await db.execAsync(sql);
  db.raw.exec(`INSERT INTO sessions VALUES ('${SESSION}','2026-10-01T10:00:00.000Z','UTC','P',
    'pistol','9 mm',25,3,NULL,NULL)`);
  const result = {
    targetId: 'demo-synthetic-v1',
    scoringRule: 'contact-highest-v1',
    hitDiameterMm: 9,
    actualShots: 3,
    declaredMisses: 1,
    unresolvedShots: 0,
    status: 'complete',
    subtotal: 17,
    total: 17,
    shots: [
      { markId: 'sug', shots: 1, centreMm: { x: 0, y: 0 }, value: 10 },
      { markId: 'own', shots: 1, centreMm: { x: 30, y: 0 }, value: 7 },
    ],
  };
  db.raw
    .prepare(
      `INSERT INTO rounds (id, session_id, sequence, state, created_at_utc, actual_shots,
        declared_misses, unresolved_shots, target_id, hit_diameter_mm, calibration_json,
        confirmed_at_utc, confirmed_json, confirmed_subtotal, confirmed_complete)
       VALUES (?, ?, 1, 'confirmed', 't', 3, 1, 0, 'demo-synthetic-v1', 9, NULL, 't2', ?, 17, 1)`,
    )
    .run(ROUND, SESSION, JSON.stringify(result));
  db.raw.exec(`INSERT INTO round_marks (id, round_id, ordinal, x, y, shots, source, uncertain,
    candidate_id) VALUES ('sug','${ROUND}',0,10,10,1,'suggested',0,'c1'),
    ('own','${ROUND}',1,20,20,1,'manual',0,NULL),
    ('extra','${ROUND}',2,30,30,1,'suggested',1,'c2')`);
  for (const sql of MIGRATIONS.slice(3)) await db.execAsync(sql);
  return db;
}

describe('inspecting a round confirmed before suggestions needed acceptance', () => {
  it('shows counted hits from the stored result, not as unreviewed suggestions', async () => {
    const db = await confirmedAtSchema3();
    // Migration 4 left the suggestion that was counted looking pending.
    expect(db.raw.prepare("SELECT accepted FROM round_marks WHERE id = 'sug'").get()).toEqual({
      accepted: 0,
    });

    const inspection = await loadInspection(db, SESSION, ROUND);
    if (inspection === null) throw new Error('expected the round');
    const markers = inspectionMarkers(inspection);
    const byId = (id: string) => {
      const mark = inspection.marks.find((m) => m.id === id);
      if (mark === undefined) throw new Error(id);
      return mark;
    };

    expect([...markers.numbers]).toEqual([
      ['sug', 1],
      ['own', 2],
    ]);
    expect(markers.kind(byId('sug'))).toBe('counted');
    expect(markers.kind(byId('extra'))).toBe('notInResult');
    // The early result did not record sources: nothing is guessed.
    expect(markers.status(byId('sug'))).toBe('source not recorded');
    expect(markers.status(byId('extra'))).toBe('not part of the confirmed result');
    // Scores are the stored ones.
    expect(inspection.details.get('sug')).toBe('10 demo pts');
    expect(inspection.details.get('own')).toBe('7 demo pts');
    expect(db.raw.prepare('SELECT confirmed_subtotal FROM rounds').get()).toEqual({
      confirmed_subtotal: 17,
    });
  });
});
