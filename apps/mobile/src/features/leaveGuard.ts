// What happens when the user leaves a screen while its own work is still being saved. Every way
// back (the visible Back or Close, Android Back, the iOS back gesture) goes through one guard:
// - Nothing pending: leave at once.
// - Saving: wait. If it ends well, leave. If it fails, ask (definitely not saved).
// - Still saving after waitMs: ask (outcome unknown). This is only the point at which the user
//   is offered a choice; the work is never stopped and nothing navigates by itself.
// Stay invalidates the earlier request, so its late result never navigates. Leaving navigates at
// most once, whichever path gets there first.

export type SaveOutcome = 'saved' | 'failed' | 'changed';

export type LeaveDialog = 'stillSaving' | 'notSaved' | null;

export type LeaveGuard = {
  // A leave was requested; pending is the screen's own unfinished work, or null.
  request(pending: Promise<SaveOutcome> | null, navigate: () => void): void;
  stay(): void;
  leaveAnyway(): void;
  // The screen's own completion (for example a photo saved) closes it, at most once overall.
  complete(navigate: () => void): void;
  // The screen was left some other way; nothing more may navigate from it.
  markLeft(): void;
  dialog(): LeaveDialog;
  waiting(): boolean;
  subscribe(listener: () => void): () => void;
};

export function createLeaveGuard(deps: {
  readonly waitMs: number;
  readonly schedule: (callback: () => void, ms: number) => () => void;
}): LeaveGuard {
  let left = false;
  let request = 0;
  let waiting = false;
  let dialog: LeaveDialog = null;
  let navigateLater: (() => void) | null = null;
  let cancelTimer: (() => void) | null = null;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  function clearTimer(): void {
    cancelTimer?.();
    cancelTimer = null;
  }

  function leave(navigate: () => void): void {
    if (left) return;
    left = true;
    clearTimer();
    waiting = false;
    dialog = null;
    navigateLater = null;
    notify();
    navigate();
  }

  return {
    request(pending, navigate) {
      if (left) return;
      if (pending === null) {
        leave(navigate);
        return;
      }
      request += 1;
      const mine = request;
      waiting = true;
      dialog = null;
      navigateLater = navigate;
      clearTimer();
      cancelTimer = deps.schedule(() => {
        if (mine === request && waiting) {
          dialog = 'stillSaving';
          notify();
        }
      }, deps.waitMs);
      notify();
      void pending.then(
        (outcome) => {
          if (mine !== request || !waiting || left) return;
          if (outcome === 'saved') {
            leave(navigate);
          } else {
            clearTimer();
            dialog = 'notSaved';
            notify();
          }
        },
        () => {
          if (mine !== request || !waiting || left) return;
          clearTimer();
          dialog = 'notSaved';
          notify();
        },
      );
    },

    stay() {
      request += 1;
      waiting = false;
      dialog = null;
      navigateLater = null;
      clearTimer();
      notify();
    },

    leaveAnyway() {
      const navigate = navigateLater;
      if (navigate !== null) leave(navigate);
    },

    complete(navigate) {
      leave(navigateLater ?? navigate);
    },

    markLeft() {
      left = true;
      clearTimer();
      waiting = false;
      dialog = null;
      navigateLater = null;
    },

    dialog: () => dialog,
    waiting: () => waiting,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
