import type { Session, SessionField } from '../../domain/session/session';
import {
  InvalidSessionError,
  type SaveSessionResult,
  SessionIdConflictError,
} from '../../persistence/sessionRepository';
import type { Result } from '../../domain/result';
import { prepareSession, type PrepareSessionDeps } from './prepareSession';
import type { SaveCoordinator } from './saveCoordinator';
import {
  initialSessionFormState,
  isEditable,
  type SaveOutcome,
  sessionFormReducer,
  type SessionFormAction,
  type SessionFormState,
} from './sessionFormState';

// What back navigation should do in the current state (docs/design/ui-ux.md §7).
export type LeaveBehaviour =
  | 'free' // leave without asking
  | 'confirmDiscard' // dialog 7.4
  | 'confirmUncertain' // dialog 7.5: the save may or may not have completed
  | 'blocked'; // a normal save is in progress

export type SessionFormView = {
  readonly form: SessionFormState;
  // This form's own save has passed the slow-save notice threshold.
  readonly slow: boolean;
  // Another form's save is still in flight, so this form cannot save yet (T2).
  readonly waitingForPreviousSave: boolean;
  readonly canSubmit: boolean;
  readonly leaveBehaviour: LeaveBehaviour;
};

export type SessionFormController = {
  getView(): SessionFormView;
  subscribe(listener: () => void): () => void;
  changeField(field: SessionField, value: string | null): void;
  submit(): void;
  retry(): void;
  dispose(): void;
};

export type SessionFormControllerDeps = {
  coordinator: SaveCoordinator;
  save: (session: Session) => Promise<SaveSessionResult>;
  prepare: PrepareSessionDeps;
  onSaved: () => void;
};

// InvalidSessionError is thrown before anything is written, so the unchanged snapshot would
// fail again: no Retry. Any other error after the save started leaves the result uncertain.
export function classifySaveResult(result: Result<SaveSessionResult, unknown>): SaveOutcome {
  if (result.ok) {
    return 'saved';
  }
  if (result.error instanceof SessionIdConflictError) {
    return 'conflict';
  }
  if (result.error instanceof InvalidSessionError) {
    return 'rejected';
  }
  return 'saveFailed';
}

function leaveBehaviourFor(form: SessionFormState, slow: boolean): LeaveBehaviour {
  switch (form.phase) {
    case 'editing':
    case 'prepareFailed':
      return form.dirty ? 'confirmDiscard' : 'free';
    case 'saving':
      return slow ? 'confirmUncertain' : 'blocked';
    case 'saveFailed':
      return 'confirmUncertain';
    case 'rejected':
    case 'conflict':
    case 'saved':
      return 'free';
  }
}

// Framework-free logic behind the new-session form. The React component only renders the
// view and forwards events, so the couplings below can be tested without rendering.
export function createSessionFormController(
  deps: SessionFormControllerDeps,
): SessionFormController {
  let form: SessionFormState = initialSessionFormState;
  let ownAttemptId: number | null = null;
  let disposed = false;
  let view: SessionFormView = buildView();
  const listeners = new Set<() => void>();

  function buildView(): SessionFormView {
    const coordinatorState = deps.coordinator.getState();
    const busy = coordinatorState.status === 'saving';
    const ownBusy = busy && coordinatorState.attemptId === ownAttemptId;
    const slow = ownBusy && coordinatorState.status === 'saving' && coordinatorState.slow;
    const waitingForPreviousSave = busy && !ownBusy && isEditable(form.phase);
    return {
      form,
      slow,
      waitingForPreviousSave,
      canSubmit: isEditable(form.phase) && !busy,
      leaveBehaviour: leaveBehaviourFor(form, slow),
    };
  }

  function publish(): void {
    view = buildView();
    for (const listener of [...listeners]) {
      listener();
    }
  }

  function dispatch(action: SessionFormAction): void {
    form = sessionFormReducer(form, action);
    publish();
  }

  const unsubscribeCoordinator = deps.coordinator.subscribe(() => {
    if (!disposed) {
      publish();
    }
  });

  function startSave(snapshot: Session): void {
    const attempt = deps.coordinator.run(() => deps.save(snapshot));
    if (attempt === null) {
      // Another save is in flight; the view shows waitingForPreviousSave.
      publish();
      return;
    }
    ownAttemptId = attempt.attemptId;
    dispatch({ type: 'saveStarted', snapshot });
    void attempt.settled.then((result) => {
      // A late result belongs only to the form that started it, and never to a disposed one.
      if (disposed || ownAttemptId !== attempt.attemptId) {
        return;
      }
      const outcome = classifySaveResult(result);
      dispatch({ type: 'saveSettled', outcome });
      if (outcome === 'saved') {
        deps.onSaved();
      }
    });
  }

  return {
    getView: () => view,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    changeField(field, value) {
      if (disposed) {
        return;
      }
      dispatch({ type: 'fieldChanged', field, value });
    },

    submit() {
      if (disposed || !view.canSubmit) {
        return;
      }
      const prepared = prepareSession(form.input, deps.prepare);
      if (!prepared.ok) {
        dispatch(
          prepared.error.kind === 'invalid'
            ? { type: 'validationFailed', fieldErrors: prepared.error.fieldErrors }
            : { type: 'prepareFailed' },
        );
        return;
      }
      startSave(prepared.value);
    },

    retry() {
      if (disposed || form.phase !== 'saveFailed' || form.snapshot === null) {
        return;
      }
      startSave(form.snapshot);
    },

    dispose() {
      disposed = true;
      unsubscribeCoordinator();
      listeners.clear();
    },
  };
}
