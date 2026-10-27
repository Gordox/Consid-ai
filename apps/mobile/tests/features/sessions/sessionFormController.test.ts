import type { Session, SessionFormInput } from '../../../src/domain/session/session';
import { createSaveCoordinator } from '../../../src/features/sessions/saveCoordinator';
import {
  classifySaveResult,
  createSessionFormController,
  type SessionFormController,
} from '../../../src/features/sessions/sessionFormController';
import {
  InvalidSessionError,
  type SaveSessionResult,
  SessionIdConflictError,
} from '../../../src/persistence/sessionRepository';
import { deferred, type Deferred, flushPromises } from '../../support/async';

// Couplings between preparation, the form state, the shared coordinator and saving, with a fake
// save. These tests do not render React: they do not prove that SessionForm, usePreventRemove,
// focus or the dialogs are wired correctly. That is checked manually (decision Ö1).

const VALID_INPUT: SessionFormInput = {
  firearmName: 'Glock 17',
  firearmType: 'pistol',
  calibreLabel: '9×19 mm',
  distanceMetres: '25.5',
  plannedShotsPerRound: '10',
  plannedRounds: '',
};

type SaveHarness = {
  calls: Session[];
  pending: Deferred<SaveSessionResult>[];
  save: (session: Session) => Promise<SaveSessionResult>;
};

function createSaveHarness(): SaveHarness {
  const calls: Session[] = [];
  const pending: Deferred<SaveSessionResult>[] = [];
  return {
    calls,
    pending,
    save: (session) => {
      calls.push(session);
      const result = deferred<SaveSessionResult>();
      pending.push(result);
      return result.promise;
    },
  };
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `3f2504e0-4f89-41d3-9a0c-${String(idCounter).padStart(12, '0')}`;
}

function createController(
  coordinator = createSaveCoordinator(),
  harness = createSaveHarness(),
  onSaved = jest.fn(),
): { controller: SessionFormController; harness: SaveHarness; onSaved: jest.Mock } {
  const controller = createSessionFormController({
    coordinator,
    save: harness.save,
    prepare: {
      newId: nextId,
      now: () => '2026-10-27T13:00:00.000Z',
      timeZone: () => 'Europe/Stockholm',
    },
    onSaved,
  });
  return { controller, harness, onSaved };
}

function fill(controller: SessionFormController, input: SessionFormInput = VALID_INPUT): void {
  controller.changeField('firearmName', input.firearmName);
  controller.changeField('firearmType', input.firearmType);
  controller.changeField('calibreLabel', input.calibreLabel);
  controller.changeField('distanceMetres', input.distanceMetres);
  controller.changeField('plannedShotsPerRound', input.plannedShotsPerRound);
  controller.changeField('plannedRounds', input.plannedRounds);
}

describe('createSessionFormController couplings', () => {
  it('submits the snapshot built from the input, id, time and time zone', () => {
    const { controller, harness } = createController();
    fill(controller);

    controller.submit();

    expect(harness.calls).toHaveLength(1);
    const sent = harness.calls[0];
    expect(sent).toBe(controller.getView().form.snapshot);
    expect(sent?.createdAtUtc).toBe('2026-10-27T13:00:00.000Z');
    expect(sent?.createdTimeZone).toBe('Europe/Stockholm');
    expect(sent?.settings.distanceMetres).toBe(25.5);
    expect(sent?.settings.plannedRounds).toBeNull();
  });

  it('turns a double tap into one save call', () => {
    const { controller, harness } = createController();
    fill(controller);

    controller.submit();
    controller.submit();

    expect(harness.calls).toHaveLength(1);
  });

  it('retries with the exact same snapshot after a save failure', async () => {
    const { controller, harness } = createController();
    fill(controller);
    controller.submit();
    harness.pending[0]?.reject(new Error('disk I/O error'));
    await flushPromises();
    expect(controller.getView().form.phase).toBe('saveFailed');

    controller.retry();

    expect(harness.calls).toHaveLength(2);
    expect(harness.calls[1]).toBe(harness.calls[0]);
    expect(controller.getView().form.phase).toBe('saving');
  });

  it('does not let a late result navigate away from a newer form', async () => {
    const coordinator = createSaveCoordinator();
    const first = createController(coordinator);
    fill(first.controller);
    first.controller.submit();
    first.controller.dispose();

    const second = createController(coordinator);
    fill(second.controller);

    first.harness.pending[0]?.resolve('saved');
    await flushPromises();

    expect(first.onSaved).not.toHaveBeenCalled();
    expect(second.onSaved).not.toHaveBeenCalled();
    expect(second.controller.getView().form.phase).toBe('editing');
  });

  it('shares the save lock between two forms', async () => {
    const coordinator = createSaveCoordinator();
    const first = createController(coordinator);
    fill(first.controller);
    first.controller.submit();
    first.controller.dispose();

    const second = createController(coordinator);
    fill(second.controller);
    expect(second.controller.getView().waitingForPreviousSave).toBe(true);
    expect(second.controller.getView().canSubmit).toBe(false);

    second.controller.submit();
    expect(second.harness.calls).toHaveLength(0);

    first.harness.pending[0]?.resolve('saved');
    await flushPromises();
    expect(second.controller.getView().waitingForPreviousSave).toBe(false);
    expect(second.controller.getView().canSubmit).toBe(true);

    second.controller.submit();
    expect(second.harness.calls).toHaveLength(1);
  });

  it.each([
    ['rejected', new InvalidSessionError({ id: 'invalidId' })],
    [
      'conflict',
      new SessionIdConflictError('3f2504e0-4f89-41d3-9a0c-0305e82c3301', 'differentContent'),
    ],
  ] as const)('offers no Retry after %s', async (phase, error) => {
    const { controller, harness } = createController();
    fill(controller);
    controller.submit();
    harness.pending[0]?.reject(error);
    await flushPromises();
    expect(controller.getView().form.phase).toBe(phase);

    controller.retry();
    controller.submit();

    expect(harness.calls).toHaveLength(1);
    expect(controller.getView().leaveBehaviour).toBe('free');
  });
});

describe('createSessionFormController states', () => {
  it('shows validation errors and saves nothing for invalid input', () => {
    const { controller, harness } = createController();
    controller.submit();

    expect(harness.calls).toHaveLength(0);
    expect(controller.getView().form.visibleErrors).toEqual({
      firearmName: 'required',
      firearmType: 'required',
      calibreLabel: 'required',
      distanceMetres: 'required',
      plannedShotsPerRound: 'required',
    });
  });

  it('calls onSaved once and stops blocking navigation after saved or alreadySaved', async () => {
    for (const result of ['saved', 'alreadySaved'] as const) {
      const { controller, harness, onSaved } = createController();
      fill(controller);
      controller.submit();
      harness.pending[0]?.resolve(result);
      await flushPromises();

      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(controller.getView().form.phase).toBe('saved');
      expect(controller.getView().leaveBehaviour).toBe('free');
    }
  });

  it('describes the back behaviour for each state', async () => {
    jest.useFakeTimers();
    try {
      const { controller, harness } = createController();
      expect(controller.getView().leaveBehaviour).toBe('free');

      fill(controller);
      expect(controller.getView().leaveBehaviour).toBe('confirmDiscard');

      controller.submit();
      expect(controller.getView().leaveBehaviour).toBe('blocked');

      jest.advanceTimersByTime(10_000);
      expect(controller.getView().slow).toBe(true);
      expect(controller.getView().leaveBehaviour).toBe('confirmUncertain');

      harness.pending[0]?.reject(new Error('disk I/O error'));
      await flushPromises();
      expect(controller.getView().leaveBehaviour).toBe('confirmUncertain');
    } finally {
      jest.useRealTimers();
    }
  });

  it('works again after resume, e.g. when Fast Refresh re-runs effects', () => {
    const { controller, harness } = createController();
    const listener = jest.fn();
    controller.subscribe(listener);
    controller.dispose();
    controller.resume();

    fill(controller);
    controller.submit();

    expect(listener).toHaveBeenCalled();
    expect(harness.calls).toHaveLength(1);
  });

  it('stops publishing after dispose', () => {
    const { controller } = createController();
    const listener = jest.fn();
    controller.subscribe(listener);
    controller.dispose();

    controller.changeField('firearmName', 'Glock 17');

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('classifySaveResult', () => {
  it('separates certain outcomes from uncertain failures', () => {
    expect(classifySaveResult({ ok: true, value: 'saved' })).toBe('saved');
    expect(classifySaveResult({ ok: true, value: 'alreadySaved' })).toBe('saved');
    expect(
      classifySaveResult({
        ok: false,
        error: new SessionIdConflictError(
          '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
          'existingRowInvalid',
        ),
      }),
    ).toBe('conflict');
    expect(classifySaveResult({ ok: false, error: new InvalidSessionError({}) })).toBe('rejected');
    expect(classifySaveResult({ ok: false, error: new Error('database is locked') })).toBe(
      'saveFailed',
    );
    expect(classifySaveResult({ ok: false, error: 'unknown' })).toBe('saveFailed');
  });
});
