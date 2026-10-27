import {
  ConnectionClosingError,
  trackConnection,
} from '../../../src/features/startup/trackedConnection';
import { FakeDatabase } from '../../persistence/fakeDatabase';
import { type Deferred, deferred, flushPromises } from '../../support/async';

// A connection whose reads wait for the test, so a read can be in flight during close().
class ControlledDatabase extends FakeDatabase {
  readonly reads: Deferred<unknown[]>[] = [];
  closeCalls = 0;

  constructor() {
    super(() => undefined);
  }

  getAllAsync(): Promise<unknown[]> {
    const read = deferred<unknown[]>();
    this.reads.push(read);
    return read.promise;
  }

  async closeAsync(): Promise<void> {
    this.closeCalls += 1;
  }
}

describe('trackConnection', () => {
  it('passes operations through to the connection', async () => {
    const connection = new ControlledDatabase();
    const tracked = trackConnection(connection);

    await tracked.db.execAsync('SELECT 1');
    const read = tracked.db.getAllAsync('SELECT 2', []);
    connection.reads[0]?.resolve([{ value: 2 }]);

    await expect(read).resolves.toEqual([{ value: 2 }]);
    expect(connection.calls).toEqual([{ connection: 'main', method: 'exec', sql: 'SELECT 1' }]);
  });

  it('waits for a running read before closing', async () => {
    const connection = new ControlledDatabase();
    const tracked = trackConnection(connection);

    const read = tracked.db.getAllAsync('SELECT 1', []);
    const closed = tracked.close();
    await flushPromises();
    expect(connection.closeCalls).toBe(0);

    connection.reads[0]?.resolve([]);
    await expect(read).resolves.toEqual([]);
    await closed;
    expect(connection.closeCalls).toBe(1);
  });

  it('also waits for a read that fails', async () => {
    const connection = new ControlledDatabase();
    const tracked = trackConnection(connection);
    const failure = new Error('read failed');

    const read = tracked.db.getAllAsync('SELECT 1', []);
    const closed = tracked.close();
    connection.reads[0]?.reject(failure);

    await expect(read).rejects.toBe(failure);
    await closed;
    expect(connection.closeCalls).toBe(1);
  });

  it('refuses new operations once closing has started', async () => {
    const connection = new ControlledDatabase();
    const tracked = trackConnection(connection);

    const closed = tracked.close();

    await expect(tracked.db.getAllAsync('SELECT 1', [])).rejects.toBeInstanceOf(
      ConnectionClosingError,
    );
    await expect(tracked.db.runAsync('INSERT', [])).rejects.toBeInstanceOf(ConnectionClosingError);
    await closed;
    expect(connection.reads).toHaveLength(0);
    expect(connection.calls).toEqual([]);
    expect(connection.closeCalls).toBe(1);
  });

  it('closes at once when nothing is running', async () => {
    const connection = new ControlledDatabase();
    const tracked = trackConnection(connection);

    await tracked.close();

    expect(connection.closeCalls).toBe(1);
  });
});
