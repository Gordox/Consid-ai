import type { SessionDatabase } from '../../persistence/database';
import { DatabaseVersionTooNewError } from '../../persistence/migrations';
import type { ClosableSessionDatabase } from '../../persistence/openSessionDatabase';
import type { SaveCoordinator } from '../sessions/saveCoordinator';
import { trackConnection, type TrackedConnection } from './trackedConnection';

// What the app's screens share while the database is open.
export type SessionStore = {
  readonly db: SessionDatabase;
  readonly coordinator: SaveCoordinator;
  // The photo folder that belongs to this database. Set together with the connection, so rows
  // and photo files of different databases can never be mixed.
  readonly photoFolder: string;
};

export type StartupErrorKind = 'newerVersion' | 'other';

// 'test' is the development-only UI check database. The mode lives only in memory, so a full
// restart always opens the normal database again.
export type DatabaseMode = 'normal' | 'test';

export type DatabaseLifecycleState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly store: SessionStore }
  | { readonly status: 'failed'; readonly errorKind: StartupErrorKind };

export type DatabaseLifecycleDeps = {
  openAndMigrate: (mode: DatabaseMode) => Promise<ClosableSessionDatabase>;
  photoFolderFor: (mode: DatabaseMode) => string;
  createCoordinator: () => SaveCoordinator;
  reportError: (error: unknown) => void;
};

export type DatabaseLifecycle = {
  getState(): DatabaseLifecycleState;
  getMode(): DatabaseMode;
  subscribe(listener: () => void): () => void;
  activate(): void;
  retry(): void;
  // Closes the current connection (after its save and running operations settle) and then
  // opens the other database, on the same serial queue.
  switchMode(mode: DatabaseMode): void;
  deactivate(): void;
};

export function classifyStartupError(error: unknown): StartupErrorKind {
  return error instanceof DatabaseVersionTooNewError ? 'newerVersion' : 'other';
}

const LOADING: DatabaseLifecycleState = { status: 'loading' };

// Owns the database connection for DatabaseGate. Opening, migrating and closing run on one
// serial queue, so two initialisations never overlap (Retry, effect restarts, StrictMode,
// mode switches) and a new connection opens only after the previous one has closed.
// The generation number only decides whether a finished result is still wanted.
export function createDatabaseLifecycle(deps: DatabaseLifecycleDeps): DatabaseLifecycle {
  let state: DatabaseLifecycleState = LOADING;
  let mode: DatabaseMode = 'normal';
  let generation = 0;
  let active = false;
  let open: { connection: TrackedConnection; coordinator: SaveCoordinator } | null = null;
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

  async function closeQuietly(close: () => Promise<void>): Promise<void> {
    try {
      await close();
    } catch (error) {
      deps.reportError(error);
    }
  }

  // Never close a connection while a save or another operation is still using it. New
  // operations are refused from the moment the save has finished.
  function closeCurrent(): void {
    const closing = open;
    open = null;
    if (closing !== null) {
      enqueue(async () => {
        await closing.coordinator.whenIdle();
        await closeQuietly(() => closing.connection.close());
      });
    }
  }

  function startInitialisation(): void {
    generation += 1;
    const wanted = generation;
    const wantedMode = mode;
    setState(LOADING);
    enqueue(async () => {
      if (!active || wanted !== generation) {
        return;
      }
      let db: ClosableSessionDatabase;
      try {
        db = await deps.openAndMigrate(wantedMode);
      } catch (error) {
        if (active && wanted === generation) {
          deps.reportError(error);
          setState({ status: 'failed', errorKind: classifyStartupError(error) });
        }
        return;
      }
      if (!active || wanted !== generation) {
        await closeQuietly(() => db.closeAsync());
        return;
      }
      const connection = trackConnection(db);
      const coordinator = deps.createCoordinator();
      open = { connection, coordinator };
      setState({
        status: 'ready',
        store: { db: connection.db, coordinator, photoFolder: deps.photoFolderFor(wantedMode) },
      });
    });
  }

  return {
    getState: () => state,

    getMode: () => mode,

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

    switchMode(next) {
      if (!active || next === mode) {
        return;
      }
      mode = next;
      // The loading state unmounts the screens first, so their late results are discarded.
      closeCurrent();
      startInitialisation();
    },

    deactivate() {
      if (!active) {
        return;
      }
      active = false;
      generation += 1;
      closeCurrent();
    },
  };
}
