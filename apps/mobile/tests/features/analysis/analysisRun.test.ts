import type { RoundPhoto } from '../../../src/domain/round/round';
import {
  type AnalysisRunOutcome,
  runAnalysisAttempt,
} from '../../../src/features/analysis/analysisRun';
import { createAnalysisRuns } from '../../../src/features/analysis/analysisRuns';
import { trackConnection } from '../../../src/features/startup/trackedConnection';
import { failInterruptedAttempts } from '../../../src/persistence/analysisRepository';
import type { SessionDatabase } from '../../../src/persistence/database';
import { saveDraftAnnotations, setDraftPhoto } from '../../../src/persistence/roundRepository';
import { deferred, flushPromises } from '../../support/async';
import {
  databaseWithDraft,
  draftRevision,
  ROUND_ID,
  TEST_CALIBRATION,
} from '../../support/sqliteFixtures';

// The whole attempt on real SQLite, with the network replaced by a fetch the test answers or
// that fails when the request is aborted, like the platform fetch.

type Db = Awaited<ReturnType<typeof databaseWithDraft>>;

const AFTER: RoundPhoto = {
  role: 'after',
  fileName: 'a.jpg',
  originalFileName: 'a.o.jpg',
  width: 3024,
  height: 4032,
  addedAtUtc: 't',
};

const CLEAN_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08]);

function answer(attemptId: string): Response {
  return new Response(
    JSON.stringify({
      roundId: ROUND_ID,
      attemptId,
      status: 'succeeded',
      algorithmVersion: 'v1',
      image: { width: 3024, height: 4032 },
      candidates: [
        { id: 'c1', x: 2000, y: 3000, diameterPx: 40, confidence: 0.9, uncertain: false },
      ],
      warnings: [],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

// A fetch whose answer the test releases; it rejects on abort as the platform fetch does.
function controlledFetch() {
  const response = deferred<Response>();
  let calls = 0;
  const fetch = (_url: string, init: RequestInit): Promise<Response> => {
    calls += 1;
    return new Promise((resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      response.promise.then(resolve, reject);
    });
  };
  return { fetch, response, calls: () => calls };
}

async function calibratedDraft(): Promise<Db> {
  const db = await databaseWithDraft();
  await setDraftPhoto(db, ROUND_ID, AFTER, await draftRevision(db));
  await saveDraftAnnotations(db, ROUND_ID, await draftRevision(db), TEST_CALIBRATION, []);
  return db;
}

function start(
  runs: ReturnType<typeof createAnalysisRuns<AnalysisRunOutcome>>,
  db: SessionDatabase,
  fetch: (url: string, init: RequestInit) => Promise<Response>,
  attemptId: string,
): boolean {
  return runs.start(ROUND_ID, attemptId, (signal) =>
    runAnalysisAttempt(
      {
        db,
        config: { baseUrl: 'http://127.0.0.1:8000', host: '127.0.0.1:8000' },
        photos: {
          uri: (name) => `file:///photos/${name}`,
          size: () => 1000,
          readHead: () => CLEAN_JPEG,
        },
        fetch,
        timeoutMs: 60_000,
        now: () => '2026-10-28T12:00:00.000Z',
        newId: () => 'mark-1',
        reportError: () => undefined,
      },
      {
        attemptId,
        roundId: ROUND_ID,
        targetId: 'demo-synthetic-v1',
        calibration: TEST_CALIBRATION,
        after: AFTER,
        before: null,
      },
      signal,
    ),
  );
}

const stored = (db: Db, sql: string) => db.raw.prepare(sql).all();

describe('runAnalysisAttempt with the registry', () => {
  it('stays running after the screen is left and is cancelled by the same controller', async () => {
    const db = await calibratedDraft();
    const runs = createAnalysisRuns<AnalysisRunOutcome>(() => undefined);
    const network = controlledFetch();
    expect(start(runs, db, network.fetch, 'a1')).toBe(true);
    await flushPromises();
    // A screen mounted again later reads the same state from the registry.
    expect(runs.runningAttempt(ROUND_ID)).toBe('a1');

    runs.cancel(ROUND_ID);
    await flushPromises(40);
    expect(runs.runningAttempt(ROUND_ID)).toBeNull();
    expect(runs.lastFinished(ROUND_ID)?.outcome.result).toEqual({ kind: 'cancelled' });
    expect(stored(db, 'SELECT status, error_code FROM analysis_attempts')).toEqual([
      { status: 'failed', error_code: 'cancelled' },
    ]);
    // The answer arriving afterwards changes nothing.
    network.response.resolve(answer('a1'));
    await flushPromises(40);
    expect(stored(db, 'SELECT id FROM round_marks')).toEqual([]);
  });

  it('shows the run until the suggestions are stored, then records the attempt and origin', async () => {
    const db = await calibratedDraft();
    const runs = createAnalysisRuns<AnalysisRunOutcome>(() => undefined);
    const network = controlledFetch();
    const statusWhenEnded: unknown[] = [];
    runs.subscribe(() => {
      if (runs.runningAttempt(ROUND_ID) === null) {
        statusWhenEnded.push(stored(db, 'SELECT status FROM analysis_attempts'));
      }
    });
    start(runs, db, network.fetch, 'a1');
    expect(start(runs, db, network.fetch, 'a2')).toBe(false);
    await flushPromises();
    network.response.resolve(answer('a1'));
    await flushPromises(60);

    expect(statusWhenEnded.at(-1)).toEqual([{ status: 'succeeded' }]);
    expect(network.calls()).toBe(1);
    expect(stored(db, 'SELECT id, source, accepted, attempt_id FROM round_marks')).toEqual([
      { id: 'mark-1', source: 'suggested', accepted: 0, attempt_id: 'a1' },
    ]);
    expect(stored(db, 'SELECT calibration_json FROM analysis_attempts')).toEqual([
      { calibration_json: JSON.stringify({ points: TEST_CALIBRATION }) },
    ]);
  });

  it('discards a late answer after the calibration changed and keeps the marks', async () => {
    const db = await calibratedDraft();
    const runs = createAnalysisRuns<AnalysisRunOutcome>(() => undefined);
    const network = controlledFetch();
    start(runs, db, network.fetch, 'a1');
    await flushPromises();
    const [, right, bottom, left] = TEST_CALIBRATION;
    await saveDraftAnnotations(
      db,
      ROUND_ID,
      await draftRevision(db),
      [{ x: 1520, y: 510 }, right, bottom, left],
      [],
    );
    network.response.resolve(answer('a1'));
    await flushPromises(60);
    expect(runs.lastFinished(ROUND_ID)?.outcome.result).toEqual({ kind: 'stale' });
    expect(stored(db, 'SELECT id FROM round_marks')).toEqual([]);
  });

  it('writes nothing through a closed connection; the next open records the attempt', async () => {
    const db = await calibratedDraft();
    const connection = trackConnection({ ...db, closeAsync: async () => undefined });
    const runs = createAnalysisRuns<AnalysisRunOutcome>(() => undefined);
    const network = controlledFetch();
    start(runs, connection.db, network.fetch, 'a1');
    await flushPromises(40);

    runs.closeAll();
    await connection.close();
    network.response.resolve(answer('a1'));
    await flushPromises(60);
    expect(stored(db, 'SELECT status FROM analysis_attempts')).toEqual([{ status: 'pending' }]);
    expect(stored(db, 'SELECT id FROM round_marks')).toEqual([]);

    // A new connection: no request of it exists, so the pending attempt is interrupted.
    await expect(failInterruptedAttempts(db, () => false)).resolves.toBe(1);
    expect(stored(db, 'SELECT status, error_code FROM analysis_attempts')).toEqual([
      { status: 'failed', error_code: 'interrupted' },
    ]);
  });

  it('leaves an attempt that is running alone when recording interrupted ones', async () => {
    const db = await calibratedDraft();
    const runs = createAnalysisRuns<AnalysisRunOutcome>(() => undefined);
    start(runs, db, controlledFetch().fetch, 'a1');
    await flushPromises();
    await expect(failInterruptedAttempts(db, runs.isAttemptRunning)).resolves.toBe(0);
    expect(stored(db, 'SELECT status FROM analysis_attempts')).toEqual([{ status: 'pending' }]);
    // End the request so its timeout does not outlive the test.
    runs.closeAll();
    await flushPromises(40);
  });
});
