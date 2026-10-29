import type { ConfirmedResult, HitMark } from '../../src/domain/round/round';
import { DEFAULT_HIT_DIAMETER_MM } from '../../src/domain/round/roundRules';
import { findTarget } from '../../src/domain/target/targetDefinition';
import { createDraftWriteQueue } from '../../src/features/rounds/draftWriteQueue';
import {
  applyAnalysisResult,
  createAnalysisAttempt,
} from '../../src/persistence/analysisRepository';
import {
  confirmRound,
  DraftChangedError,
  getRound,
  getSessionProgress,
  saveDraftAnnotations,
  setDraftPhoto,
  startRound,
  updateDraftCounts,
} from '../../src/persistence/roundRepository';
import { deferred, flushPromises } from '../support/async';
import {
  databaseWithDraft,
  draftRevision,
  ROUND_ID,
  SESSION_ID,
  storeConfirmedRound,
  TEST_CALIBRATION,
} from '../support/sqliteFixtures';

const NEXT_ROUND = '33333333-3333-4333-8333-333333333333';

type Db = Awaited<ReturnType<typeof databaseWithDraft>>;

const confirm = async (
  db: Db,
  overrides: { expectedRevision?: number; running?: (attemptId: string) => boolean } = {},
) =>
  confirmRound(db, ROUND_ID, {
    expectedRevision: overrides.expectedRevision ?? (await draftRevision(db)),
    confirmedAtUtc: '2026-10-28T12:00:00.000Z',
    findTarget,
    isAttemptRunning: overrides.running ?? (() => false),
  });

// Every fired shot declared a miss: the simplest draft that can be confirmed.
async function allMissed(db: Db): Promise<void> {
  await updateDraftCounts(db, ROUND_ID, await draftRevision(db), {
    actualShots: 5,
    declaredMisses: 5,
    unresolvedShots: 0,
    hitDiameterMm: 9,
    hitDiameterSource: 'assumed',
  });
}

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
    await updateDraftCounts(db, ROUND_ID, await draftRevision(db), {
      actualShots: 5,
      declaredMisses: 5,
      unresolvedShots: 0,
      hitDiameterMm: 5.5,
      hitDiameterSource: 'userSet',
    });
    await expect(confirm(db)).resolves.toMatchObject({ kind: 'confirmed' });
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
    await allMissed(db);
    await expect(confirm(db)).resolves.toMatchObject({ kind: 'confirmed' });
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
    storeConfirmedRound(db, ROUND_ID, result(), 't');
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

const manual = (id: string, x: number, y: number): HitMark => ({
  id,
  position: { x, y },
  shots: 1,
  source: 'manual',
  uncertain: false,
  accepted: true,
  candidateId: null,
  attemptId: null,
});

async function draftWithAfter(): Promise<Db> {
  const db = await databaseWithDraft();
  await setDraftPhoto(
    db,
    ROUND_ID,
    {
      role: 'after',
      fileName: 'a.jpg',
      originalFileName: 'a.o.jpg',
      width: 3024,
      height: 4032,
      addedAtUtc: 't',
    },
    await draftRevision(db),
  );
  return db;
}

async function attempt(db: Db, attemptId: string, createdAtUtc = '2026-10-28T10:00:00.000Z') {
  await createAnalysisAttempt(db, {
    attemptId,
    roundId: ROUND_ID,
    source: 'service',
    createdAtUtc,
    afterFileName: 'a.jpg',
    beforeFileName: null,
    calibration: TEST_CALIBRATION,
  });
}

const applySuggestion = (db: Db, attemptId: string, id: string) =>
  applyAnalysisResult(db, {
    attemptId,
    roundId: ROUND_ID,
    algorithmVersion: 'v1',
    resultJson: '{}',
    suggestions: [
      {
        id,
        position: { x: 2000, y: 3000 },
        shots: 1,
        source: 'suggested',
        uncertain: false,
        accepted: false,
        candidateId: 'c1',
        attemptId,
      },
    ],
    duplicateRadiusPx: 20,
    calibration: TEST_CALIBRATION,
  });

const stored = (db: Db, sql: string) => db.raw.prepare(sql).all();

describe('draft revisions on SQLite', () => {
  it('refuses an editor save made before an analysis added suggestions', async () => {
    const db = await draftWithAfter();
    await saveDraftAnnotations(db, ROUND_ID, await draftRevision(db), TEST_CALIBRATION, []);
    const editorRevision = await draftRevision(db);
    await attempt(db, 'a1');
    await expect(applySuggestion(db, 'a1', 's1')).resolves.toMatchObject({ kind: 'applied' });

    await expect(
      saveDraftAnnotations(db, ROUND_ID, editorRevision, TEST_CALIBRATION, [
        manual('m1', 100, 100),
      ]),
    ).rejects.toBeInstanceOf(DraftChangedError);
    expect(stored(db, 'SELECT id, attempt_id FROM round_marks')).toEqual([
      { id: 's1', attempt_id: 'a1' },
    ]);
  });

  it('refuses a count change based on an outdated revision', async () => {
    const db = await databaseWithDraft();
    const shown = await draftRevision(db);
    await allMissed(db);
    await expect(
      updateDraftCounts(db, ROUND_ID, shown, {
        actualShots: 3,
        declaredMisses: 0,
        unresolvedShots: 0,
        hitDiameterMm: 9,
        hitDiameterSource: 'assumed',
      }),
    ).rejects.toBeInstanceOf(DraftChangedError);
    expect(stored(db, 'SELECT actual_shots, declared_misses FROM rounds')).toEqual([
      { actual_shots: 5, declared_misses: 5 },
    ]);
  });

  it('stops a queue of editor snapshots at an outside change and writes none of the rest', async () => {
    const db = await draftWithAfter();
    await saveDraftAnnotations(db, ROUND_ID, await draftRevision(db), TEST_CALIBRATION, []);
    await attempt(db, 'a1');
    const gate = deferred<void>();
    let writesStarted = 0;
    const queue = createDraftWriteQueue<HitMark[]>({
      initialRevision: await draftRevision(db),
      write: async (marks, expectedRevision) => {
        writesStarted += 1;
        if (writesStarted === 2) await gate.promise;
        return saveDraftAnnotations(db, ROUND_ID, expectedRevision, TEST_CALIBRATION, marks);
      },
      isConflict: (error) => error instanceof DraftChangedError,
      reportError: () => undefined,
    });
    const first = [manual('m1', 100, 100)];
    queue.enqueue(first);
    queue.enqueue([...first, manual('m2', 200, 200)]);
    queue.enqueue([...first, manual('m2', 200, 200), manual('m3', 300, 300)]);
    await flushPromises();
    // The analysis answer lands between the first and second write.
    await expect(applySuggestion(db, 'a1', 's1')).resolves.toMatchObject({ kind: 'applied' });
    gate.resolve();

    await expect(queue.settled()).resolves.toBe('changed');
    expect(queue.status()).toEqual({ pending: 0, failed: false, lostChanges: 2 });
    expect(writesStarted).toBe(2);
    expect(stored(db, 'SELECT id FROM round_marks ORDER BY ordinal')).toEqual([
      { id: 'm1' },
      { id: 's1' },
    ]);
    // A snapshot made after the stop is refused too, never written with the new revision.
    expect(queue.enqueue([manual('m4', 400, 400)])).toBe(false);
    expect(queue.status().lostChanges).toBe(3);
  });

  it('advances the revision with every write to the draft', async () => {
    const db = await draftWithAfter();
    const afterPhoto = await draftRevision(db);
    await saveDraftAnnotations(db, ROUND_ID, afterPhoto, TEST_CALIBRATION, []);
    await allMissed(db);
    await attempt(db, 'a1');
    await applySuggestion(db, 'a1', 's1');
    expect(await draftRevision(db)).toBe(afterPhoto + 3);
  });
});

describe('confirmRound on SQLite', () => {
  it('builds the result from the stored draft and writes matching count columns', async () => {
    const db = await draftWithAfter();
    await saveDraftAnnotations(db, ROUND_ID, await draftRevision(db), TEST_CALIBRATION, [
      manual('m1', 1500, 2000),
    ]);
    await updateDraftCounts(db, ROUND_ID, await draftRevision(db), {
      actualShots: 3,
      declaredMisses: 1,
      unresolvedShots: 1,
      hitDiameterMm: 9.65,
      hitDiameterSource: 'userSet',
    });

    const outcome = await confirm(db);
    expect(outcome).toMatchObject({
      kind: 'confirmed',
      result: {
        status: 'incomplete',
        actualShots: 3,
        declaredMisses: 1,
        unresolvedShots: 1,
        hitDiameterMm: 9.65,
        subtotal: 10,
        total: null,
      },
    });
    const [row] = stored(
      db,
      'SELECT actual_shots, declared_misses, unresolved_shots, confirmed_subtotal, confirmed_json FROM rounds',
    );
    const json = JSON.parse(String(row?.confirmed_json));
    expect(row).toMatchObject({
      actual_shots: json.actualShots,
      declared_misses: json.declaredMisses,
      unresolved_shots: json.unresolvedShots,
      confirmed_subtotal: json.subtotal,
    });
  });

  it('refuses a revision the user did not see and confirms nothing', async () => {
    const db = await databaseWithDraft();
    const shown = await draftRevision(db);
    await allMissed(db);
    await expect(confirm(db, { expectedRevision: shown })).resolves.toEqual({ kind: 'changed' });
    expect(stored(db, 'SELECT state FROM rounds')).toEqual([{ state: 'draft' }]);
  });

  it('refuses pending suggestions stored after the screen read the draft', async () => {
    const db = await draftWithAfter();
    await saveDraftAnnotations(db, ROUND_ID, await draftRevision(db), TEST_CALIBRATION, []);
    await updateDraftCounts(db, ROUND_ID, await draftRevision(db), {
      actualShots: 1,
      declaredMisses: 1,
      unresolvedShots: 0,
      hitDiameterMm: 9,
      hitDiameterSource: 'assumed',
    });
    await attempt(db, 'a1');
    await applySuggestion(db, 'a1', 's1');
    // Even at the revision that now includes the suggestion, review is still required.
    await expect(confirm(db)).resolves.toEqual({ kind: 'blocked', reason: 'suggestionsPending' });
    expect(stored(db, 'SELECT state FROM rounds')).toEqual([{ state: 'draft' }]);
  });

  it('waits for an analysis that is still running in the app', async () => {
    const db = await draftWithAfter();
    await allMissed(db);
    await attempt(db, 'a1');
    await expect(confirm(db, { running: (id) => id === 'a1' })).resolves.toEqual({
      kind: 'analysisRunning',
    });
    expect(stored(db, 'SELECT status FROM analysis_attempts')).toEqual([{ status: 'pending' }]);
  });

  it('records abandoned pending attempts, recent and old, as interrupted and confirms', async () => {
    const db = await draftWithAfter();
    await allMissed(db);
    await attempt(db, 'old', '2026-10-01T10:00:00.000Z');
    await attempt(db, 'recent', '2026-10-28T11:59:00.000Z');
    await expect(confirm(db)).resolves.toMatchObject({ kind: 'confirmed' });
    expect(stored(db, 'SELECT id, status, error_code FROM analysis_attempts ORDER BY id')).toEqual([
      { id: 'old', status: 'failed', error_code: 'interrupted' },
      { id: 'recent', status: 'failed', error_code: 'interrupted' },
    ]);
  });

  it('returns the stored result for a repeated confirmation without writing again', async () => {
    const db = await databaseWithDraft();
    await allMissed(db);
    const first = await confirm(db);
    const before = stored(db, 'SELECT * FROM rounds');

    const again = await confirm(db, { expectedRevision: 0 });
    expect(again.kind).toBe('alreadyConfirmed');
    expect(first.kind === 'confirmed' && again.kind === 'alreadyConfirmed').toBe(true);
    if (first.kind === 'confirmed' && again.kind === 'alreadyConfirmed') {
      expect(again.result).toEqual(first.result);
    }
    expect(stored(db, 'SELECT * FROM rounds')).toEqual(before);
  });
});
