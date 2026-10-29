import type { SessionDatabase } from '../../persistence/database';
import { DatabaseVersionTooNewError } from '../../persistence/migrations';
import type { ClosableSessionDatabase } from '../../persistence/openSessionDatabase';
import { type AnalysisRuns, createAnalysisRuns } from '../analysis/analysisRuns';
import type { AnalysisRunOutcome } from '../analysis/analysisRun';
import type { SaveCoordinator } from '../sessions/saveCoordinator';
import { trackConnection, type TrackedConnection } from './trackedConnection';

// What the app's screens share while the database is open.
export type SessionStore = {
  readonly db: SessionDatabase;
  readonly coordinator: SaveCoordinator;
  // The photo folder that belongs to this database, handed out together with the connection.
  readonly photoFolder: string;
  // Analyses running on this connection; closed together with it.
  readonly analysisRuns: AnalysisRuns<AnalysisRunOutcome>;
};

export type StartupErrorKind = 'newerVersion' | 'other';

export type DatabaseLifecycleState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly store: SessionStore }
  | { readonly status: 'failed'; readonly errorKind: StartupErrorKind };

export type DatabaseLifecycleDeps = {
  openAndMigrate: () => Promise<ClosableSessionDatabase>;
  photoFolder: string;
  createCoordinator: () => SaveCoordinator;
  // Runs once after each open, before screens get the connection: it may only touch records no
  // request of this connection can own yet (no request exists until screens start one).
  afterOpen?: (db: SessionDatabase) => Promise<void>;
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
// serial queue, so two initialisations never overlap (Retry, effect restarts, StrictMode) and a
// new connection opens only after the previous one has closed.
// The generation number only decides whether a finished result is still wanted.
export function createDatabaseLifecycle(deps: DatabaseLifecycleDeps): DatabaseLifecycle {
  let state: DatabaseLifecycleState = LOADING;
  let generation = 0;
  let active = false;
  let open: {
    connection: TrackedConnection;
    coordinator: SaveCoordinator;
    analysisRuns: AnalysisRuns<AnalysisRunOutcome>;
  } | null = null;
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
      // Running analyses are aborted now; whatever they still try to write is refused by the
      // closing connection, and the next open records their attempts as interrupted.
      closing.analysisRuns.closeAll();
      enqueue(async () => {
        await closing.coordinator.whenIdle();
        await closeQuietly(() => closing.connection.close());
      });
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
        await closeQuietly(() => db.closeAsync());
        return;
      }
      const connection = trackConnection(db);
      if (deps.afterOpen !== undefined) {
        try {
          await deps.afterOpen(connection.db);
        } catch (error) {
          // Only housekeeping: screens treat a pending attempt without a request as interrupted.
          deps.reportError(error);
        }
      }
      if (!active || wanted !== generation) {
        await closeQuietly(() => connection.close());
        return;
      }
      const coordinator = deps.createCoordinator();
      const analysisRuns = createAnalysisRuns<AnalysisRunOutcome>(deps.reportError);
      open = { connection, coordinator, analysisRuns };
      setState({
        status: 'ready',
        store: { db: connection.db, coordinator, photoFolder: deps.photoFolder, analysisRuns },
      });
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
      closeCurrent();
    },
  };
}
