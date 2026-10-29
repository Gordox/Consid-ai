import { createAnalysisRuns } from '../../../src/features/analysis/analysisRuns';
import { deferred, flushPromises } from '../../support/async';

describe('createAnalysisRuns', () => {
  it('refuses a second start for the same round synchronously', () => {
    const runs = createAnalysisRuns<string>(() => undefined);
    const work = deferred<string>();
    expect(runs.start('r1', 'a1', () => work.promise)).toBe(true);
    expect(runs.start('r1', 'a2', () => work.promise)).toBe(false);
    expect(runs.runningAttempt('r1')).toBe('a1');
    expect(runs.start('r2', 'b1', () => work.promise)).toBe(true);
  });

  it('shows the run until its work, including the stored outcome, has finished', async () => {
    const runs = createAnalysisRuns<string>(() => undefined);
    const work = deferred<string>();
    runs.start('r1', 'a1', () => work.promise);
    await flushPromises();
    expect(runs.isAttemptRunning('a1')).toBe(true);
    work.resolve('done');
    await flushPromises();
    expect(runs.runningAttempt('r1')).toBeNull();
    expect(runs.lastFinished('r1')).toEqual({ attemptId: 'a1', outcome: 'done' });
  });

  it('cancels the running attempt and keeps it shown until it has ended', async () => {
    const runs = createAnalysisRuns<string>(() => undefined);
    const seen: { signal: AbortSignal | null } = { signal: null };
    const work = deferred<string>();
    runs.start('r1', 'a1', (s) => {
      seen.signal = s;
      return work.promise;
    });
    runs.cancel('r1');
    expect(seen.signal?.aborted).toBe(true);
    expect(runs.isCancelling('r1')).toBe(true);
    // Still the same run: a new one cannot start until this one has recorded its outcome.
    expect(runs.start('r1', 'a2', () => deferred<string>().promise)).toBe(false);
    work.resolve('cancelled');
    await flushPromises();
    expect(runs.runningAttempt('r1')).toBeNull();
    expect(runs.start('r1', 'a2', () => deferred<string>().promise)).toBe(true);
  });

  it("lets an older run's late end leave a newer run alone", async () => {
    const runs = createAnalysisRuns<string>(() => undefined);
    const first = deferred<string>();
    runs.start('r1', 'a1', () => first.promise);
    first.resolve('one');
    await flushPromises();
    const second = deferred<string>();
    runs.start('r1', 'a2', () => second.promise);
    await flushPromises();
    expect(runs.runningAttempt('r1')).toBe('a2');
    expect(runs.lastFinished('r1')).toBeNull();
  });

  it('aborts everything and refuses new runs once the connection closes', async () => {
    const errors: unknown[] = [];
    const runs = createAnalysisRuns<string>((error) => errors.push(error));
    const seen: { signal: AbortSignal | null } = { signal: null };
    const work = deferred<string>();
    runs.start('r1', 'a1', (s) => {
      seen.signal = s;
      return work.promise;
    });
    runs.closeAll();
    expect(seen.signal?.aborted).toBe(true);
    expect(runs.runningAttempt('r1')).toBeNull();
    expect(runs.start('r1', 'a2', () => deferred<string>().promise)).toBe(false);
    work.reject(new Error('late'));
    await flushPromises();
    expect(runs.lastFinished('r1')).toBeNull();
    expect(errors).toHaveLength(1);
  });
});
