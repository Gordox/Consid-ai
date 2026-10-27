import { DatabaseStateError } from '../../src/persistence/database';
import {
  DatabaseVersionTooNewError,
  JournalModeError,
  MIGRATIONS,
  MigrationFailedError,
  migrateDatabase,
} from '../../src/persistence/migrations';
import { type DatabaseCall, FakeDatabase } from './fakeDatabase';

// Simulates user_version and journal mode only. Rollback restores the fake's own version
// counter so later assertions stay coherent; it is not evidence of SQLite rollback.
type FakeState = {
  userVersion: number;
  journalMode: unknown;
  failOnSql?: string;
  versionSeenInTransaction?: number;
};

function createFakeDatabase(state: FakeState): FakeDatabase {
  let versionAtBegin = state.userVersion;
  return new FakeDatabase((call: DatabaseCall) => {
    if (!('sql' in call)) {
      if (call.method === 'begin') versionAtBegin = state.userVersion;
      if (call.method === 'rollback') state.userVersion = versionAtBegin;
      return undefined;
    }
    if (call.sql === 'PRAGMA user_version' && call.method === 'getFirst') {
      const version =
        call.connection === 'transaction' && state.versionSeenInTransaction !== undefined
          ? state.versionSeenInTransaction
          : state.userVersion;
      return { user_version: version };
    }
    if (call.sql === 'PRAGMA journal_mode = WAL') {
      return { journal_mode: state.journalMode };
    }
    const versionAssignment = /^PRAGMA user_version = (\d+)$/.exec(call.sql);
    if (versionAssignment?.[1] !== undefined) {
      state.userVersion = Number(versionAssignment[1]);
      return undefined;
    }
    if (call.sql === state.failOnSql) {
      throw new Error('simulated SQLite error');
    }
    return undefined;
  });
}

function describeCalls(calls: readonly DatabaseCall[]): string[] {
  return calls.map((call) =>
    'sql' in call ? `${call.connection} ${call.method} ${call.sql}` : `${call.method}`,
  );
}

describe('migrateDatabase', () => {
  it('migrates a new database: version check, WAL, then one atomic migration', async () => {
    const state: FakeState = { userVersion: 0, journalMode: 'wal' };
    const db = createFakeDatabase(state);

    await migrateDatabase(db);

    expect(describeCalls(db.calls)).toEqual([
      'main getFirst PRAGMA user_version',
      'main getFirst PRAGMA journal_mode = WAL',
      'begin',
      'transaction getFirst PRAGMA user_version',
      `transaction exec ${MIGRATIONS[0]}`,
      'transaction exec PRAGMA user_version = 1',
      'commit',
    ]);
    expect(state.userVersion).toBe(1);
  });

  it('only checks the version and WAL when the database is up to date', async () => {
    const db = createFakeDatabase({ userVersion: 1, journalMode: 'wal' });

    await migrateDatabase(db);

    expect(describeCalls(db.calls)).toEqual([
      'main getFirst PRAGMA user_version',
      'main getFirst PRAGMA journal_mode = WAL',
    ]);
  });

  it('rejects a newer database before any write, including WAL', async () => {
    const db = createFakeDatabase({ userVersion: 2, journalMode: 'wal' });

    const error = await migrateDatabase(db).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DatabaseVersionTooNewError);
    expect(error).toMatchObject({ databaseVersion: 2, supportedVersion: 1 });
    expect(describeCalls(db.calls)).toEqual(['main getFirst PRAGMA user_version']);
  });

  it.each([
    ['null row', null],
    ['missing column', {}],
    ['text version', { user_version: '1' }],
    ['negative version', { user_version: -1 }],
    ['fractional version', { user_version: 1.5 }],
  ])('rejects a malformed user_version response (%s)', async (_label, response) => {
    const db = new FakeDatabase(() => response);

    await expect(migrateDatabase(db)).rejects.toBeInstanceOf(DatabaseStateError);
    expect(db.calls).toHaveLength(1);
  });

  it('stops with JournalModeError when WAL cannot be enabled', async () => {
    const db = createFakeDatabase({ userVersion: 0, journalMode: 'delete' });

    const error = await migrateDatabase(db).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(JournalModeError);
    expect(error).toMatchObject({ journalMode: 'delete' });
    expect(describeCalls(db.calls)).not.toContain('begin');
  });

  it('rejects a malformed journal_mode response', async () => {
    const db = createFakeDatabase({ userVersion: 0, journalMode: 1 });

    await expect(migrateDatabase(db)).rejects.toBeInstanceOf(DatabaseStateError);
    expect(describeCalls(db.calls)).not.toContain('begin');
  });

  it('applies several pending migrations in order, each in its own transaction', async () => {
    const state: FakeState = { userVersion: 0, journalMode: 'wal' };
    const db = createFakeDatabase(state);

    await migrateDatabase(db, ['CREATE TABLE a (x)', 'CREATE TABLE b (x)']);

    expect(describeCalls(db.calls).slice(2)).toEqual([
      'begin',
      'transaction getFirst PRAGMA user_version',
      'transaction exec CREATE TABLE a (x)',
      'transaction exec PRAGMA user_version = 1',
      'commit',
      'begin',
      'transaction getFirst PRAGMA user_version',
      'transaction exec CREATE TABLE b (x)',
      'transaction exec PRAGMA user_version = 2',
      'commit',
    ]);
    expect(state.userVersion).toBe(2);
  });

  it('only runs migrations above the current version', async () => {
    const state: FakeState = { userVersion: 1, journalMode: 'wal' };
    const db = createFakeDatabase(state);

    await migrateDatabase(db, ['CREATE TABLE a (x)', 'CREATE TABLE b (x)']);

    expect(describeCalls(db.calls)).not.toContain('transaction exec CREATE TABLE a (x)');
    expect(describeCalls(db.calls)).toContain('transaction exec CREATE TABLE b (x)');
    expect(state.userVersion).toBe(2);
  });

  it('wraps a failing migration, rolls back and runs no later migration', async () => {
    const state: FakeState = { userVersion: 0, journalMode: 'wal', failOnSql: 'BROKEN' };
    const db = createFakeDatabase(state);

    const error = await migrateDatabase(db, [
      'CREATE TABLE a (x)',
      'BROKEN',
      'CREATE TABLE c (x)',
    ]).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(MigrationFailedError);
    expect(error).toMatchObject({ version: 2 });
    expect(error instanceof Error && error.cause).toEqual(new Error('simulated SQLite error'));
    const calls = describeCalls(db.calls);
    expect(calls).not.toContain('transaction exec PRAGMA user_version = 2');
    expect(calls).not.toContain('transaction exec CREATE TABLE c (x)');
    expect(calls[calls.length - 1]).toBe('rollback');
    expect(state.userVersion).toBe(1);
  });

  it('skips a migration that another initialization already applied', async () => {
    const db = createFakeDatabase({
      userVersion: 0,
      journalMode: 'wal',
      versionSeenInTransaction: 1,
    });

    await migrateDatabase(db);

    expect(describeCalls(db.calls).slice(2)).toEqual([
      'begin',
      'transaction getFirst PRAGMA user_version',
      'commit',
    ]);
  });

  it('fails when the version inside the transaction is unexpectedly lower', async () => {
    const db = createFakeDatabase({
      userVersion: 1,
      journalMode: 'wal',
      versionSeenInTransaction: 0,
    });

    const error = await migrateDatabase(db, ['CREATE TABLE a (x)', 'CREATE TABLE b (x)']).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(MigrationFailedError);
    expect(error instanceof Error && error.cause).toBeInstanceOf(DatabaseStateError);
    expect(describeCalls(db.calls)).not.toContain('transaction exec CREATE TABLE b (x)');
  });
});
