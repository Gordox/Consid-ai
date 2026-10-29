import type { SessionListing } from '../../persistence/sessionRepository';
import type { SaveCoordinator } from './saveCoordinator';

// State behind the session list (implementation/step-6-session-list.md §4–5). A failed read is
// never shown as an empty list: "loaded" is only reached through a successful read.
// L lets the screen read extra data (round summaries) together with the listing.
export type SessionListView<L extends SessionListing = SessionListing> =
  | { readonly status: 'initialLoading' }
  | { readonly status: 'initialFailed' }
  | {
      readonly status: 'loaded';
      readonly listing: L;
      // A reload is running; the earlier listing stays visible meanwhile.
      readonly refreshing: boolean;
      // The latest reload failed; the earlier listing is still shown (Ö2).
      readonly refreshFailed: boolean;
    };

export type SessionListController<L extends SessionListing = SessionListing> = {
  getView(): SessionListView<L>;
  subscribe(listener: () => void): () => void;
  // Called from focus effects. Becoming active reads the list; inactive lists never read.
  setActive(active: boolean): void;
  retry(): void;
  // Undoes dispose() for the same screen instance, e.g. when Fast Refresh re-runs effects.
  resume(): void;
  dispose(): void;
};

export type SessionListControllerDeps<L extends SessionListing = SessionListing> = {
  // Bound to listSessions(db) by the screen; the shared connection is never closed here.
  loadSessions: () => Promise<L>;
  coordinator: SaveCoordinator;
};

export function createSessionListController<L extends SessionListing = SessionListing>(
  deps: SessionListControllerDeps<L>,
): SessionListController<L> {
  let view: SessionListView<L> = { status: 'initialLoading' };
  let active = false;
  let disposed = false;
  // At most one read runs; requests during it collapse into one pending reload.
  let readInFlight = false;
  let reloadPending = false;
  // Bumped when the list deactivates or is disposed, so reads started earlier never publish.
  let generation = 0;
  let lastCoordinatorStatus = deps.coordinator.getState().status;
  let unsubscribeCoordinator: (() => void) | null = null;
  const listeners = new Set<() => void>();

  function publish(next: SessionListView<L>): void {
    view = next;
    for (const listener of [...listeners]) {
      listener();
    }
  }

  function startRead(): void {
    readInFlight = true;
    const readGeneration = generation;
    if (view.status === 'loaded') {
      publish({ ...view, refreshing: true });
    } else if (view.status === 'initialFailed') {
      publish({ status: 'initialLoading' });
    }

    deps.loadSessions().then(
      (listing) => finishRead(readGeneration, { ok: true, listing }),
      () => finishRead(readGeneration, { ok: false }),
    );
  }

  function finishRead(
    readGeneration: number,
    result: { ok: true; listing: L } | { ok: false },
  ): void {
    readInFlight = false;
    if (!disposed && readGeneration === generation) {
      if (result.ok) {
        publish({
          status: 'loaded',
          listing: result.listing,
          refreshing: false,
          refreshFailed: false,
        });
      } else if (view.status === 'loaded') {
        publish({ ...view, refreshing: false, refreshFailed: true });
      } else {
        publish({ status: 'initialFailed' });
      }
    }
    if (reloadPending && active && !disposed) {
      reloadPending = false;
      startRead();
    }
  }

  function requestRead(): void {
    if (!active || disposed) {
      return;
    }
    if (readInFlight) {
      reloadPending = true;
      return;
    }
    startRead();
  }

  function subscribeToCoordinator(): void {
    if (unsubscribeCoordinator !== null) {
      return;
    }
    lastCoordinatorStatus = deps.coordinator.getState().status;
    unsubscribeCoordinator = deps.coordinator.subscribe(() => {
      const status = deps.coordinator.getState().status;
      const saveFinished = lastCoordinatorStatus === 'saving' && status === 'idle';
      lastCoordinatorStatus = status;
      // A save that finishes while the list is shown may have added a row.
      if (saveFinished) {
        requestRead();
      }
    });
  }

  subscribeToCoordinator();

  return {
    getView: () => view,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    setActive(next) {
      if (disposed || next === active) {
        return;
      }
      active = next;
      if (active) {
        requestRead();
      } else {
        // Reads started while shown must not publish after the list was left; returning
        // starts a fresh read instead.
        generation += 1;
        reloadPending = false;
      }
    },

    retry() {
      requestRead();
    },

    resume() {
      if (!disposed) {
        return;
      }
      disposed = false;
      subscribeToCoordinator();
    },

    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      active = false;
      generation += 1;
      reloadPending = false;
      unsubscribeCoordinator?.();
      unsubscribeCoordinator = null;
    },
  };
}
