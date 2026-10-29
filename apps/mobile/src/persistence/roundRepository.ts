import type {
  Calibration,
  ConfirmedResult,
  HitMark,
  PhotoRole,
  Round,
  RoundPhoto,
  RoundPhotos,
} from '../domain/round/round';
import {
  diameterForNewRound,
  type HitDiameterSource,
  isActualShots,
  isHitDiameterMm,
  isHitDiameterSource,
} from '../domain/round/roundRules';
import type { SessionDatabase } from './database';
import {
  InvalidRoundDataError,
  parseCalibration,
  parseConfirmedResult,
  parseMarkRow,
  parsePhotoRow,
  readNullableNumber,
  readNullableString,
  readNumber,
  readString,
  serializeCalibration,
  serializeConfirmedResult,
} from './roundRow';

// Every write to a round requires state = 'draft': a confirmed round is never changed.

export class SessionNotFoundError extends Error {
  constructor() {
    super('The session does not exist');
    this.name = 'SessionNotFoundError';
  }
}

export class SessionFinishedError extends Error {
  constructor() {
    super('The session is finished and accepts no new rounds');
    this.name = 'SessionFinishedError';
  }
}

export class DraftRoundExistsError extends Error {
  constructor(readonly draftRoundId: string) {
    super('The session already has a round in progress');
    this.name = 'DraftRoundExistsError';
  }
}

export class RoundNotFoundError extends Error {
  constructor() {
    super('The round does not exist');
    this.name = 'RoundNotFoundError';
  }
}

export class RoundNotEditableError extends Error {
  constructor() {
    super('The round is confirmed and cannot be changed');
    this.name = 'RoundNotEditableError';
  }
}

const isCount = (value: number): boolean => isActualShots(value);
const isPositiveInteger = (value: number): boolean => Number.isInteger(value) && value > 0;
const isRevision = (value: number): boolean => Number.isInteger(value) && value >= 0;

const MARK_SELECT =
  'SELECT id, x, y, shots, source, uncertain, accepted, candidate_id, attempt_id FROM round_marks WHERE round_id = ? ORDER BY ordinal';

const ROUND_COLUMNS = `id, session_id, sequence, state, created_at_utc, actual_shots, declared_misses,
  unresolved_shots, target_id, hit_diameter_mm, hit_diameter_source, calibration_json, confirmed_at_utc, confirmed_json,
  draft_revision`;

async function sessionFinishedAt(db: SessionDatabase, sessionId: string): Promise<string | null> {
  const row = await db.getFirstAsync('SELECT finished_at_utc FROM sessions WHERE id = ?', [
    sessionId,
  ]);
  if (row === null || row === undefined) {
    throw new SessionNotFoundError();
  }
  return readNullableString(row, 'finished_at_utc');
}

async function draftRoundId(db: SessionDatabase, sessionId: string): Promise<string | null> {
  const row = await db.getFirstAsync(
    "SELECT id FROM rounds WHERE session_id = ? AND state = 'draft' LIMIT 1",
    [sessionId],
  );
  return row === null || row === undefined ? null : readString(row, 'id');
}

async function requireDraft(db: SessionDatabase, roundId: string): Promise<void> {
  const row = await db.getFirstAsync('SELECT state FROM rounds WHERE id = ?', [roundId]);
  if (row === null || row === undefined) {
    throw new RoundNotFoundError();
  }
  if (readString(row, 'state') !== 'draft') {
    throw new RoundNotEditableError();
  }
}

export type StartRoundInput = {
  readonly roundId: string;
  readonly sessionId: string;
  readonly createdAtUtc: string;
  readonly actualShots: number;
  readonly targetId: string;
};

// One draft per session at a time; the sequence is the next free number in the session. The
// hole diameter carries over from the previous round when the user set it there.
export async function startRound(db: SessionDatabase, input: StartRoundInput): Promise<number> {
  if (!isActualShots(input.actualShots)) {
    throw new RangeError('Round settings are out of range');
  }
  let sequence = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    if ((await sessionFinishedAt(txn, input.sessionId)) !== null) {
      throw new SessionFinishedError();
    }
    const existingDraft = await draftRoundId(txn, input.sessionId);
    if (existingDraft !== null) {
      throw new DraftRoundExistsError(existingDraft);
    }
    const row = await txn.getFirstAsync(
      'SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM rounds WHERE session_id = ?',
      [input.sessionId],
    );
    sequence = readNumber(row, 'next', isPositiveInteger);
    const previous = await txn.getFirstAsync(
      `SELECT hit_diameter_mm, hit_diameter_source FROM rounds WHERE session_id = ?
       ORDER BY sequence DESC LIMIT 1`,
      [input.sessionId],
    );
    const diameter = diameterForNewRound(
      previous === null || previous === undefined
        ? null
        : {
            mm: readNumber(previous, 'hit_diameter_mm', isHitDiameterMm),
            source: readDiameterSource(previous),
          },
    );
    await txn.runAsync(
      `INSERT INTO rounds (id, session_id, sequence, state, created_at_utc, actual_shots,
        declared_misses, unresolved_shots, target_id, hit_diameter_mm, hit_diameter_source)
       VALUES (?, ?, ?, 'draft', ?, ?, 0, 0, ?, ?, ?)`,
      [
        input.roundId,
        input.sessionId,
        sequence,
        input.createdAtUtc,
        input.actualShots,
        input.targetId,
        diameter.mm,
        diameter.source,
      ],
    );
  });
  return sequence;
}

function readDiameterSource(row: unknown): HitDiameterSource {
  const source = readString(row, 'hit_diameter_source');
  if (!isHitDiameterSource(source)) {
    throw new InvalidRoundDataError('hit_diameter_source');
  }
  return source;
}

async function readPhotos(db: SessionDatabase, roundId: string): Promise<RoundPhotos> {
  const rows = await db.getAllAsync(
    'SELECT role, file_name, original_file_name, width, height, added_at_utc FROM round_photos WHERE round_id = ?',
    [roundId],
  );
  const photos = rows.map(parsePhotoRow);
  return {
    before: photos.find((photo) => photo.role === 'before') ?? null,
    after: photos.find((photo) => photo.role === 'after') ?? null,
  };
}

export async function getRound(db: SessionDatabase, roundId: string): Promise<Round | null> {
  const row = await db.getFirstAsync(`SELECT ${ROUND_COLUMNS} FROM rounds WHERE id = ?`, [roundId]);
  if (row === null || row === undefined) {
    return null;
  }
  const base = {
    id: readString(row, 'id'),
    sessionId: readString(row, 'session_id'),
    sequence: readNumber(row, 'sequence', isPositiveInteger),
    createdAtUtc: readString(row, 'created_at_utc'),
    photos: await readPhotos(db, roundId),
  };
  const state = readString(row, 'state');
  if (state === 'confirmed') {
    return {
      ...base,
      state: 'confirmed',
      confirmedAtUtc: readString(row, 'confirmed_at_utc'),
      result: parseConfirmedResult(readString(row, 'confirmed_json')),
    };
  }
  if (state !== 'draft') {
    throw new InvalidRoundDataError('state');
  }
  const markRows = await db.getAllAsync(MARK_SELECT, [roundId]);
  return {
    ...base,
    state: 'draft',
    revision: readNumber(row, 'draft_revision', isRevision),
    actualShots: readNumber(row, 'actual_shots', isCount),
    declaredMisses: readNumber(row, 'declared_misses', isCount),
    unresolvedShots: readNumber(row, 'unresolved_shots', isCount),
    targetId: readString(row, 'target_id'),
    hitDiameterMm: readNumber(row, 'hit_diameter_mm', isHitDiameterMm),
    hitDiameterSource: readDiameterSource(row),
    calibration: parseCalibration(readNullableString(row, 'calibration_json')),
    marks: markRows.map(parseMarkRow),
  };
}

// Calibration and marks of any round, read only. A confirmed round keeps them after
// confirmation; they are shown for inspection and never used to rescore its fixed result.
export async function getRoundAnnotations(
  db: SessionDatabase,
  roundId: string,
): Promise<{ readonly calibration: Calibration | null; readonly marks: HitMark[] } | null> {
  const row = await db.getFirstAsync('SELECT calibration_json FROM rounds WHERE id = ?', [roundId]);
  if (row === null || row === undefined) {
    return null;
  }
  const markRows = await db.getAllAsync(MARK_SELECT, [roundId]);
  return {
    calibration: parseCalibration(readNullableString(row, 'calibration_json')),
    marks: markRows.map(parseMarkRow),
  };
}

// Both stored copies of one photo, for deletion after the row that pointed at them is gone.
function filesOfPhotoRow(row: unknown): string[] {
  const original = readNullableString(row, 'original_file_name');
  return original === null
    ? [readString(row, 'file_name')]
    : [readString(row, 'file_name'), original];
}

export type DraftCounts = {
  readonly actualShots: number;
  readonly declaredMisses: number;
  readonly unresolvedShots: number;
  readonly hitDiameterMm: number;
  readonly hitDiameterSource: HitDiameterSource;
};

export async function updateDraftCounts(
  db: SessionDatabase,
  roundId: string,
  counts: DraftCounts,
): Promise<void> {
  if (
    !isCount(counts.actualShots) ||
    !isCount(counts.declaredMisses) ||
    !isCount(counts.unresolvedShots) ||
    !isHitDiameterMm(counts.hitDiameterMm) ||
    !isHitDiameterSource(counts.hitDiameterSource)
  ) {
    throw new RangeError('Round counts are out of range');
  }
  const { changes } = await db.runAsync(
    `UPDATE rounds SET actual_shots = ?, declared_misses = ?, unresolved_shots = ?,
       hit_diameter_mm = ?, hit_diameter_source = ?
     WHERE id = ? AND state = 'draft'`,
    [
      counts.actualShots,
      counts.declaredMisses,
      counts.unresolvedShots,
      counts.hitDiameterMm,
      counts.hitDiameterSource,
      roundId,
    ],
  );
  if (changes !== 1) {
    await requireDraft(db, roundId);
  }
}

// Calibration and marks are saved together so a mark never refers to an outdated calibration.
export async function saveDraftAnnotations(
  db: SessionDatabase,
  roundId: string,
  calibration: Calibration | null,
  marks: readonly HitMark[],
): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await requireDraft(txn, roundId);
    await txn.runAsync('UPDATE rounds SET calibration_json = ? WHERE id = ?', [
      calibration === null ? null : serializeCalibration(calibration),
      roundId,
    ]);
    await txn.runAsync('DELETE FROM round_marks WHERE round_id = ?', [roundId]);
    for (const [ordinal, mark] of marks.entries()) {
      await txn.runAsync(
        `INSERT INTO round_marks (id, round_id, ordinal, x, y, shots, source, uncertain, accepted, candidate_id, attempt_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          mark.id,
          roundId,
          ordinal,
          mark.position.x,
          mark.position.y,
          mark.shots,
          mark.source,
          mark.uncertain ? 1 : 0,
          mark.accepted ? 1 : 0,
          mark.candidateId,
          mark.attemptId,
        ],
      );
    }
  });
}

// Marks and calibration are in after-photo pixels, so replacing the after photo clears them.
// Returns the replaced files so the caller can delete them after this commit.
export async function setDraftPhoto(
  db: SessionDatabase,
  roundId: string,
  photo: RoundPhoto,
): Promise<string[]> {
  let replaced: string[] = [];
  await db.withExclusiveTransactionAsync(async (txn) => {
    await requireDraft(txn, roundId);
    const existing = await txn.getFirstAsync(
      'SELECT file_name, original_file_name FROM round_photos WHERE round_id = ? AND role = ?',
      [roundId, photo.role],
    );
    replaced = existing === null || existing === undefined ? [] : filesOfPhotoRow(existing);
    await txn.runAsync(
      `INSERT INTO round_photos (round_id, role, file_name, original_file_name, width, height, added_at_utc)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (round_id, role) DO UPDATE SET file_name = excluded.file_name,
         original_file_name = excluded.original_file_name, width = excluded.width,
         height = excluded.height, added_at_utc = excluded.added_at_utc`,
      [
        roundId,
        photo.role,
        photo.fileName,
        photo.originalFileName,
        photo.width,
        photo.height,
        photo.addedAtUtc,
      ],
    );
    if (photo.role === 'after') {
      await txn.runAsync('UPDATE rounds SET calibration_json = NULL WHERE id = ?', [roundId]);
      await txn.runAsync('DELETE FROM round_marks WHERE round_id = ?', [roundId]);
    }
  });
  return replaced;
}

export async function removeDraftPhoto(
  db: SessionDatabase,
  roundId: string,
  role: PhotoRole,
): Promise<string[]> {
  let removed: string[] = [];
  await db.withExclusiveTransactionAsync(async (txn) => {
    await requireDraft(txn, roundId);
    const existing = await txn.getFirstAsync(
      'SELECT file_name, original_file_name FROM round_photos WHERE round_id = ? AND role = ?',
      [roundId, role],
    );
    removed = existing === null || existing === undefined ? [] : filesOfPhotoRow(existing);
    await txn.runAsync('DELETE FROM round_photos WHERE round_id = ? AND role = ?', [roundId, role]);
    if (role === 'after') {
      await txn.runAsync('UPDATE rounds SET calibration_json = NULL WHERE id = ?', [roundId]);
      await txn.runAsync('DELETE FROM round_marks WHERE round_id = ?', [roundId]);
    }
  });
  return removed;
}

export type ConfirmOutcome = 'confirmed' | 'alreadyConfirmed';

// A repeated confirmation (double tap, retry after an unclear failure) reports
// alreadyConfirmed and never overwrites the stored result.
export async function confirmRound(
  db: SessionDatabase,
  roundId: string,
  result: ConfirmedResult,
  confirmedAtUtc: string,
): Promise<ConfirmOutcome> {
  const { changes } = await db.runAsync(
    `UPDATE rounds SET state = 'confirmed', confirmed_at_utc = ?, confirmed_json = ?,
       confirmed_subtotal = ?, confirmed_complete = ?
     WHERE id = ? AND state = 'draft'`,
    [
      confirmedAtUtc,
      serializeConfirmedResult(result),
      result.subtotal,
      result.status === 'complete' ? 1 : 0,
      roundId,
    ],
  );
  if (changes === 1) {
    return 'confirmed';
  }
  const row = await db.getFirstAsync('SELECT state FROM rounds WHERE id = ?', [roundId]);
  if (row === null || row === undefined) {
    throw new RoundNotFoundError();
  }
  return 'alreadyConfirmed';
}

// Removes a draft and its rows. Returns photo files for the caller to delete after commit.
export async function discardDraftRound(db: SessionDatabase, roundId: string): Promise<string[]> {
  let files: string[] = [];
  await db.withExclusiveTransactionAsync(async (txn) => {
    await requireDraft(txn, roundId);
    const rows = await txn.getAllAsync(
      'SELECT file_name, original_file_name FROM round_photos WHERE round_id = ?',
      [roundId],
    );
    files = rows.flatMap(filesOfPhotoRow);
    await txn.runAsync('DELETE FROM round_marks WHERE round_id = ?', [roundId]);
    await txn.runAsync('DELETE FROM round_photos WHERE round_id = ?', [roundId]);
    await txn.runAsync('DELETE FROM analysis_attempts WHERE round_id = ?', [roundId]);
    await txn.runAsync("DELETE FROM rounds WHERE id = ? AND state = 'draft'", [roundId]);
  });
  return files;
}

export type FinishOutcome = 'finished' | 'alreadyFinished';

export async function finishSession(
  db: SessionDatabase,
  sessionId: string,
  finishedAtUtc: string,
): Promise<FinishOutcome> {
  let outcome: FinishOutcome = 'finished';
  await db.withExclusiveTransactionAsync(async (txn) => {
    if ((await sessionFinishedAt(txn, sessionId)) !== null) {
      outcome = 'alreadyFinished';
      return;
    }
    const draft = await draftRoundId(txn, sessionId);
    if (draft !== null) {
      throw new DraftRoundExistsError(draft);
    }
    await txn.runAsync(
      'UPDATE sessions SET finished_at_utc = ? WHERE id = ? AND finished_at_utc IS NULL',
      [finishedAtUtc, sessionId],
    );
  });
  return outcome;
}

export type RoundSummary = {
  readonly id: string;
  readonly sequence: number;
  readonly state: 'draft' | 'confirmed';
  readonly actualShots: number;
  readonly targetId: string;
  readonly confirmedSubtotal: number | null;
  readonly confirmedComplete: boolean | null;
  // Unknown-valued shots of a confirmed round, read from its fixed result.
  readonly confirmedUnresolved: number | null;
};

export type SessionProgress = {
  readonly finishedAtUtc: string | null;
  readonly rounds: readonly RoundSummary[];
};

function parseSummary(row: unknown): RoundSummary {
  const state = readString(row, 'state');
  if (state !== 'draft' && state !== 'confirmed') {
    throw new InvalidRoundDataError('state');
  }
  const complete = readNullableNumber(
    row,
    'confirmed_complete',
    (value) => value === 0 || value === 1,
  );
  const subtotal = readNullableNumber(row, 'confirmed_subtotal', Number.isInteger);
  const unresolved = readNullableNumber(row, 'confirmed_unresolved', isCount);
  if (state === 'confirmed' && (complete === null || subtotal === null)) {
    throw new InvalidRoundDataError('confirmed_subtotal');
  }
  return {
    id: readString(row, 'id'),
    sequence: readNumber(row, 'sequence', isPositiveInteger),
    state,
    actualShots: readNumber(row, 'actual_shots', isCount),
    targetId: readString(row, 'target_id'),
    confirmedSubtotal: subtotal,
    confirmedComplete: complete === null ? null : complete === 1,
    confirmedUnresolved: state === 'confirmed' ? unresolved : null,
  };
}

const SUMMARY_SQL = `SELECT id, session_id, sequence, state, actual_shots, target_id,
  confirmed_subtotal, confirmed_complete,
  json_extract(confirmed_json, '$.unresolvedShots') AS confirmed_unresolved
  FROM rounds`;

export async function getSessionProgress(
  db: SessionDatabase,
  sessionId: string,
): Promise<SessionProgress> {
  const finishedAtUtc = await sessionFinishedAt(db, sessionId);
  const rows = await db.getAllAsync(`${SUMMARY_SQL} WHERE session_id = ? ORDER BY sequence`, [
    sessionId,
  ]);
  return { finishedAtUtc, rounds: rows.map(parseSummary) };
}

export type SessionOverview = {
  readonly finishedAtUtc: string | null;
  readonly rounds: readonly RoundSummary[];
};

// For the session list: status and round summaries for every session in one pass.
export async function listSessionOverviews(
  db: SessionDatabase,
): Promise<ReadonlyMap<string, SessionOverview>> {
  const sessionRows = await db.getAllAsync('SELECT id, finished_at_utc FROM sessions', []);
  const roundRows = await db.getAllAsync(`${SUMMARY_SQL} ORDER BY session_id, sequence`, []);
  const overviews = new Map<string, { finishedAtUtc: string | null; rounds: RoundSummary[] }>();
  for (const row of sessionRows) {
    overviews.set(readString(row, 'id'), {
      finishedAtUtc: readNullableString(row, 'finished_at_utc'),
      rounds: [],
    });
  }
  for (const row of roundRows) {
    overviews.get(readString(row, 'session_id'))?.rounds.push(parseSummary(row));
  }
  return overviews;
}

// Every photo file this database refers to, for the cleanup of unused copies.
export async function listReferencedPhotoFiles(db: SessionDatabase): Promise<Set<string>> {
  const rows = await db.getAllAsync('SELECT file_name, original_file_name FROM round_photos', []);
  return new Set(rows.flatMap(filesOfPhotoRow));
}
