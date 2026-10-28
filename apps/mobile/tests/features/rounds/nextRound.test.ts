import { createActionGuard, startNextRound } from '../../../src/features/rounds/nextRound';
import {
  confirmRound,
  getSessionProgress,
  finishSession,
} from '../../../src/persistence/roundRepository';
import type { ConfirmedResult } from '../../../src/domain/round/round';
import { databaseWithDraft, ROUND_ID, SESSION_ID } from '../../support/sqliteFixtures';

const RESULT: ConfirmedResult = {
  targetId: 'demo-synthetic-v1',
  scoringRule: 'contact-highest-v1',
  hitDiameterMm: 9,
  hitDiameterSource: 'assumed',
  actualShots: 5,
  declaredMisses: 5,
  unresolvedShots: 0,
  status: 'complete',
  subtotal: 0,
  total: 0,
  shots: [],
};

let ids = 0;
const input = {
  sessionId: SESSION_ID,
  actualShots: 5,
  targetId: 'demo-synthetic-v1',
  newId: () => `44444444-4444-4444-8444-${String((ids += 1)).padStart(12, '0')}`,
  now: () => '2026-10-28T12:00:00.000Z',
};

async function confirmedSession() {
  const db = await databaseWithDraft();
  await confirmRound(db, ROUND_ID, RESULT, '2026-10-28T11:00:00.000Z');
  return db;
}

describe('startNextRound on SQLite', () => {
  it('opens a new draft after the confirmed round', async () => {
    const db = await confirmedSession();
    const outcome = await startNextRound(db, input);
    const progress = await getSessionProgress(db, SESSION_ID);
    expect(outcome.kind).toBe('open');
    expect(progress.rounds.map((round) => [round.sequence, round.state])).toEqual([
      [1, 'confirmed'],
      [2, 'draft'],
    ]);
  });

  // A repeated request that reaches the database after the first one. Two taps in the same
  // frame are stopped earlier by the action guard; the Node adapter refuses overlapping
  // transactions, so true concurrency is left to expo-sqlite on the device.
  it('creates one round for a repeated request and opens the same draft for both', async () => {
    const db = await confirmedSession();
    const first = await startNextRound(db, input);
    const second = await startNextRound(db, input);
    const progress = await getSessionProgress(db, SESSION_ID);
    expect(progress.rounds).toHaveLength(2);
    const draftId = progress.rounds[1]?.id;
    expect(first).toEqual({ kind: 'open', roundId: draftId });
    expect(second).toEqual({ kind: 'open', roundId: draftId });
  });

  it('gives a finished session no new round', async () => {
    const db = await confirmedSession();
    await finishSession(db, SESSION_ID, '2026-10-28T11:30:00.000Z');
    const outcome = await startNextRound(db, input);
    expect(outcome).toEqual({ kind: 'sessionFinished' });
    expect((await getSessionProgress(db, SESSION_ID)).rounds).toHaveLength(1);
  });

  it('reports other failures without navigating anywhere', async () => {
    const db = await confirmedSession();
    const outcome = await startNextRound(db, { ...input, actualShots: -1 });
    expect(outcome.kind).toBe('failed');
    expect((await getSessionProgress(db, SESSION_ID)).rounds).toHaveLength(1);
  });
});

describe('createActionGuard', () => {
  it('refuses a second entry until released', () => {
    const guard = createActionGuard();
    expect(guard.tryEnter()).toBe(true);
    expect(guard.tryEnter()).toBe(false);
    guard.release();
    expect(guard.tryEnter()).toBe(true);
  });
});
