import type { SessionDatabase } from './database';
import { migrateDatabase } from './migrations';

export type ClosableSessionDatabase = SessionDatabase & {
  closeAsync(): Promise<void>;
};

export type OpenSessionDatabaseDeps = {
  open: () => Promise<ClosableSessionDatabase>;
  migrate?: (db: SessionDatabase) => Promise<void>;
  // A close failure after a failed migration is reported here; the migration error is kept.
  reportCloseFailure: (error: unknown) => void;
};

// Opens and migrates the database. On a migration failure the connection is closed before the
// original error is rethrown, so a retry never leaves an earlier connection open.
export async function openSessionDatabase(
  deps: OpenSessionDatabaseDeps,
): Promise<ClosableSessionDatabase> {
  const migrate = deps.migrate ?? migrateDatabase;
  const db = await deps.open();
  try {
    await migrate(db);
    return db;
  } catch (migrationError) {
    try {
      await db.closeAsync();
    } catch (closeError) {
      deps.reportCloseFailure(closeError);
    }
    throw migrationError;
  }
}
