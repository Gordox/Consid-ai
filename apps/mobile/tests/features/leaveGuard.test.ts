import { createLeaveGuard, type SaveOutcome } from '../../src/features/leaveGuard';
import { deferred, flushPromises } from '../support/async';

// A manual clock: the test decides when the wait threshold passes.
function guardWithClock() {
  const timers: (() => void)[] = [];
  const guard = createLeaveGuard({
    waitMs: 8000,
    schedule: (callback) => {
      let live = true;
      timers.push(() => {
        if (live) callback();
      });
      return () => {
        live = false;
      };
    },
  });
  const passThreshold = () => timers.splice(0).forEach((fire) => fire());
  return { guard, passThreshold };
}

describe('createLeaveGuard', () => {
  it('leaves at once when nothing is pending', () => {
    const { guard } = guardWithClock();
    const navigate = jest.fn();
    guard.request(null, navigate);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('waits for pending work and leaves once it is saved', async () => {
    const { guard } = guardWithClock();
    const work = deferred<SaveOutcome>();
    const navigate = jest.fn();
    guard.request(work.promise, navigate);
    expect(navigate).not.toHaveBeenCalled();
    expect(guard.dialog()).toBeNull();
    work.resolve('saved');
    await flushPromises();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('offers Stay or Leave after the threshold without navigating or stopping the work', async () => {
    const { guard, passThreshold } = guardWithClock();
    const work = deferred<SaveOutcome>();
    const navigate = jest.fn();
    guard.request(work.promise, navigate);
    passThreshold();
    expect(guard.dialog()).toBe('stillSaving');
    expect(navigate).not.toHaveBeenCalled();
    guard.leaveAnyway();
    expect(navigate).toHaveBeenCalledTimes(1);
    // The work ending later does not navigate a second time.
    work.resolve('saved');
    await flushPromises();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('never acts on an earlier request after Stay', async () => {
    const { guard, passThreshold } = guardWithClock();
    const work = deferred<SaveOutcome>();
    const navigate = jest.fn();
    guard.request(work.promise, navigate);
    passThreshold();
    guard.stay();
    work.resolve('saved');
    await flushPromises();
    expect(navigate).not.toHaveBeenCalled();
    expect(guard.dialog()).toBeNull();
  });

  it('asks when the work definitely failed, and Stay keeps the screen', async () => {
    const { guard } = guardWithClock();
    const work = deferred<SaveOutcome>();
    const navigate = jest.fn();
    guard.request(work.promise, navigate);
    work.resolve('failed');
    await flushPromises();
    expect(guard.dialog()).toBe('notSaved');
    guard.stay();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("navigates once when the screen's own completion and a leave meet", async () => {
    const { guard } = guardWithClock();
    const work = deferred<SaveOutcome>();
    const requested = jest.fn();
    const own = jest.fn();
    guard.request(work.promise, requested);
    guard.complete(own);
    work.resolve('saved');
    await flushPromises();
    expect(requested).toHaveBeenCalledTimes(1);
    expect(own).not.toHaveBeenCalled();
    guard.complete(own);
    expect(own).not.toHaveBeenCalled();
  });

  it('does nothing once the screen was left another way', async () => {
    const { guard } = guardWithClock();
    guard.markLeft();
    const navigate = jest.fn();
    guard.complete(navigate);
    guard.request(null, navigate);
    expect(navigate).not.toHaveBeenCalled();
  });
});
