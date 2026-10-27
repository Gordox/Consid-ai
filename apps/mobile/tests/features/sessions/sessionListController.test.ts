import type { Session } from '../../../src/domain/session/session';
import { createSaveCoordinator } from '../../../src/features/sessions/saveCoordinator';
import { createSessionListController } from '../../../src/features/sessions/sessionListController';
import type { SessionListing } from '../../../src/persistence/sessionRepository';
import { type Deferred, deferred, flushPromises } from '../../support/async';

// Logic tests with controlled promises and the real save coordinator. They do not prove that the
// SessionList screen wires focus, FlatList or screen readers correctly; that is checked manually.

function session(id: string, createdAtUtc: string): Session {
  return {
    id,
    createdAtUtc,
    createdTimeZone: 'Europe/Stockholm',
    settings: {
      firearmName: 'Glock 17',
      firearmType: 'pistol',
      calibreLabel: '9×19 mm',
      distanceMetres: 25,
      plannedShotsPerRound: 10,
      plannedRounds: null,
    },
  };
}

const FIRST: SessionListing = {
  sessions: [session('3f2504e0-4f89-41d3-9a0c-0305e82c3301', '2026-10-27T13:00:00.000Z')],
  invalidRows: [],
};
const SECOND: SessionListing = {
  sessions: [
    session('6ba7b810-9dad-41d1-80b4-00c04fd430c8', '2026-10-27T14:00:00.000Z'),
    ...FIRST.sessions,
  ],
  invalidRows: [],
};
const EMPTY: SessionListing = { sessions: [], invalidRows: [] };

function createHarness() {
  const reads: Deferred<SessionListing>[] = [];
  const coordinator = createSaveCoordinator();
  const controller = createSessionListController({
    coordinator,
    loadSessions: () => {
      const read = deferred<SessionListing>();
      reads.push(read);
      return read.promise;
    },
  });
  return { controller, coordinator, reads };
}

describe('createSessionListController: first load', () => {
  it('does not read before the list is active', () => {
    const { controller, reads } = createHarness();
    expect(controller.getView()).toEqual({ status: 'initialLoading' });
    expect(reads).toHaveLength(0);
  });

  it('shows the listing after a successful first read', async () => {
    const { controller, reads } = createHarness();
    controller.setActive(true);
    expect(reads).toHaveLength(1);

    reads[0]?.resolve(FIRST);
    await flushPromises();

    expect(controller.getView()).toEqual({
      status: 'loaded',
      listing: FIRST,
      refreshing: false,
      refreshFailed: false,
    });
  });

  it('reaches an empty listing only through a successful read', async () => {
    const { controller, reads } = createHarness();
    controller.setActive(true);
    reads[0]?.resolve(EMPTY);
    await flushPromises();

    expect(controller.getView()).toEqual({
      status: 'loaded',
      listing: EMPTY,
      refreshing: false,
      refreshFailed: false,
    });
  });

  it('shows a read failure, never an empty list, when the first read fails', async () => {
    const { controller, reads } = createHarness();
    controller.setActive(true);
    reads[0]?.reject(new Error('no such table: sessions'));
    await flushPromises();

    expect(controller.getView()).toEqual({ status: 'initialFailed' });
  });

  it('retries after a failed first read', async () => {
    const { controller, reads } = createHarness();
    controller.setActive(true);
    reads[0]?.reject(new Error('disk I/O error'));
    await flushPromises();

    controller.retry();
    expect(controller.getView()).toEqual({ status: 'initialLoading' });
    reads[1]?.resolve(FIRST);
    await flushPromises();

    expect(controller.getView().status).toBe('loaded');
  });
});

describe('createSessionListController: reloads', () => {
  async function loadedHarness() {
    const harness = createHarness();
    harness.controller.setActive(true);
    harness.reads[0]?.resolve(FIRST);
    await flushPromises();
    return harness;
  }

  it('keeps the earlier listing while reloading', async () => {
    const { controller, reads } = await loadedHarness();
    controller.retry();

    expect(controller.getView()).toEqual({
      status: 'loaded',
      listing: FIRST,
      refreshing: true,
      refreshFailed: false,
    });

    reads[1]?.resolve(SECOND);
    await flushPromises();
    expect(controller.getView()).toEqual({
      status: 'loaded',
      listing: SECOND,
      refreshing: false,
      refreshFailed: false,
    });
  });

  it('keeps the earlier listing and flags the failure when a reload fails', async () => {
    const { controller, reads } = await loadedHarness();
    controller.retry();
    reads[1]?.reject(new Error('database is locked'));
    await flushPromises();

    expect(controller.getView()).toEqual({
      status: 'loaded',
      listing: FIRST,
      refreshing: false,
      refreshFailed: true,
    });

    controller.retry();
    reads[2]?.resolve(SECOND);
    await flushPromises();
    expect(controller.getView()).toEqual({
      status: 'loaded',
      listing: SECOND,
      refreshing: false,
      refreshFailed: false,
    });
  });

  it('collapses many requests during a read into one pending reload', async () => {
    const { controller, reads } = createHarness();
    controller.setActive(true);
    controller.retry();
    controller.retry();
    controller.retry();
    expect(reads).toHaveLength(1);

    reads[0]?.resolve(FIRST);
    await flushPromises();
    expect(reads).toHaveLength(2);

    reads[1]?.resolve(SECOND);
    await flushPromises();
    expect(reads).toHaveLength(2);
    expect(controller.getView()).toMatchObject({ status: 'loaded', listing: SECOND });
  });
});

describe('createSessionListController: lifecycle', () => {
  it('does not overlap reads or publish a stale result after leaving and returning', async () => {
    const { controller, reads } = createHarness();
    controller.setActive(true);
    controller.setActive(false);
    controller.setActive(true);

    // The first read is still running, so the read for the return waits.
    expect(reads).toHaveLength(1);

    reads[0]?.resolve(FIRST);
    await flushPromises();
    expect(controller.getView()).toEqual({ status: 'initialLoading' });
    expect(reads).toHaveLength(2);

    reads[1]?.resolve(SECOND);
    await flushPromises();
    expect(controller.getView()).toMatchObject({ status: 'loaded', listing: SECOND });
  });

  it('ignores a late result after dispose, including after resume', async () => {
    const { controller, reads } = createHarness();
    const listener = jest.fn();
    controller.subscribe(listener);
    controller.setActive(true);
    controller.dispose();
    controller.resume();
    controller.setActive(true);
    expect(reads).toHaveLength(1);
    listener.mockClear();

    reads[0]?.resolve(FIRST);
    await flushPromises();
    expect(controller.getView().status).not.toBe('loaded');
    expect(reads).toHaveLength(2);

    reads[1]?.resolve(SECOND);
    await flushPromises();
    expect(controller.getView()).toMatchObject({ status: 'loaded', listing: SECOND });
  });

  it('does not read again when activated twice without leaving', () => {
    const { controller, reads } = createHarness();
    controller.setActive(true);
    controller.setActive(true);
    expect(reads).toHaveLength(1);
  });
});

describe('createSessionListController: saves', () => {
  async function runSave(coordinator: ReturnType<typeof createSaveCoordinator>) {
    const save = deferred<'saved'>();
    const attempt = coordinator.run(() => save.promise);
    return { save, attempt };
  }

  it('reloads an active list when a save finishes', async () => {
    const { controller, coordinator, reads } = createHarness();
    controller.setActive(true);
    reads[0]?.resolve(FIRST);
    await flushPromises();

    const { save, attempt } = await runSave(coordinator);
    expect(reads).toHaveLength(1);
    save.resolve('saved');
    await attempt?.settled;
    await flushPromises();

    expect(reads).toHaveLength(2);
    reads[1]?.resolve(SECOND);
    await flushPromises();
    expect(controller.getView()).toMatchObject({ status: 'loaded', listing: SECOND });
  });

  it('does not read while inactive, and reads once on return', async () => {
    const { controller, coordinator, reads } = createHarness();
    controller.setActive(true);
    reads[0]?.resolve(FIRST);
    await flushPromises();
    controller.setActive(false);

    const { save, attempt } = await runSave(coordinator);
    save.resolve('saved');
    await attempt?.settled;
    await flushPromises();
    expect(reads).toHaveLength(1);

    controller.setActive(true);
    expect(reads).toHaveLength(2);
  });

  it('does not double the reload after repeated activation, resume and dispose', async () => {
    const { controller, coordinator, reads } = createHarness();
    controller.resume();
    controller.dispose();
    controller.resume();
    controller.resume();
    controller.setActive(true);
    controller.setActive(true);
    reads[0]?.resolve(FIRST);
    await flushPromises();

    const { save, attempt } = await runSave(coordinator);
    save.resolve('saved');
    await attempt?.settled;
    await flushPromises();

    expect(reads).toHaveLength(2);
  });

  it('does not reload when the coordinator only reports a slow save', async () => {
    jest.useFakeTimers();
    try {
      const { controller, coordinator, reads } = createHarness();
      controller.setActive(true);
      reads[0]?.resolve(FIRST);
      await flushPromises();

      const { save } = await runSave(coordinator);
      jest.advanceTimersByTime(10_000);
      expect(coordinator.getState()).toMatchObject({ status: 'saving', slow: true });
      expect(reads).toHaveLength(1);
      save.resolve('saved');
      await flushPromises();
      expect(reads).toHaveLength(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('reloads after a failed save too, since the result is uncertain', async () => {
    const { controller, coordinator, reads } = createHarness();
    controller.setActive(true);
    reads[0]?.resolve(FIRST);
    await flushPromises();

    const { save, attempt } = await runSave(coordinator);
    save.reject(new Error('disk I/O error'));
    await attempt?.settled;
    await flushPromises();

    expect(reads).toHaveLength(2);
  });
});
