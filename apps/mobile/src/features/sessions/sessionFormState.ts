import type {
  Session,
  SessionField,
  SessionFieldErrors,
  SessionFormInput,
} from '../../domain/session/session';
import { validateSessionInput } from '../../domain/session/validateSessionInput';

// See the state table in implementation/step-5-create-session.md §6.
export type SessionFormPhase =
  'editing' | 'prepareFailed' | 'saving' | 'saveFailed' | 'rejected' | 'conflict' | 'saved';

export type SaveOutcome = 'saved' | 'saveFailed' | 'rejected' | 'conflict';

export type SessionFormState = {
  readonly input: SessionFormInput;
  readonly dirty: boolean;
  readonly submitAttempted: boolean;
  readonly visibleErrors: SessionFieldErrors;
  readonly phase: SessionFormPhase;
  // Created on the first valid submit and reused unchanged by every Retry.
  readonly snapshot: Session | null;
};

export type SessionFormAction =
  | { readonly type: 'fieldChanged'; readonly field: SessionField; readonly value: string | null }
  // Starting values from the last used profile or template. Only for an untouched form, and it
  // leaves the form untouched: leaving without edits still needs no confirmation.
  | { readonly type: 'prefilled'; readonly values: Partial<SessionFormInput> }
  | { readonly type: 'validationFailed'; readonly fieldErrors: SessionFieldErrors }
  | { readonly type: 'prepareFailed' }
  | { readonly type: 'saveStarted'; readonly snapshot: Session }
  | { readonly type: 'saveSettled'; readonly outcome: SaveOutcome };

// All fields empty and no firearm type preselected (A3, F7).
export const initialSessionFormState: SessionFormState = {
  input: {
    firearmName: '',
    firearmType: null,
    calibreLabel: '',
    distanceMetres: '',
    plannedShotsPerRound: '',
    plannedRounds: '',
  },
  dirty: false,
  submitAttempted: false,
  visibleErrors: {},
  phase: 'editing',
  snapshot: null,
};

export function isEditable(phase: SessionFormPhase): boolean {
  return phase === 'editing' || phase === 'prepareFailed';
}

function withField(
  input: SessionFormInput,
  field: SessionField,
  value: string | null,
): SessionFormInput {
  if (field === 'firearmType') {
    return { ...input, firearmType: value };
  }
  return { ...input, [field]: value ?? '' };
}

// After the first submit only the changed field's error is updated (decision U7).
function revalidateField(
  visibleErrors: SessionFieldErrors,
  input: SessionFormInput,
  field: SessionField,
): SessionFieldErrors {
  const validation = validateSessionInput(input);
  const error = validation.ok ? undefined : validation.error[field];
  const next: SessionFieldErrors = { ...visibleErrors };
  if (error === undefined) {
    delete next[field];
  } else {
    next[field] = error;
  }
  return next;
}

export function sessionFormReducer(
  state: SessionFormState,
  action: SessionFormAction,
): SessionFormState {
  switch (action.type) {
    case 'fieldChanged': {
      if (!isEditable(state.phase)) {
        return state;
      }
      const input = withField(state.input, action.field, action.value);
      return {
        ...state,
        input,
        dirty: true,
        phase: 'editing',
        visibleErrors: state.submitAttempted
          ? revalidateField(state.visibleErrors, input, action.field)
          : state.visibleErrors,
      };
    }
    case 'prefilled':
      if (state.phase !== 'editing' || state.dirty || state.submitAttempted) {
        return state;
      }
      return { ...state, input: { ...state.input, ...action.values } };
    case 'validationFailed':
      if (!isEditable(state.phase)) {
        return state;
      }
      return {
        ...state,
        submitAttempted: true,
        visibleErrors: action.fieldErrors,
        phase: 'editing',
      };
    case 'prepareFailed':
      if (!isEditable(state.phase)) {
        return state;
      }
      return { ...state, submitAttempted: true, visibleErrors: {}, phase: 'prepareFailed' };
    case 'saveStarted':
      if (!isEditable(state.phase) && state.phase !== 'saveFailed') {
        return state;
      }
      // A Retry must send the snapshot it already has.
      if (state.snapshot !== null && state.snapshot !== action.snapshot) {
        return state;
      }
      return {
        ...state,
        submitAttempted: true,
        visibleErrors: {},
        phase: 'saving',
        snapshot: action.snapshot,
      };
    case 'saveSettled':
      if (state.phase !== 'saving') {
        return state;
      }
      return { ...state, phase: action.outcome };
  }
}
