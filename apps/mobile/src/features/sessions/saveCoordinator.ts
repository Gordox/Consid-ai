import type { Result } from '../../domain/result';

// After this long a save is flagged as slow so the UI can explain it and let the user leave.
// It is information only: the database operation is never cancelled or treated as failed.
export const SLOW_SAVE_NOTICE_MS = 10_000;

export type SaveCoordinatorState =
  | { readonly status: 'idle' }
  | { readonly status: 'saving'; readonly attemptId: number; readonly slow: boolean };

export type SaveAttempt<T> = {
  readonly attemptId: number;
  // Never rejects: a thrown error is returned as { ok: false }.
  readonly settled: Promise<Result<T, unknown>>;
};

export type SaveCoordinator = {
  getState(): SaveCoordinatorState;
  subscribe(listener: () => void): () => void;
  // Returns null while another save is in flight, so saves never run in parallel.
  run<T>(task: () => Promise<T>): SaveAttempt<T> | null;
  whenIdle(): Promise<void>;
};

const IDLE: SaveCoordinatorState = { status: 'idle' };

// One coordinator belongs to one open database connection (see DatabaseGate) and outlives
// navigation between forms.
export function createSaveCoordinator(slowAfterMs: number = SLOW_SAVE_NOTICE_MS): SaveCoordinator {
  let state: SaveCoordinatorState = IDLE;
  let nextAttemptId = 1;
  let idleWaiters: (() => void)[] = [];
  const listeners = new Set<() => void>();

  function setState(next: SaveCoordinatorState): void {
    state = next;
    for (const listener of [...listeners]) {
      listener();
    }
    if (next.status === 'idle') {
      const waiters = idleWaiters;
      idleWaiters = [];
      for (const resolve of waiters) {
        resolve();
      }
    }
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    run<T>(task: () => Promise<T>): SaveAttempt<T> | null {
      if (state.status !== 'idle') {
        return null;
      }
      const attemptId = nextAttemptId;
      nextAttemptId += 1;
      setState({ status: 'saving', attemptId, slow: false });

      const slowTimer = setTimeout(() => {
        if (state.status === 'saving' && state.attemptId === attemptId) {
          setState({ status: 'saving', attemptId, slow: true });
        }
      }, slowAfterMs);

      const settled = (async (): Promise<Result<T, unknown>> => {
        try {
          return { ok: true, value: await task() };
        } catch (error) {
          return { ok: false, error };
        } finally {
          clearTimeout(slowTimer);
          setState(IDLE);
        }
      })();

      return { attemptId, settled };
    },

    whenIdle() {
      if (state.status === 'idle') {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        idleWaiters.push(resolve);
      });
    },
  };
}
