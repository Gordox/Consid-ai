import type { SQLiteBindParams } from 'expo-sqlite';

import type { SessionDatabase } from '../../src/persistence/database';

// A recording stand-in for SessionDatabase. It answers through a responder function and
// verifies only call order and orchestration. It does not run SQL, so it says nothing about
// SQL syntax, CHECK/STRICT constraints, native transactions, rollback, locking or binding.

export type Connection = 'main' | 'transaction';

export type DatabaseCall =
  | { readonly connection: Connection; readonly method: 'exec'; readonly sql: string }
  | {
      readonly connection: Connection;
      readonly method: 'run' | 'getFirst' | 'getAll';
      readonly sql: string;
      readonly params: SQLiteBindParams;
    }
  | { readonly connection: 'main'; readonly method: 'begin' | 'commit' | 'rollback' };

export type Responder = (call: DatabaseCall) => unknown;

function isRunResult(value: unknown): value is { readonly changes: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'changes' in value &&
    typeof value.changes === 'number'
  );
}

export class FakeDatabase implements SessionDatabase {
  constructor(
    private readonly respond: Responder,
    readonly calls: DatabaseCall[] = [],
    private readonly connection: Connection = 'main',
  ) {}

  private record(call: DatabaseCall): unknown {
    this.calls.push(call);
    return this.respond(call);
  }

  async execAsync(sql: string): Promise<void> {
    this.record({ connection: this.connection, method: 'exec', sql });
  }

  async runAsync(sql: string, params: SQLiteBindParams): Promise<{ readonly changes: number }> {
    const result = this.record({ connection: this.connection, method: 'run', sql, params });
    if (!isRunResult(result)) {
      throw new Error('FakeDatabase responder must return { changes: number } for runAsync');
    }
    return result;
  }

  async getFirstAsync(sql: string, params: SQLiteBindParams): Promise<unknown> {
    return this.record({ connection: this.connection, method: 'getFirst', sql, params });
  }

  async getAllAsync(sql: string, params: SQLiteBindParams): Promise<unknown[]> {
    const result = this.record({ connection: this.connection, method: 'getAll', sql, params });
    if (!Array.isArray(result)) {
      throw new Error('FakeDatabase responder must return an array for getAllAsync');
    }
    return result;
  }

  async withExclusiveTransactionAsync(
    task: (txn: SessionDatabase) => Promise<void>,
  ): Promise<void> {
    this.record({ connection: 'main', method: 'begin' });
    try {
      await task(new FakeDatabase(this.respond, this.calls, 'transaction'));
    } catch (error) {
      this.record({ connection: 'main', method: 'rollback' });
      throw error;
    }
    this.record({ connection: 'main', method: 'commit' });
  }
}
