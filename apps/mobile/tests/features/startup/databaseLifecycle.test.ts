import { createSaveCoordinator } from '../../../src/features/sessions/saveCoordinator';
import {
  classifyStartupError,
  createDatabaseLifecycle,
  type DatabaseLifecycle,
  type DatabaseLifecycleDeps,
  type DatabaseMode,
  type SessionStore,
} from '../../../src/features/startup/databaseLifecycle';
import { ConnectionClosingError } from '../../../src/features/startup/trackedConnection';
import type { SessionDatabase } from '../../../src/persistence/database';
import {
  DatabaseVersionTooNewError,
  MigrationFailedError,
} from '../../../src/persistence/migrations';
import type { ClosableSessionDatabase } from '../../../src/persistence/openSessionDatabase';
import { FakeDatabase } from '../../persistence/fakeDatabase';
import { type Deferred, deferred, flushPromises } from '../../support/async';

// Verifies the lifecycle logic behind DatabaseGate. It does not render React or open a real
// database; native opening and closing are checked on the device in step 7.

class ClosableFakeDatabase extends FakeDatabase {
  closeCalls = 0;
  readonly reads: Deferred<unknown[]>[] = [];

  constructor(private readonly closeError?: unknown) {
    super(() => undefined);
  }

  // Reads wait for the test, so one can be in flight during a mode switch.
  getAllAsync(): Promise<unknown[]> {
    const read = deferred<unknown[]>();
    this.reads.push(read);
    return read.promise;
  }

  async closeAsync(): Promise<void> {
    this.closeCalls += 1;
    if (this.closeError !== undefined) {
      throw this.closeError;
    }
  }
}

type Harness = {
  deps: DatabaseLifecycleDeps;
  opens: Deferred<ClosableSessionDatabase>[];
  openedModes: DatabaseMode[];
  reported: unknown[];
};

// Every call to openAndMigrate waits for a deferred that the test settles.
function createHarness(): Harness {
  const opens: Deferred<ClosableSessionDatabase>[] = [];
  const openedModes: DatabaseMode[] = [];
  const reported: unknown[] = [];
  return {
    opens,
    openedModes,
    reported,
    deps: {
      openAndMigrate: (mode) => {
        const open = deferred<ClosableSessionDatabase>();
        opens.push(open);
        openedModes.push(mode);
        return open.promise;
      },
      photoFolderFor: (mode) => `photos-${mode}`,
      createCoordinator: () => createSaveCoordinator(),
      reportError: (error) => {
        reported.push(error);
      },
    },
  };
}

// The store hands out a tracked wrapper, so identity is checked by delegation instead.
async function expectStoreUses(storeDb: SessionDatabase, db: ClosableFakeDatabase): Promise<void> {
  const sql = `SELECT ${db.calls.length + 1}`;
  await storeDb.execAsync(sql);
  expect(db.calls.at(-1)).toEqual({ connection: 'main', method: 'exec', sql });
}

function readyStore(lifecycle: DatabaseLifecycle): SessionStore {
  const state = lifecycle.getState();
  if (state.status !== 'ready') {
    throw new Error(`expected ready, got ${state.status}`);
  }
  return state.store;
}

async function openReady(
  harness: Harness,
  lifecycle: DatabaseLifecycle,
  index: number,
  db: ClosableFakeDatabase,
): Promise<SessionStore> {
  await flushPromises();
  harness.opens[index]?.resolve(db);
  await flushPromises();
  return readyStore(lifecycle);
}

describe('createDatabaseLifecycle', () => {
  it('starts loading and becomes ready with a store', async () => {
    const harness = createHarness();
    const lifecycle = createDatabaseLifecycle(harness.deps);
    const db = new ClosableFakeDatabase();

    lifecycle.activate();
    expect(lifecycle.getState()).toEqual({ status: 'loading' });

    await flushPromises();
    harness.opens[0]?.resolve(db);
    await flushPromises();

    await expectStoreUses(readyStore(lifecycle).db, db);
    expect(db.closeCalls).toBe(0);
  });

  it('fails with a classified error and recovers on Retry', async () => {
    const harness = createHarness();
    const lifecycle = createDatabaseLifecycle(harness.deps);
    const failure = new MigrationFailedError(1, new Error('syntax error'));

    lifecycle.activate();
    await flushPromises();
    harness.opens[0]?.reject(failure);
    await flushPromises();

    expect(lifecycle.getState()).toEqual({ status: 'failed', errorKind: 'other' });
    expect(harness.reported).toEqual([failure]);

    lifecycle.retry();
    expect(lifecycle.getState()).toEqual({ status: 'loading' });
    await flushPromises();
    harness.opens[1]?.resolve(new ClosableFakeDatabase());
    await flushPromises();

    expect(lifecycle.getState().status).toBe('ready');
  });

  it('ignores Retry unless initialisation has failed', async () => {
    const harness = createHarness();
    const lifecycle = createDatabaseLifecycle(harness.deps);

    lifecycle.activate();
    lifecycle.retry();
    lifecycle.activate();
    await flushPromises();

    expect(harness.opens).toHaveLength(1);
  });

  it('skips an initialisation that was cancelled before it started (StrictMode remount)', async () => {
    const harness = createHarness();
    const lifecycle = createDatabaseLifecycle(harness.deps);

    lifecycle.activate();
    lifecycle.deactivate();
    lifecycle.activate();
    await flushPromises();

    expect(harness.opens).toHaveLength(1);
    harness.opens[0]?.resolve(new ClosableFakeDatabase());
    await flushPromises();
    expect(lifecycle.getState().status).toBe('ready');
  });

  it('never overlaps two initialisations and closes the abandoned connection', async () => {
    const harness = createHarness();
    const lifecycle = createDatabaseLifecycle(harness.deps);
    const abandoned = new ClosableFakeDatabase();

    lifecycle.activate();
    await flushPromises();
    expect(harness.opens).toHaveLength(1);

    lifecycle.deactivate();
    lifecycle.activate();
    await flushPromises();
    // The first open/migrate is still running, so the second must wait.
    expect(harness.opens).toHaveLength(1);

    harness.opens[0]?.resolve(abandoned);
    await flushPromises();
    expect(abandoned.closeCalls).toBe(1);
    expect(harness.opens).toHaveLength(2);

    const current = new ClosableFakeDatabase();
    harness.opens[1]?.resolve(current);
    await flushPromises();
    await expectStoreUses(readyStore(lifecycle).db, current);
    expect(current.closeCalls).toBe(0);
  });

  it('closes a connection that finishes opening after deactivation', async () => {
    const harness = createHarness();
    const lifecycle = createDatabaseLifecycle(harness.deps);
    const late = new ClosableFakeDatabase();
    const listener = jest.fn();

    lifecycle.activate();
    await flushPromises();
    lifecycle.subscribe(listener);
    lifecycle.deactivate();
    harness.opens[0]?.resolve(late);
    await flushPromises();

    expect(late.closeCalls).toBe(1);
    expect(lifecycle.getState().status).not.toBe('ready');
    expect(listener).not.toHaveBeenCalled();
  });

  it('waits for an in-flight save before closing the connection', async () => {
    const harness = createHarness();
    const lifecycle = createDatabaseLifecycle(harness.deps);
    const db = new ClosableFakeDatabase();

    lifecycle.activate();
    await flushPromises();
    harness.opens[0]?.resolve(db);
    await flushPromises();
    const state = lifecycle.getState();
    if (state.status !== 'ready') {
      throw new Error('expected ready');
    }
    const save = deferred<string>();
    state.store.coordinator.run(() => save.promise);

    lifecycle.deactivate();
    await flushPromises();
    expect(db.closeCalls).toBe(0);

    save.resolve('saved');
    await flushPromises();
    expect(db.closeCalls).toBe(1);
  });

  it('reports a failed close without throwing', async () => {
    const harness = createHarness();
    const lifecycle = createDatabaseLifecycle(harness.deps);
    const closeError = new Error('close failed');

    lifecycle.activate();
    await flushPromises();
    harness.opens[0]?.resolve(new ClosableFakeDatabase(closeError));
    await flushPromises();
    lifecycle.deactivate();
    await flushPromises();

    expect(harness.reported).toEqual([closeError]);
  });
});

describe('createDatabaseLifecycle: mode switches', () => {
  it('starts in normal mode, as after every full restart', async () => {
    const harness = createHarness();
    const lifecycle = createDatabaseLifecycle(harness.deps);

    expect(lifecycle.getMode()).toBe('normal');
    lifecycle.activate();
    await flushPromises();

    expect(harness.openedModes).toEqual(['normal']);
  });

  it('closes the current connection before opening the other database', async () => {
    const harness = createHarness();
    const lifecycle = createDatabaseLifecycle(harness.deps);
    const normal = new ClosableFakeDatabase();
    const test = new ClosableFakeDatabase();
    lifecycle.activate();
    await openReady(harness, lifecycle, 0, normal);

    lifecycle.switchMode('test');
    expect(lifecycle.getMode()).toBe('test');
    expect(lifecycle.getState()).toEqual({ status: 'loading' });
    await flushPromises();
    expect(normal.closeCalls).toBe(1);
    expect(harness.openedModes).toEqual(['normal', 'test']);

    const store = await openReady(harness, lifecycle, 1, test);
    await expectStoreUses(store.db, test);

    lifecycle.switchMode('normal');
    await flushPromises();
    expect(test.closeCalls).toBe(1);
    expect(harness.openedModes).toEqual(['normal', 'test', 'normal']);
  });

  it('ignores a switch to the mode that is already open', async () => {
    const harness = createHarness();
    const lifecycle = createDatabaseLifecycle(harness.deps);
    const normal = new ClosableFakeDatabase();
    lifecycle.activate();
    await openReady(harness, lifecycle, 0, normal);

    lifecycle.switchMode('normal');
    await flushPromises();

    expect(normal.closeCalls).toBe(0);
    expect(harness.opens).toHaveLength(1);
  });

  it('lets an in-flight save finish on the old connection before it closes', async () => {
    const harness = createHarness();
    const lifecycle = createDatabaseLifecycle(harness.deps);
    const normal = new ClosableFakeDatabase();
    lifecycle.activate();
    const store = await openReady(harness, lifecycle, 0, normal);
    const save = deferred<string>();
    store.coordinator.run(() => save.promise);

    lifecycle.switchMode('test');
    await flushPromises();
    expect(normal.closeCalls).toBe(0);
    expect(harness.opens).toHaveLength(1);

    save.resolve('saved');
    await flushPromises();
    expect(normal.closeCalls).toBe(1);
    expect(harness.openedModes).toEqual(['normal', 'test']);
  });

  it('lets an in-flight read finish before closing, and refuses new operations', async () => {
    const harness = createHarness();
    const lifecycle = createDatabaseLifecycle(harness.deps);
    const normal = new ClosableFakeDatabase();
    lifecycle.activate();
    const store = await openReady(harness, lifecycle, 0, normal);
    const read = store.db.getAllAsync('SELECT 1', []);

    lifecycle.switchMode('test');
    await flushPromises();
    expect(normal.closeCalls).toBe(0);
    expect(harness.opens).toHaveLength(1);
    await expect(store.db.getAllAsync('SELECT 2', [])).rejects.toBeInstanceOf(
      ConnectionClosingError,
    );
    expect(normal.reads).toHaveLength(1);

    normal.reads[0]?.resolve([]);
    await expect(read).resolves.toEqual([]);
    await flushPromises();
    expect(normal.closeCalls).toBe(1);
    expect(harness.openedModes).toEqual(['normal', 'test']);
  });

  it('discards an initialisation that was still running when the mode switched', async () => {
    const harness = createHarness();
    const lifecycle = createDatabaseLifecycle(harness.deps);
    const lateNormal = new ClosableFakeDatabase();
    const test = new ClosableFakeDatabase();
    lifecycle.activate();
    await flushPromises();

    lifecycle.switchMode('test');
    await flushPromises();
    // The normal open is still running, so the test open must wait for it.
    expect(harness.opens).toHaveLength(1);

    harness.opens[0]?.resolve(lateNormal);
    await flushPromises();
    expect(lateNormal.closeCalls).toBe(1);
    expect(lifecycle.getState()).toEqual({ status: 'loading' });

    const store = await openReady(harness, lifecycle, 1, test);
    await expectStoreUses(store.db, test);
    expect(harness.openedModes).toEqual(['normal', 'test']);
  });

  it('does not publish a failure from the earlier mode', async () => {
    const harness = createHarness();
    const lifecycle = createDatabaseLifecycle(harness.deps);
    lifecycle.activate();
    await flushPromises();

    lifecycle.switchMode('test');
    harness.opens[0]?.reject(new Error('normal open failed'));
    await flushPromises();

    expect(lifecycle.getState()).toEqual({ status: 'loading' });
    expect(harness.reported).toEqual([]);
  });

  it('opens nothing more after deactivation', async () => {
    const harness = createHarness();
    const lifecycle = createDatabaseLifecycle(harness.deps);
    const normal = new ClosableFakeDatabase();
    lifecycle.activate();
    await openReady(harness, lifecycle, 0, normal);

    lifecycle.deactivate();
    lifecycle.switchMode('test');
    await flushPromises();

    expect(normal.closeCalls).toBe(1);
    expect(harness.opens).toHaveLength(1);
  });
});

describe('classifyStartupError', () => {
  it('separates a newer database version from other failures', () => {
    expect(classifyStartupError(new DatabaseVersionTooNewError(2, 1))).toBe('newerVersion');
    expect(classifyStartupError(new MigrationFailedError(1, new Error('x')))).toBe('other');
    expect(classifyStartupError(new Error('unknown'))).toBe('other');
    expect(classifyStartupError('not an error')).toBe('other');
  });
});
