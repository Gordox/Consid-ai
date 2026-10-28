import type { HitMark } from '../domain/round/round';
import type { SessionDatabase } from './database';
import { RoundNotEditableError, RoundNotFoundError } from './roundRepository';
import { readString } from './roundRow';

export type AttemptSource = 'service' | 'demo';

// Recorded before the request is sent, so a failed or abandoned request is never lost.
export async function createAnalysisAttempt(
  db: SessionDatabase,
  input: { attemptId: string; roundId: string; source: AttemptSource; createdAtUtc: string },
): Promise<void> {
  const { changes } = await db.runAsync(
    `INSERT INTO analysis_attempts (id, round_id, created_at_utc, source, status)
     SELECT ?, id, ?, ?, 'pending' FROM rounds WHERE id = ? AND state = 'draft'`,
    [input.attemptId, input.createdAtUtc, input.source, input.roundId],
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

export type ApplyOutcome = 'applied' | 'stale';

// Stores the validated result and replaces untouched suggestions with the new ones. Manual and
// edited marks always stay. Only the newest attempt of a draft round may apply, so a late
// answer to an earlier attempt, or after confirmation, changes nothing.
export async function applyAnalysisResult(
  db: SessionDatabase,
  input: {
    attemptId: string;
    roundId: string;
    algorithmVersion: string;
    resultJson: string;
    suggestions: readonly HitMark[];
  },
): Promise<ApplyOutcome> {
  let outcome: ApplyOutcome = 'applied';
  await db.withExclusiveTransactionAsync(async (txn) => {
    const round = await txn.getFirstAsync('SELECT state FROM rounds WHERE id = ?', [input.roundId]);
    if (round === null || round === undefined) {
      throw new RoundNotFoundError();
    }
    const latest = await txn.getFirstAsync(
      'SELECT id FROM analysis_attempts WHERE round_id = ? ORDER BY created_at_utc DESC, rowid DESC LIMIT 1',
      [input.roundId],
    );
    const isLatest =
      latest !== null && latest !== undefined && readString(latest, 'id') === input.attemptId;
    if (readString(round, 'state') !== 'draft' || !isLatest) {
      outcome = 'stale';
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
    await txn.runAsync("DELETE FROM round_marks WHERE round_id = ? AND source = 'suggested'", [
      input.roundId,
    ]);
    const next = await txn.getFirstAsync(
      'SELECT COALESCE(MAX(ordinal), -1) + 1 AS next FROM round_marks WHERE round_id = ?',
      [input.roundId],
    );
    const nextValue: unknown =
      typeof next === 'object' && next !== null ? Reflect.get(next, 'next') : null;
    let ordinal = typeof nextValue === 'number' && Number.isInteger(nextValue) ? nextValue : 0;
    for (const mark of input.suggestions) {
      await txn.runAsync(
        `INSERT INTO round_marks (id, round_id, ordinal, x, y, shots, source, uncertain, candidate_id)
         VALUES (?, ?, ?, ?, ?, 1, 'suggested', ?, ?)`,
        [
          mark.id,
          input.roundId,
          ordinal,
          mark.position.x,
          mark.position.y,
          mark.uncertain ? 1 : 0,
          mark.candidateId,
        ],
      );
      ordinal += 1;
    }
  });
  return outcome;
}
