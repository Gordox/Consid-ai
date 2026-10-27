import type { SQLiteBindParams } from 'expo-sqlite';

import type { SessionDatabase } from '../../persistence/database';
import type { ClosableSessionDatabase } from '../../persistence/openSessionDatabase';

// An operation was started on a connection that is closing, e.g. after a database switch.
export class ConnectionClosingError extends Error {
  constructor() {
    super('The database connection is closing and accepts no new operations');
    this.name = 'ConnectionClosingError';
  }
}

export type TrackedConnection = {
  // Hand this to the screens; every call is counted while it runs.
  readonly db: SessionDatabase;
  // Refuses new operations, waits for running ones to settle, then closes the connection.
  close(): Promise<void>;
};

// Lets the lifecycle close a connection only after reads and writes that already started
// have settled. Each call is one native operation; a multi-statement save is covered
// separately by waiting for the save coordinator before close() is called.
export function trackConnection(connection: ClosableSessionDatabase): TrackedConnection {
  let running = 0;
  let closing = false;
  let settledWaiters: (() => void)[] = [];

  async function track<T>(operation: () => Promise<T>): Promise<T> {
    if (closing) {
      throw new ConnectionClosingError();
    }
    running += 1;
    try {
      return await operation();
    } finally {
      running -= 1;
      if (running === 0) {
        const waiters = settledWaiters;
        settledWaiters = [];
        for (const resolve of waiters) {
          resolve();
        }
      }
    }
  }

  const db: SessionDatabase = {
    execAsync: (source: string) => track(() => connection.execAsync(source)),
    runAsync: (source: string, params: SQLiteBindParams) =>
      track(() => connection.runAsync(source, params)),
    getFirstAsync: (source: string, params: SQLiteBindParams) =>
      track(() => connection.getFirstAsync(source, params)),
    getAllAsync: (source: string, params: SQLiteBindParams) =>
      track(() => connection.getAllAsync(source, params)),
    withExclusiveTransactionAsync: (task: (txn: SessionDatabase) => Promise<void>) =>
      track(() => connection.withExclusiveTransactionAsync(task)),
  };

  return {
    db,
    async close() {
      closing = true;
      if (running > 0) {
        await new Promise<void>((resolve) => {
          settledWaiters.push(resolve);
        });
      }
      await connection.closeAsync();
    },
  };
}
