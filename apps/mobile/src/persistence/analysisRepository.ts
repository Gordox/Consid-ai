import type { Calibration, HitMark } from '../domain/round/round';
import type { SessionDatabase } from './database';
import { RoundNotEditableError, RoundNotFoundError } from './roundRepository';
import { parseCalibration, readNullableString, readString, serializeCalibration } from './roundRow';

export type AttemptSource = 'service' | 'demo';

// Recorded before the request is sent, so a failed or abandoned request is never lost. The
// photo files are recorded too: an answer only applies to the photos it analysed.
export async function createAnalysisAttempt(
  db: SessionDatabase,
  input: {
    attemptId: string;
    roundId: string;
    source: AttemptSource;
    createdAtUtc: string;
    afterFileName: string;
    beforeFileName: string | null;
    // The calibration sent with the request, so its suggestions can later be told apart from
    // those of another alignment.
    calibration: Calibration;
  },
): Promise<void> {
  const { changes } = await db.runAsync(
    `INSERT INTO analysis_attempts (id, round_id, created_at_utc, source, status, after_file_name, before_file_name, calibration_json)
     SELECT ?, id, ?, ?, 'pending', ?, ?, ? FROM rounds WHERE id = ? AND state = 'draft'`,
    [
      input.attemptId,
      input.createdAtUtc,
      input.source,
      input.afterFileName,
      input.beforeFileName,
      serializeCalibration(input.calibration),
      input.roundId,
    ],
  );
  if (changes !== 1) {
    throw new RoundNotEditableError();
  }
}

export async function failAnalysisAttempt(
  db: SessionDatabase,
  attemptId: string,
  errorCode: string,
): Promise<void> {
  await db.runAsync(
    "UPDATE analysis_attempts SET status = 'failed', error_code = ? WHERE id = ? AND status = 'pending'",
    [errorCode, attemptId],
  );
}

// Pending attempts whose request cannot be running any more: when a database opens, no request
// of this connection exists yet, and requests of an earlier connection can no longer write
// (it refuses operations once closing). Those attempts would otherwise look busy forever.
export async function failInterruptedAttempts(
  db: SessionDatabase,
  isAttemptRunning: (attemptId: string) => boolean,
): Promise<number> {
  const rows = await db.getAllAsync(
    "SELECT id FROM analysis_attempts WHERE status = 'pending'",
    [],
  );
  let failed = 0;
  for (const row of rows) {
    const attemptId = readString(row, 'id');
    if (isAttemptRunning(attemptId)) continue;
    const { changes } = await db.runAsync(
      "UPDATE analysis_attempts SET status = 'failed', error_code = 'interrupted' WHERE id = ? AND status = 'pending'",
      [attemptId],
    );
    failed += changes;
  }
  return failed;
}

export type ApplyOutcome =
  | { readonly kind: 'applied'; readonly added: number; readonly duplicates: number }
  | { readonly kind: 'stale' };

// Suggestions this close to a mark the user keeps are the same hole and are not added again.
function isDuplicate(
  suggestion: HitMark,
  kept: readonly { x: number; y: number }[],
  radius: number,
): boolean {
  return kept.some(
    (mark) => Math.hypot(mark.x - suggestion.position.x, mark.y - suggestion.position.y) <= radius,
  );
}

function readNumberField(row: unknown, key: string): number {
  const value: unknown = typeof row === 'object' && row !== null ? Reflect.get(row, key) : null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(`Expected a number in ${key}`);
  }
  return value;
}

// Stores the validated result and replaces pending suggestions with the new ones. Manual,
// edited and accepted marks always stay. Only the newest attempt of a draft round may apply,
// and only while the round still has the photos that attempt analysed, so a late answer to an
// earlier attempt, after a photo change, after the calibration was changed or after confirmation
// changes nothing. Suggestions are photo positions found inside the calibrated area, so an answer
// for another calibration is discarded as a whole; marks already on the round are untouched.
export async function applyAnalysisResult(
  db: SessionDatabase,
  input: {
    attemptId: string;
    roundId: string;
    algorithmVersion: string;
    resultJson: string;
    suggestions: readonly HitMark[];
    duplicateRadiusPx: number;
    // The calibration the request was sent with.
    calibration: Calibration | null;
  },
): Promise<ApplyOutcome> {
  let outcome: ApplyOutcome = { kind: 'stale' };
  await db.withExclusiveTransactionAsync(async (txn) => {
    const round = await txn.getFirstAsync(
      'SELECT state, calibration_json FROM rounds WHERE id = ?',
      [input.roundId],
    );
    if (round === null || round === undefined) {
      throw new RoundNotFoundError();
    }
    const latest = await txn.getFirstAsync(
      `SELECT id, after_file_name, before_file_name FROM analysis_attempts WHERE round_id = ?
       ORDER BY created_at_utc DESC, rowid DESC LIMIT 1`,
      [input.roundId],
    );
    const photos = await txn.getAllAsync(
      'SELECT role, file_name FROM round_photos WHERE round_id = ?',
      [input.roundId],
    );
    const currentFile = (role: string): string | null => {
      const row = photos.find((photo) => readString(photo, 'role') === role);
      return row === undefined ? null : readString(row, 'file_name');
    };
    const isCurrent =
      latest !== null &&
      latest !== undefined &&
      readString(latest, 'id') === input.attemptId &&
      readNullableString(latest, 'after_file_name') === currentFile('after') &&
      // An attempt sent without the before photo (after photo only, by choice) did not use it.
      (readNullableString(latest, 'before_file_name') === null ||
        readNullableString(latest, 'before_file_name') === currentFile('before')) &&
      readNullableString(round, 'calibration_json') ===
        (input.calibration === null ? null : serializeCalibration(input.calibration));
    if (readString(round, 'state') !== 'draft' || !isCurrent) {
      await txn.runAsync(
        "UPDATE analysis_attempts SET status = 'failed', error_code = 'stale' WHERE id = ? AND status = 'pending'",
        [input.attemptId],
      );
      return;
    }
    await txn.runAsync(
      `UPDATE analysis_attempts SET status = 'succeeded', algorithm_version = ?, result_json = ?
       WHERE id = ? AND status = 'pending'`,
      [input.algorithmVersion, input.resultJson, input.attemptId],
    );
    await txn.runAsync(
      "DELETE FROM round_marks WHERE round_id = ? AND source = 'suggested' AND accepted = 0",
      [input.roundId],
    );
    const keptRows = await txn.getAllAsync(
      'SELECT x, y, ordinal FROM round_marks WHERE round_id = ?',
      [input.roundId],
    );
    const kept = keptRows.map((row) => ({
      x: readNumberField(row, 'x'),
      y: readNumberField(row, 'y'),
    }));
    let ordinal: number = keptRows.reduce(
      (max: number, row) => Math.max(max, readNumberField(row, 'ordinal') + 1),
      0,
    );
    let added = 0;
    for (const mark of input.suggestions) {
      if (isDuplicate(mark, kept, input.duplicateRadiusPx)) continue;
      await txn.runAsync(
        `INSERT INTO round_marks (id, round_id, ordinal, x, y, shots, source, uncertain, accepted, candidate_id, attempt_id)
         VALUES (?, ?, ?, ?, ?, 1, 'suggested', ?, 0, ?, ?)`,
        [
          mark.id,
          input.roundId,
          ordinal,
          mark.position.x,
          mark.position.y,
          mark.uncertain ? 1 : 0,
          mark.candidateId,
          input.attemptId,
        ],
      );
      ordinal += 1;
      added += 1;
    }
    // New suggestions are a change to the draft: a screen still holding the earlier marks must
    // not write them back over these.
    await txn.runAsync('UPDATE rounds SET draft_revision = draft_revision + 1 WHERE id = ?', [
      input.roundId,
    ]);
    outcome = { kind: 'applied', added, duplicates: input.suggestions.length - added };
  });
  return outcome;
}

export type AttemptStatus = 'pending' | 'succeeded' | 'failed';

export type LatestAttempt = {
  readonly id: string;
  readonly source: AttemptSource;
  readonly status: AttemptStatus;
  readonly errorCode: string | null;
  readonly createdAtUtc: string;
  readonly algorithmVersion: string | null;
  // The calibration the attempt was sent with; null for attempts saved before it was recorded.
  readonly calibration: Calibration | null;
};

// The newest attempt of a round, so the screen can show what happened even after a restart.
export async function getLatestAttempt(
  db: SessionDatabase,
  roundId: string,
): Promise<LatestAttempt | null> {
  const row = await db.getFirstAsync(
    `SELECT id, source, status, error_code, created_at_utc, algorithm_version, calibration_json FROM analysis_attempts
     WHERE round_id = ? ORDER BY created_at_utc DESC, rowid DESC LIMIT 1`,
    [roundId],
  );
  if (row === null || row === undefined) {
    return null;
  }
  const source = readString(row, 'source');
  const status = readString(row, 'status');
  if (
    (source !== 'service' && source !== 'demo') ||
    (status !== 'pending' && status !== 'succeeded' && status !== 'failed')
  ) {
    throw new RangeError('Unknown analysis attempt source or status');
  }
  return {
    id: readString(row, 'id'),
    source,
    status,
    errorCode: readNullableString(row, 'error_code'),
    createdAtUtc: readString(row, 'created_at_utc'),
    algorithmVersion: readNullableString(row, 'algorithm_version'),
    calibration: parseCalibration(readNullableString(row, 'calibration_json')),
  };
}
