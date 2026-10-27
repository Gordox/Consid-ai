import {
  createSaveCoordinator,
  SLOW_SAVE_NOTICE_MS,
} from '../../../src/features/sessions/saveCoordinator';
import { deferred, flushPromises } from '../../support/async';

describe('createSaveCoordinator', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs one save and returns its result without rejecting', async () => {
    const coordinator = createSaveCoordinator();
    const attempt = coordinator.run(async () => 'saved');

    expect(attempt).not.toBeNull();
    await expect(attempt?.settled).resolves.toEqual({ ok: true, value: 'saved' });
    expect(coordinator.getState()).toEqual({ status: 'idle' });
  });

  it('returns a thrown error as a failed result', async () => {
    const coordinator = createSaveCoordinator();
    const failure = new Error('database is locked');

    const attempt = coordinator.run(async () => {
      throw failure;
    });

    await expect(attempt?.settled).resolves.toEqual({ ok: false, error: failure });
    expect(coordinator.getState()).toEqual({ status: 'idle' });
  });

  it('refuses a second save while one is in flight', async () => {
    const coordinator = createSaveCoordinator();
    const pending = deferred<string>();
    const second = jest.fn(async () => 'second');

    const first = coordinator.run(() => pending.promise);
    expect(coordinator.run(second)).toBeNull();
    expect(second).not.toHaveBeenCalled();

    pending.resolve('first');
    await first?.settled;
    expect(coordinator.run(async () => 'third')).not.toBeNull();
  });

  it('gives each attempt its own id', async () => {
    const coordinator = createSaveCoordinator();
    const first = coordinator.run(async () => 1);
    await first?.settled;
    const second = coordinator.run(async () => 2);

    expect(first?.attemptId).not.toBe(second?.attemptId);
  });

  it('flags a slow save after the notice threshold without cancelling it', async () => {
    jest.useFakeTimers();
    const coordinator = createSaveCoordinator();
    const pending = deferred<string>();
    const attempt = coordinator.run(() => pending.promise);
    const attemptId = attempt?.attemptId;

    jest.advanceTimersByTime(SLOW_SAVE_NOTICE_MS - 1);
    expect(coordinator.getState()).toEqual({ status: 'saving', attemptId, slow: false });

    jest.advanceTimersByTime(1);
    expect(coordinator.getState()).toEqual({ status: 'saving', attemptId, slow: true });

    pending.resolve('saved late');
    await expect(attempt?.settled).resolves.toEqual({ ok: true, value: 'saved late' });
    expect(coordinator.getState()).toEqual({ status: 'idle' });
  });

  it('does not flag a save that finished before the threshold', async () => {
    jest.useFakeTimers();
    const coordinator = createSaveCoordinator();
    const attempt = coordinator.run(async () => 'saved');
    await attempt?.settled;

    jest.advanceTimersByTime(SLOW_SAVE_NOTICE_MS * 2);
    expect(coordinator.getState()).toEqual({ status: 'idle' });
  });

  it('notifies subscribers on every state change until they unsubscribe', async () => {
    const coordinator = createSaveCoordinator();
    const listener = jest.fn();
    const unsubscribe = coordinator.subscribe(listener);

    const attempt = coordinator.run(async () => 'saved');
    await attempt?.settled;
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    await coordinator.run(async () => 'again')?.settled;
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('resolves whenIdle immediately when idle and after the save when busy', async () => {
    const coordinator = createSaveCoordinator();
    await expect(coordinator.whenIdle()).resolves.toBeUndefined();

    const pending = deferred<string>();
    coordinator.run(() => pending.promise);
    let idle = false;
    void coordinator.whenIdle().then(() => {
      idle = true;
    });

    await flushPromises();
    expect(idle).toBe(false);

    pending.resolve('saved');
    await flushPromises();
    expect(idle).toBe(true);
  });
});
