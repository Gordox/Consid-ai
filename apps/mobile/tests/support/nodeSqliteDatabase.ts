import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SQLiteBindParams } from 'expo-sqlite';

import type { SessionDatabase } from '../../src/persistence/database';

// Runs the app's SQL on Node's built-in SQLite, so migrations and repositories are checked
// against real tables, constraints and transactions. It is a different SQLite build from the
// phone's (expo-sqlite), and WAL is not used in memory, so device behaviour still needs the S20.

function toValues(params: SQLiteBindParams): SQLInputValue[] {
  if (!Array.isArray(params)) {
    throw new Error('Tests bind positional parameters only');
  }
  return params.map((value: unknown): SQLInputValue => {
    if (value === null || typeof value === 'number' || typeof value === 'string') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    throw new Error(`Unsupported bind value: ${typeof value}`);
  });
}

export function openNodeSqlite(): SessionDatabase & { readonly raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  let inTransaction = false;
  const db: SessionDatabase & { readonly raw: DatabaseSync } = {
    raw,
    async execAsync(source) {
      raw.exec(source);
    },
    async runAsync(source, params) {
      const result = raw.prepare(source).run(...toValues(params));
      return { changes: Number(result.changes) };
    },
    async getFirstAsync(source, params) {
      return raw.prepare(source).get(...toValues(params)) ?? null;
    },
    async getAllAsync(source, params) {
      return raw.prepare(source).all(...toValues(params));
    },
    async withExclusiveTransactionAsync(task) {
      if (inTransaction) {
        throw new Error('Nested transaction');
      }
      inTransaction = true;
      raw.exec('BEGIN EXCLUSIVE');
      try {
        await task(db);
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      } finally {
        inTransaction = false;
      }
    },
  };
  return db;
}
