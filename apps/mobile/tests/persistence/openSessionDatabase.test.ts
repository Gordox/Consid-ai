import type { SessionDatabase } from '../../src/persistence/database';
import { openSessionDatabase } from '../../src/persistence/openSessionDatabase';
import { FakeDatabase } from './fakeDatabase';

// Verifies ordering and error handling only. Opening a real expo-sqlite database and closing
// it natively are checked on the device in step 7.

class ClosableFakeDatabase extends FakeDatabase {
  closeCalls = 0;

  constructor(private readonly closeError?: unknown) {
    super(() => undefined);
  }

  async closeAsync(): Promise<void> {
    this.closeCalls += 1;
    if (this.closeError !== undefined) {
      throw this.closeError;
    }
  }
}

describe('openSessionDatabase', () => {
  it('opens, migrates and returns the connection without closing it', async () => {
    const db = new ClosableFakeDatabase();
    const migrate = jest.fn(async (_db: SessionDatabase) => undefined);
    const reportCloseFailure = jest.fn();

    await expect(
      openSessionDatabase({ open: async () => db, migrate, reportCloseFailure }),
    ).resolves.toBe(db);

    expect(migrate).toHaveBeenCalledWith(db);
    expect(db.closeCalls).toBe(0);
    expect(reportCloseFailure).not.toHaveBeenCalled();
  });

  it('closes the connection and rethrows the original error when migration fails', async () => {
    const db = new ClosableFakeDatabase();
    const migrationError = new Error('migration failed');
    const reportCloseFailure = jest.fn();

    const error = await openSessionDatabase({
      open: async () => db,
      migrate: async () => {
        throw migrationError;
      },
      reportCloseFailure,
    }).catch((caught: unknown) => caught);

    expect(error).toBe(migrationError);
    expect(db.closeCalls).toBe(1);
    expect(reportCloseFailure).not.toHaveBeenCalled();
  });

  it('keeps the migration error and reports a failed close separately', async () => {
    const closeError = new Error('close failed');
    const db = new ClosableFakeDatabase(closeError);
    const migrationError = new Error('migration failed');
    const reportCloseFailure = jest.fn();

    const error = await openSessionDatabase({
      open: async () => db,
      migrate: async () => {
        throw migrationError;
      },
      reportCloseFailure,
    }).catch((caught: unknown) => caught);

    expect(error).toBe(migrationError);
    expect(reportCloseFailure).toHaveBeenCalledWith(closeError);
  });

  it('passes an open failure through without migrating', async () => {
    const openError = new Error('open failed');
    const migrate = jest.fn(async (_db: SessionDatabase) => undefined);

    await expect(
      openSessionDatabase({
        open: async () => {
          throw openError;
        },
        migrate,
        reportCloseFailure: jest.fn(),
      }),
    ).rejects.toBe(openError);
    expect(migrate).not.toHaveBeenCalled();
  });
});
