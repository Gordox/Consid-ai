import type { ConfirmedResult } from '../../src/domain/round/round';
import { DEFAULT_HIT_DIAMETER_MM } from '../../src/domain/round/roundRules';
import {
  confirmRound,
  getRound,
  getSessionProgress,
  startRound,
  updateDraftCounts,
} from '../../src/persistence/roundRepository';
import { databaseWithDraft, ROUND_ID, SESSION_ID } from '../support/sqliteFixtures';

const NEXT_ROUND = '33333333-3333-4333-8333-333333333333';

function result(overrides: Partial<ConfirmedResult> = {}): ConfirmedResult {
  return {
    targetId: 'demo-synthetic-v1',
    scoringRule: 'contact-highest-v1',
    hitDiameterMm: 9,
    hitDiameterSource: 'assumed',
    actualShots: 5,
    declaredMisses: 0,
    unresolvedShots: 2,
    status: 'incomplete',
    subtotal: 27,
    total: null,
    shots: [],
    ...overrides,
  };
}

describe('hole diameter on SQLite', () => {
  it('starts as the stated assumption', async () => {
    const db = await databaseWithDraft();
    db.raw.exec(`DELETE FROM rounds`);
    await startRound(db, {
      roundId: ROUND_ID,
      sessionId: SESSION_ID,
      createdAtUtc: 't',
      actualShots: 5,
      targetId: 'demo-synthetic-v1',
    });
    const round = await getRound(db, ROUND_ID);
    expect(round).toMatchObject({
      hitDiameterMm: DEFAULT_HIT_DIAMETER_MM,
      hitDiameterSource: 'assumed',
    });
  });

  it("carries the user's diameter into the session's next round", async () => {
    const db = await databaseWithDraft();
    await updateDraftCounts(db, ROUND_ID, {
      actualShots: 5,
      declaredMisses: 0,
      unresolvedShots: 0,
      hitDiameterMm: 5.5,
      hitDiameterSource: 'userSet',
    });
    await confirmRound(
      db,
      ROUND_ID,
      result({ hitDiameterMm: 5.5, hitDiameterSource: 'userSet' }),
      't',
    );
    await startRound(db, {
      roundId: NEXT_ROUND,
      sessionId: SESSION_ID,
      createdAtUtc: 't2',
      actualShots: 5,
      targetId: 'demo-synthetic-v1',
    });
    await expect(getRound(db, NEXT_ROUND)).resolves.toMatchObject({
      sequence: 2,
      hitDiameterMm: 5.5,
      hitDiameterSource: 'userSet',
    });
  });

  it('does not carry an unconfirmed assumption forward as a choice', async () => {
    const db = await databaseWithDraft();
    await confirmRound(db, ROUND_ID, result(), 't');
    await startRound(db, {
      roundId: NEXT_ROUND,
      sessionId: SESSION_ID,
      createdAtUtc: 't2',
      actualShots: 5,
      targetId: 'demo-synthetic-v1',
    });
    await expect(getRound(db, NEXT_ROUND)).resolves.toMatchObject({
      hitDiameterSource: 'assumed',
    });
  });
});

describe('round summaries on SQLite', () => {
  it('read the unresolved count and target from the fixed result', async () => {
    const db = await databaseWithDraft();
    await confirmRound(db, ROUND_ID, result(), 't');
    const progress = await getSessionProgress(db, SESSION_ID);
    expect(progress.rounds).toEqual([
      {
        id: ROUND_ID,
        sequence: 1,
        state: 'confirmed',
        actualShots: 5,
        targetId: 'demo-synthetic-v1',
        confirmedSubtotal: 27,
        confirmedComplete: false,
        confirmedUnresolved: 2,
      },
    ]);
  });
});
