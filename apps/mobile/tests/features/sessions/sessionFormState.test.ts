import type { Session } from '../../../src/domain/session/session';
import {
  initialSessionFormState,
  sessionFormReducer,
  type SessionFormAction,
  type SessionFormState,
} from '../../../src/features/sessions/sessionFormState';

const SNAPSHOT: Session = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  createdAtUtc: '2026-10-27T13:00:00.000Z',
  createdTimeZone: 'Europe/Stockholm',
  settings: {
    firearmName: 'Glock 17',
    firearmType: 'pistol',
    calibreLabel: '9×19 mm',
    distanceMetres: 25.5,
    plannedShotsPerRound: 10,
    plannedRounds: null,
  },
};

function reduce(state: SessionFormState, ...actions: SessionFormAction[]): SessionFormState {
  return actions.reduce(sessionFormReducer, state);
}

function inPhase(phase: SessionFormState['phase']): SessionFormState {
  return { ...initialSessionFormState, phase, snapshot: phase === 'editing' ? null : SNAPSHOT };
}

describe('sessionFormReducer', () => {
  it('starts with empty fields, no firearm type and no errors', () => {
    expect(initialSessionFormState.input).toEqual({
      firearmName: '',
      firearmType: null,
      calibreLabel: '',
      distanceMetres: '',
      plannedShotsPerRound: '',
      plannedRounds: '',
    });
    expect(initialSessionFormState.visibleErrors).toEqual({});
    expect(initialSessionFormState.dirty).toBe(false);
  });

  it('shows no errors while editing before the first submit', () => {
    const state = reduce(initialSessionFormState, {
      type: 'fieldChanged',
      field: 'distanceMetres',
      value: 'abc',
    });
    expect(state.visibleErrors).toEqual({});
    expect(state.dirty).toBe(true);
  });

  it('shows all errors after a failed submit', () => {
    const state = reduce(initialSessionFormState, {
      type: 'validationFailed',
      fieldErrors: { firearmName: 'required', firearmType: 'required' },
    });
    expect(state.submitAttempted).toBe(true);
    expect(state.visibleErrors).toEqual({ firearmName: 'required', firearmType: 'required' });
  });

  it('after the first submit updates only the changed field', () => {
    const afterSubmit = reduce(initialSessionFormState, {
      type: 'validationFailed',
      fieldErrors: { firearmName: 'required', calibreLabel: 'required' },
    });

    const fixedName = reduce(afterSubmit, {
      type: 'fieldChanged',
      field: 'firearmName',
      value: 'Glock 17',
    });
    expect(fixedName.visibleErrors).toEqual({ calibreLabel: 'required' });

    // Distance is still invalid in the input, but it was not changed, so it stays hidden.
    const brokeName = reduce(fixedName, {
      type: 'fieldChanged',
      field: 'firearmName',
      value: 'a'.repeat(101),
    });
    expect(brokeName.visibleErrors).toEqual({ calibreLabel: 'required', firearmName: 'tooLong' });
  });

  it('selects a firearm type through the same field change', () => {
    const state = reduce(initialSessionFormState, {
      type: 'fieldChanged',
      field: 'firearmType',
      value: 'rifle',
    });
    expect(state.input.firearmType).toBe('rifle');
  });

  it('keeps fields editable after prepareFailed and returns to editing on change', () => {
    const failed = reduce(initialSessionFormState, { type: 'prepareFailed' });
    expect(failed.phase).toBe('prepareFailed');
    const edited = reduce(failed, { type: 'fieldChanged', field: 'calibreLabel', value: '9 mm' });
    expect(edited.phase).toBe('editing');
    expect(edited.input.calibreLabel).toBe('9 mm');
  });

  it('stores the snapshot when saving starts', () => {
    const state = reduce(initialSessionFormState, { type: 'saveStarted', snapshot: SNAPSHOT });
    expect(state.phase).toBe('saving');
    expect(state.snapshot).toBe(SNAPSHOT);
  });

  it.each(['saving', 'saveFailed', 'rejected', 'conflict', 'saved'] as const)(
    'locks the fields while %s',
    (phase) => {
      const state = inPhase(phase);
      expect(reduce(state, { type: 'fieldChanged', field: 'firearmName', value: 'changed' })).toBe(
        state,
      );
    },
  );

  it.each(['saved', 'saveFailed', 'rejected', 'conflict'] as const)(
    'moves from saving to %s',
    (outcome) => {
      expect(reduce(inPhase('saving'), { type: 'saveSettled', outcome }).phase).toBe(outcome);
    },
  );

  it('retries from saveFailed only with the same snapshot', () => {
    const failed = inPhase('saveFailed');
    expect(reduce(failed, { type: 'saveStarted', snapshot: SNAPSHOT }).phase).toBe('saving');
    const other: Session = { ...SNAPSHOT, createdAtUtc: '2026-10-27T13:00:05.000Z' };
    expect(reduce(failed, { type: 'saveStarted', snapshot: other })).toBe(failed);
  });

  it.each(['rejected', 'conflict', 'saved'] as const)('cannot start saving from %s', (phase) => {
    const state = inPhase(phase);
    expect(reduce(state, { type: 'saveStarted', snapshot: SNAPSHOT })).toBe(state);
  });

  it('ignores a settle when not saving', () => {
    const state = inPhase('saveFailed');
    expect(reduce(state, { type: 'saveSettled', outcome: 'saved' })).toBe(state);
  });
});

describe('prefilled', () => {
  it('fills an untouched form without marking it changed', () => {
    const state = sessionFormReducer(initialSessionFormState, {
      type: 'prefilled',
      values: { firearmName: 'Club pistol', distanceMetres: '25' },
    });
    expect(state.input.firearmName).toBe('Club pistol');
    expect(state.input.distanceMetres).toBe('25');
    expect(state.dirty).toBe(false);
  });

  it('never overwrites what the user has typed', () => {
    const typed = sessionFormReducer(initialSessionFormState, {
      type: 'fieldChanged',
      field: 'firearmName',
      value: 'Mine',
    });
    const state = sessionFormReducer(typed, {
      type: 'prefilled',
      values: { firearmName: 'Club pistol' },
    });
    expect(state).toBe(typed);
  });
});
