import type { Calibration, ConfirmedResult, HitMark } from '../../../src/domain/round/round';
import { loadInspection } from '../../../src/features/inspection/inspection';
import type { SessionDatabase } from '../../../src/persistence/database';
import {
  confirmRound,
  saveDraftAnnotations,
  setDraftPhoto,
} from '../../../src/persistence/roundRepository';
import { databaseWithDraft, ROUND_ID, SESSION_ID } from '../../support/sqliteFixtures';

// Photo where the demo target's outer ring (100 mm) spans 400 px, centre (500, 500).
const CALIBRATION: Calibration = [
  { x: 500, y: 100 },
  { x: 900, y: 500 },
  { x: 500, y: 900 },
  { x: 100, y: 500 },
];

function mark(id: string, x: number, y: number, accepted = true): HitMark {
  return {
    id,
    position: { x, y },
    shots: 1,
    source: accepted ? 'manual' : 'suggested',
    uncertain: false,
    accepted,
    candidateId: null,
  };
}

// Counts every call that could write, so inspection can be shown to be read-only.
function watchWrites(db: SessionDatabase): { db: SessionDatabase; writes: string[] } {
  const writes: string[] = [];
  return {
    writes,
    db: {
      ...db,
      getFirstAsync: (source, params) => db.getFirstAsync(source, params),
      getAllAsync: (source, params) => db.getAllAsync(source, params),
      runAsync: (source, params) => {
        writes.push(source);
        return db.runAsync(source, params);
      },
      execAsync: (source) => {
        writes.push(source);
        return db.execAsync(source);
      },
      withExclusiveTransactionAsync: (task) => {
        writes.push('transaction');
        return db.withExclusiveTransactionAsync(task);
      },
    },
  };
}

async function draftWithMarks() {
  const db = await databaseWithDraft();
  await setDraftPhoto(db, ROUND_ID, {
    role: 'after',
    fileName: 'a.jpg',
    originalFileName: 'a.o.jpg',
    width: 1000,
    height: 1000,
    addedAtUtc: 't',
  });
  await saveDraftAnnotations(db, ROUND_ID, CALIBRATION, [
    mark('centre', 500, 500),
    mark('pending', 700, 700, false),
  ]);
  return db;
}

describe('loadInspection', () => {
  it('reads a draft without writing and scores accepted hits only', async () => {
    const { db, writes } = watchWrites(await draftWithMarks());
    const inspection = await loadInspection(db, SESSION_ID, ROUND_ID);
    expect(writes).toEqual([]);
    expect(inspection?.confirmed).toBe(false);
    expect(inspection?.details.get('centre')).toBe('10 demo pts');
    expect(inspection?.details.get('pending')).toBe('Suggestion, no score until accepted');
  });

  it('shows the values fixed at confirmation, not a recalculation', async () => {
    const base = await draftWithMarks();
    await saveDraftAnnotations(base, ROUND_ID, CALIBRATION, [mark('centre', 500, 500)]);
    const result: ConfirmedResult = {
      targetId: 'demo-synthetic-v1',
      scoringRule: 'contact-highest-v1',
      hitDiameterMm: 9,
      hitDiameterSource: 'assumed',
      actualShots: 5,
      declaredMisses: 4,
      unresolvedShots: 0,
      status: 'complete',
      subtotal: 7,
      total: 7,
      // Deliberately not what the current geometry would give (10), to prove nothing rescored.
      shots: [{ markId: 'centre', shots: 1, centreMm: { x: 0, y: 0 }, value: 7 }],
    };
    await confirmRound(base, ROUND_ID, result, 't2');
    const { db, writes } = watchWrites(base);
    const inspection = await loadInspection(db, SESSION_ID, ROUND_ID);
    expect(writes).toEqual([]);
    expect(inspection?.confirmed).toBe(true);
    expect(inspection?.marks.map((m) => m.id)).toEqual(['centre']);
    expect(inspection?.calibration).toEqual(CALIBRATION);
    expect(inspection?.details.get('centre')).toBe('7 demo pts');
  });

  it('refuses a round of another session', async () => {
    const db = await draftWithMarks();
    await expect(loadInspection(db, 'other-session', ROUND_ID)).resolves.toBeNull();
  });
});
