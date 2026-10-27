import type { Session } from '../../src/domain/session/session';
import { DatabaseStateError } from '../../src/persistence/database';
import {
  InvalidSessionError,
  listSessions,
  SessionIdConflictError,
  saveSession,
} from '../../src/persistence/sessionRepository';
import { SESSION_COLUMNS, sessionToRowParams } from '../../src/persistence/sessionRow';
import { type DatabaseCall, FakeDatabase } from './fakeDatabase';

// These tests check orchestration against a fake. They do not prove that the SQL runs,
// that ON CONFLICT behaves as expected in SQLite, or that native binding works.

const SESSION: Session = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  createdAtUtc: '2026-10-27T13:00:00.000Z',
  createdTimeZone: 'Europe/Stockholm',
  settings: {
    firearmName: 'Glock 17',
    firearmType: 'pistol',
    calibreLabel: '9×19 mm',
    distanceMetres: 25.5,
    plannedShotsPerRound: 10,
    plannedRounds: null,
  },
};

const OTHER_ID = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';

function toRow(session: Session): Record<string, unknown> {
  const params = sessionToRowParams(session);
  return Object.fromEntries(SESSION_COLUMNS.map((column, index) => [column, params[index]]));
}

function withSettings(overrides: Partial<Session['settings']>): Session {
  return { ...SESSION, settings: { ...SESSION.settings, ...overrides } };
}

type Responses = { changes?: number; existing?: unknown; rows?: unknown[] };

function createDatabase(responses: Responses): FakeDatabase {
  return new FakeDatabase((call: DatabaseCall) => {
    if (call.method === 'run') return { changes: responses.changes ?? 1 };
    if (call.method === 'getFirst') return responses.existing ?? null;
    if (call.method === 'getAll') return responses.rows ?? [];
    return undefined;
  });
}

function sqlCalls(db: FakeDatabase): Extract<DatabaseCall, { sql: string }>[] {
  return db.calls.filter((call): call is Extract<DatabaseCall, { sql: string }> => 'sql' in call);
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (error: unknown) => error,
  );
}

describe('saveSession', () => {
  it('rejects an invalid session without writing', async () => {
    const db = createDatabase({});
    const error = await rejection(saveSession(db, withSettings({ distanceMetres: 0.15 })));

    expect(error).toBeInstanceOf(InvalidSessionError);
    expect(error).toMatchObject({
      errors: { settings: { distanceMetres: 'tooManyDecimals' } },
    });
    expect(db.calls).toEqual([]);
  });

  it('rejects invalid metadata without writing', async () => {
    const db = createDatabase({});
    const error = await rejection(saveSession(db, { ...SESSION, id: 'not-a-uuid' }));

    expect(error).toMatchObject({ errors: { id: 'invalidId' } });
    expect(db.calls).toEqual([]);
  });

  it('returns saved when the insert adds a row', async () => {
    const db = createDatabase({ changes: 1 });

    await expect(saveSession(db, SESSION)).resolves.toBe('saved');

    const calls = sqlCalls(db);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      connection: 'main',
      method: 'run',
      sql:
        'INSERT INTO sessions (id, created_at_utc, created_time_zone, firearm_name, firearm_type, ' +
        'calibre_label, distance_m, planned_shots_per_round, planned_rounds) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING',
      params: [
        SESSION.id,
        '2026-10-27T13:00:00.000Z',
        'Europe/Stockholm',
        'Glock 17',
        'pistol',
        '9×19 mm',
        25.5,
        10,
        null,
      ],
    });
  });

  it('binds text with quotes as a parameter instead of putting it in the SQL', async () => {
    const name = 'O\'Brien "Dirty" Harry; DROP TABLE sessions;--';
    const db = createDatabase({ changes: 1 });

    await saveSession(db, withSettings({ firearmName: name }));

    const [insert] = sqlCalls(db);
    expect(insert?.sql).not.toContain('Brien');
    expect(insert && 'params' in insert ? insert.params : undefined).toContain(name);
  });

  it('returns alreadySaved when the same session is already stored', async () => {
    const db = createDatabase({ changes: 0, existing: toRow(SESSION) });

    await expect(saveSession(db, SESSION)).resolves.toBe('alreadySaved');

    const calls = sqlCalls(db);
    expect(calls.map((call) => call.method)).toEqual(['run', 'getFirst']);
    expect(calls[1]).toMatchObject({
      sql:
        'SELECT id, created_at_utc, created_time_zone, firearm_name, firearm_type, ' +
        'calibre_label, distance_m, planned_shots_per_round, planned_rounds FROM sessions WHERE id = ?',
      params: [SESSION.id],
    });
  });

  // Step 4 contract: a retry must reuse the original Session, not only its id.
  it('treats the same id with a new createdAtUtc as a conflict', async () => {
    const db = createDatabase({ changes: 0, existing: toRow(SESSION) });
    const rebuilt: Session = { ...SESSION, createdAtUtc: '2026-10-27T13:00:05.000Z' };

    const error = await rejection(saveSession(db, rebuilt));

    expect(error).toBeInstanceOf(SessionIdConflictError);
    expect(error).toMatchObject({ sessionId: SESSION.id, reason: 'differentContent' });
  });

  it.each<[string, Session]>([
    ['firearm name', withSettings({ firearmName: 'Glock 19' })],
    ['distance', withSettings({ distanceMetres: 50 })],
    ['planned rounds', withSettings({ plannedRounds: 3 })],
    ['time zone', { ...SESSION, createdTimeZone: 'UTC' }],
  ])('reports a conflict when the %s differs', async (_label, candidate) => {
    const db = createDatabase({ changes: 0, existing: toRow(SESSION) });

    await expect(saveSession(db, candidate)).rejects.toMatchObject({
      reason: 'differentContent',
    });
  });

  it('reports a conflict without overwriting when the stored row is invalid', async () => {
    const db = createDatabase({
      changes: 0,
      existing: { ...toRow(SESSION), firearm_type: 'shotgun' },
    });

    const error = await rejection(saveSession(db, SESSION));

    expect(error).toBeInstanceOf(SessionIdConflictError);
    expect(error).toMatchObject({ sessionId: SESSION.id, reason: 'existingRowInvalid' });
    expect(sqlCalls(db).map((call) => call.method)).toEqual(['run', 'getFirst']);
  });

  it('keeps row values out of the conflict message', async () => {
    const db = createDatabase({ changes: 0, existing: toRow(SESSION) });

    const error = await rejection(saveSession(db, withSettings({ firearmName: 'Private Name' })));

    expect(error instanceof Error && error.message).not.toContain('Private');
    expect(error instanceof Error && error.message).not.toContain('Glock');
  });

  it('throws DatabaseStateError when a conflicting row cannot be read', async () => {
    const db = createDatabase({ changes: 0, existing: null });

    await expect(saveSession(db, SESSION)).rejects.toBeInstanceOf(DatabaseStateError);
  });

  it('throws DatabaseStateError when the insert reports more than one change', async () => {
    const db = createDatabase({ changes: 2 });

    await expect(saveSession(db, SESSION)).rejects.toBeInstanceOf(DatabaseStateError);
  });

  it('passes database errors from the insert through unchanged', async () => {
    const failure = new Error('database is locked');
    const db = new FakeDatabase(() => {
      throw failure;
    });

    await expect(saveSession(db, SESSION)).rejects.toBe(failure);
  });

  it('passes database errors from the conflict read through unchanged', async () => {
    const failure = new Error('disk I/O error');
    const db = new FakeDatabase((call) => {
      if (call.method === 'run') return { changes: 0 };
      throw failure;
    });

    await expect(saveSession(db, SESSION)).rejects.toBe(failure);
  });

  it('does not mutate the session', async () => {
    const session = Object.freeze({ ...SESSION, settings: Object.freeze({ ...SESSION.settings }) });

    await saveSession(createDatabase({ changes: 1 }), session);

    expect(session).toEqual(SESSION);
  });
});

describe('listSessions', () => {
  it('queries newest first with a stable tie-breaker', async () => {
    const db = createDatabase({ rows: [] });

    await listSessions(db);

    expect(sqlCalls(db)).toEqual([
      {
        connection: 'main',
        method: 'getAll',
        sql:
          'SELECT id, created_at_utc, created_time_zone, firearm_name, firearm_type, ' +
          'calibre_label, distance_m, planned_shots_per_round, planned_rounds FROM sessions ' +
          'ORDER BY created_at_utc DESC, id DESC',
        params: [],
      },
    ]);
  });

  it('returns empty lists for an empty table', async () => {
    await expect(listSessions(createDatabase({ rows: [] }))).resolves.toEqual({
      sessions: [],
      invalidRows: [],
    });
  });

  it('separates valid sessions from invalid rows and keeps query order', async () => {
    const newer: Session = { ...SESSION, createdAtUtc: '2026-10-28T09:00:00.000Z' };
    const older: Session = { ...SESSION, id: OTHER_ID };
    const db = createDatabase({
      rows: [toRow(newer), { ...toRow(SESSION), distance_m: 0.15 }, toRow(older)],
    });

    const listing = await listSessions(db);

    expect(listing.sessions).toEqual([newer, older]);
    expect(listing.invalidRows).toEqual([
      { id: SESSION.id, errors: { distance_m: 'tooManyDecimals' } },
    ]);
  });

  it('throws a failed query instead of returning an empty list', async () => {
    const failure = new Error('no such table: sessions');
    const db = new FakeDatabase(() => {
      throw failure;
    });

    await expect(listSessions(db)).rejects.toBe(failure);
  });
});
