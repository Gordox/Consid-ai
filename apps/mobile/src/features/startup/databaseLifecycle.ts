import type { SessionDatabase } from '../../persistence/database';
import { DatabaseVersionTooNewError } from '../../persistence/migrations';
import type { ClosableSessionDatabase } from '../../persistence/openSessionDatabase';
import type { SaveCoordinator } from '../sessions/saveCoordinator';

// What the app's screens share while the database is open.
export type SessionStore = {
  readonly db: SessionDatabase;
  readonly coordinator: SaveCoordinator;
};

export type StartupErrorKind = 'newerVersion' | 'other';

export type DatabaseLifecycleState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly store: SessionStore }
  | { readonly status: 'failed'; readonly errorKind: StartupErrorKind };

export type DatabaseLifecycleDeps = {
  openAndMigrate: () => Promise<ClosableSessionDatabase>;
  createCoordinator: () => SaveCoordinator;
  reportError: (error: unknown) => void;
};

export type DatabaseLifecycle = {
  getState(): DatabaseLifecycleState;
  subscribe(listener: () => void): () => void;
  activate(): void;
  retry(): void;
  deactivate(): void;
};

export function classifyStartupError(error: unknown): StartupErrorKind {
  return error instanceof DatabaseVersionTooNewError ? 'newerVersion' : 'other';
}

const LOADING: DatabaseLifecycleState = { status: 'loading' };

// Owns the database connection for DatabaseGate. Opening, migrating and closing run on one
// serial queue, so two initialisations never overlap (Retry, effect restarts, StrictMode).
// The generation number only decides whether a finished result is still wanted.
export function createDatabaseLifecycle(deps: DatabaseLifecycleDeps): DatabaseLifecycle {
  let state: DatabaseLifecycleState = LOADING;
  let generation = 0;
  let active = false;
  let open: { db: ClosableSessionDatabase; coordinator: SaveCoordinator } | null = null;
  let queue: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();

  function setState(next: DatabaseLifecycleState): void {
    state = next;
    for (const listener of [...listeners]) {
      listener();
    }
  }

  function enqueue(operation: () => Promise<void>): void {
    queue = queue.then(operation, operation);
  }

  async function closeQuietly(db: ClosableSessionDatabase): Promise<void> {
    try {
      await db.closeAsync();
    } catch (error) {
      deps.reportError(error);
    }
  }

  function startInitialisation(): void {
    generation += 1;
    const wanted = generation;
    setState(LOADING);
    enqueue(async () => {
      if (!active || wanted !== generation) {
        return;
      }
      let db: ClosableSessionDatabase;
      try {
        db = await deps.openAndMigrate();
      } catch (error) {
        if (active && wanted === generation) {
          deps.reportError(error);
          setState({ status: 'failed', errorKind: classifyStartupError(error) });
        }
        return;
      }
      if (!active || wanted !== generation) {
        await closeQuietly(db);
        return;
      }
      const coordinator = deps.createCoordinator();
      open = { db, coordinator };
      setState({ status: 'ready', store: { db, coordinator } });
    });
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    activate() {
      if (active) {
        return;
      }
      active = true;
      startInitialisation();
    },

    retry() {
      if (!active || state.status !== 'failed') {
        return;
      }
      startInitialisation();
    },

    deactivate() {
      if (!active) {
        return;
      }
      active = false;
      generation += 1;
      const closing = open;
      open = null;
      if (closing !== null) {
        // Never close a connection while a save is still using it.
        enqueue(async () => {
          await closing.coordinator.whenIdle();
          await closeQuietly(closing.db);
        });
      }
    },
  };
}
