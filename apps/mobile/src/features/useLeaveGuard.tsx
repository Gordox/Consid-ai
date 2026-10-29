import { usePreventRemove } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { createLeaveGuard, type SaveOutcome } from './leaveGuard';

// After this long a leave that is still waiting offers Stay or Leave. Only a threshold for the
// choice: the work goes on, and nothing navigates by itself.
export const LEAVE_WAIT_MS = 8_000;

export type LeaveTexts = {
  // Still saving after LEAVE_WAIT_MS; the outcome is not known yet.
  readonly stillSaving: { readonly title: string; readonly body: string };
  // The work ended and was definitely not saved.
  readonly notSaved: { readonly title: string; readonly body: string };
};

// One guard for every way back from a screen (leaveGuard.ts). pending() is read when the user
// tries to leave: the screen's unfinished work, or null when there is none.
export function useLeaveGuard(
  pending: () => Promise<SaveOutcome> | null,
  texts: LeaveTexts,
): {
  // Closes the screen after its own work, unless it was left already; at most one navigation.
  complete: (navigate: () => void) => void;
  dialog: ReactNode;
} {
  const [guard] = useState(() =>
    createLeaveGuard({
      waitMs: LEAVE_WAIT_MS,
      schedule: (callback, ms) => {
        const timer = setTimeout(callback, ms);
        return () => clearTimeout(timer);
      },
    }),
  );
  const shown = useSyncExternalStore(guard.subscribe, guard.dialog);
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  });
  const disableRef = useRef<() => void>(() => undefined);
  const disable = usePreventRemove(true, ({ repeat }) => {
    guard.request(pendingRef.current(), () => {
      disableRef.current();
      repeat();
    });
  });
  useEffect(() => {
    disableRef.current = disable;
  }, [disable]);
  useEffect(() => () => guard.markLeft(), [guard]);

  const text = shown === null ? null : texts[shown];
  return {
    complete: (navigate) =>
      guard.complete(() => {
        disableRef.current();
        navigate();
      }),
    dialog: (
      <ConfirmDialog
        body={text?.body ?? ''}
        cancelLabel="Stay"
        confirmLabel="Leave"
        onCancel={guard.stay}
        onConfirm={guard.leaveAnyway}
        title={text?.title ?? ''}
        visible={text !== null}
      />
    ),
  };
}
