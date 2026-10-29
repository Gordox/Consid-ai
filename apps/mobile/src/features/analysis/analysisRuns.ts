// The analyses running in this app, one per round at most. It lives with the database
// connection (SessionStore), not in a screen, so leaving a round and opening it again shows the
// same running analysis and the same Cancel. An entry stays until the attempt's outcome has been
// written, not only until the HTTP answer arrived.
//
// Cancel only stops waiting: the request is aborted on the client and the answer is ignored. The
// service may already have received the photos and may finish its work.

// What the screen shows after a run ended, kept until the round's next run starts.
export type FinishedRun<T> = { readonly attemptId: string; readonly outcome: T };

export type AnalysisRuns<T> = {
  // Starts work for a round unless one is already running or the registry is closed. Returns
  // false, synchronously, when it did not start, so a second tap can never start a second run.
  start(roundId: string, attemptId: string, work: (signal: AbortSignal) => Promise<T>): boolean;
  cancel(roundId: string): void;
  runningAttempt(roundId: string): string | null;
  isAttemptRunning(attemptId: string): boolean;
  isCancelling(roundId: string): boolean;
  lastFinished(roundId: string): FinishedRun<T> | null;
  subscribe(listener: () => void): () => void;
  // When the connection closes: every running request is aborted and no new one starts. Their
  // late writes are refused by the closing connection, never sent to a newer one.
  closeAll(): void;
};

type Entry = {
  readonly attemptId: string;
  readonly controller: AbortController;
  cancelling: boolean;
};

export function createAnalysisRuns<T>(reportError: (error: unknown) => void): AnalysisRuns<T> {
  const running = new Map<string, Entry>();
  const finished = new Map<string, FinishedRun<T>>();
  const listeners = new Set<() => void>();
  let closed = false;

  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  return {
    start(roundId, attemptId, work) {
      if (closed || running.has(roundId)) return false;
      const entry: Entry = { attemptId, controller: new AbortController(), cancelling: false };
      running.set(roundId, entry);
      finished.delete(roundId);
      notify();
      let outcome: { readonly value: T } | null = null;
      work(entry.controller.signal)
        .then((value) => {
          outcome = { value };
        }, reportError)
        .finally(() => {
          // Only this attempt's own entry is removed; a newer run for the round stays.
          if (running.get(roundId) === entry) {
            running.delete(roundId);
            if (outcome !== null) finished.set(roundId, { attemptId, outcome: outcome.value });
            notify();
          }
        });
      return true;
    },

    cancel(roundId) {
      const entry = running.get(roundId);
      if (entry === undefined || entry.cancelling) return;
      entry.cancelling = true;
      entry.controller.abort();
      notify();
    },

    runningAttempt: (roundId) => running.get(roundId)?.attemptId ?? null,

    isAttemptRunning: (attemptId) =>
      [...running.values()].some((entry) => entry.attemptId === attemptId),

    isCancelling: (roundId) => running.get(roundId)?.cancelling === true,

    lastFinished: (roundId) => finished.get(roundId) ?? null,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    closeAll() {
      closed = true;
      for (const entry of running.values()) entry.controller.abort();
      running.clear();
      finished.clear();
      notify();
    },
  };
}
