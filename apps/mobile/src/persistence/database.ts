import type { SQLiteBindParams, SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'target-practice.db';

// The narrow part of an expo-sqlite connection that the persistence layer uses.
// Reads return unknown so every value from the database is validated at runtime,
// and test fakes can implement this type without casts.
export type SessionDatabase = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SQLiteBindParams): Promise<{ readonly changes: number }>;
  getFirstAsync(source: string, params: SQLiteBindParams): Promise<unknown>;
  getAllAsync(source: string, params: SQLiteBindParams): Promise<unknown[]>;
  withExclusiveTransactionAsync(task: (txn: SessionDatabase) => Promise<void>): Promise<void>;
};

// Compile-time proof, without a cast, that a real connection satisfies SessionDatabase.
// Step 4 uses it when SQLiteProvider hands over the connection.
export function asSessionDatabase(db: SQLiteDatabase): SessionDatabase {
  return db;
}

// The database is in a state the app's own writes should never produce.
export class DatabaseStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseStateError';
  }
}
