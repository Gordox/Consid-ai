import { buildSession, type SessionBuildErrors } from '../domain/session/buildSession';
import type { Session } from '../domain/session/session';
import { DatabaseStateError, type SessionDatabase } from './database';
import {
  type InvalidSessionRow,
  parseSessionRow,
  SESSION_COLUMNS,
  sessionToRowParams,
} from './sessionRow';

// Built only from constant column names; every session value is bound as a parameter.
const COLUMN_LIST = SESSION_COLUMNS.join(', ');
const INSERT_SESSION_SQL = `INSERT INTO sessions (${COLUMN_LIST}) VALUES (${SESSION_COLUMNS.map(() => '?').join(', ')}) ON CONFLICT(id) DO NOTHING`;
const SELECT_SESSION_BY_ID_SQL = `SELECT ${COLUMN_LIST} FROM sessions WHERE id = ?`;
const LIST_SESSIONS_SQL = `SELECT ${COLUMN_LIST} FROM sessions ORDER BY created_at_utc DESC, id DESC`;

export type SaveSessionResult = 'saved' | 'alreadySaved';

export type SessionListing = {
  readonly sessions: Session[];
  readonly invalidRows: InvalidSessionRow[];
};

export class InvalidSessionError extends Error {
  constructor(readonly errors: SessionBuildErrors) {
    super('Session failed validation and was not saved');
    this.name = 'InvalidSessionError';
  }
}

export class SessionIdConflictError extends Error {
  constructor(
    readonly sessionId: string,
    readonly reason: 'differentContent' | 'existingRowInvalid',
  ) {
    super(`A different session with id ${sessionId} is already stored (${reason})`);
    this.name = 'SessionIdConflictError';
  }
}

function isSameSession(stored: Session, candidate: Session): boolean {
  const a = stored.settings;
  const b = candidate.settings;
  return (
    stored.id === candidate.id &&
    stored.createdAtUtc === candidate.createdAtUtc &&
    stored.createdTimeZone === candidate.createdTimeZone &&
    a.firearmName === b.firearmName &&
    a.firearmType === b.firearmType &&
    a.calibreLabel === b.calibreLabel &&
    a.distanceMetres === b.distanceMetres &&
    a.plannedShotsPerRound === b.plannedShotsPerRound &&
    a.plannedRounds === b.plannedRounds
  );
}

// A retry is idempotent only when it passes the exact same Session, including
// createdAtUtc and createdTimeZone. Rebuilding the session with a new time is a conflict.
// The existing row is never overwritten.
export async function saveSession(
  db: SessionDatabase,
  session: Session,
): Promise<SaveSessionResult> {
  const checked = buildSession(session.settings, {
    id: session.id,
    createdAtUtc: session.createdAtUtc,
    createdTimeZone: session.createdTimeZone,
  });
  if (!checked.ok) {
    throw new InvalidSessionError(checked.error);
  }
  const candidate = checked.value;

  // Each statement runs atomically in autocommit, so only one concurrent insert per id wins.
  const { changes } = await db.runAsync(INSERT_SESSION_SQL, sessionToRowParams(candidate));
  if (changes === 1) {
    return 'saved';
  }
  if (changes !== 0) {
    throw new DatabaseStateError(`Inserting one session reported ${changes} changed rows`);
  }

  const existing = await db.getFirstAsync(SELECT_SESSION_BY_ID_SQL, [candidate.id]);
  if (existing === null || existing === undefined) {
    throw new DatabaseStateError(
      `Session ${candidate.id} conflicted on insert but could not be read`,
    );
  }
  const stored = parseSessionRow(existing);
  if (!stored.ok) {
    throw new SessionIdConflictError(candidate.id, 'existingRowInvalid');
  }
  if (!isSameSession(stored.value, candidate)) {
    throw new SessionIdConflictError(candidate.id, 'differentContent');
  }
  return 'alreadySaved';
}

// Invalid rows are returned alongside valid sessions; a failed query is thrown, never
// reported as an empty list.
export async function listSessions(db: SessionDatabase): Promise<SessionListing> {
  const rows = await db.getAllAsync(LIST_SESSIONS_SQL, []);
  const sessions: Session[] = [];
  const invalidRows: InvalidSessionRow[] = [];
  for (const row of rows) {
    const parsed = parseSessionRow(row);
    if (parsed.ok) {
      sessions.push(parsed.value);
    } else {
      invalidRows.push(parsed.error);
    }
  }
  return { sessions, invalidRows };
}
