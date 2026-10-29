import type { Calibration, RoundPhoto } from '../../domain/round/round';
import type { SessionDatabase } from '../../persistence/database';
import {
  applyAnalysisResult,
  createAnalysisAttempt,
  failAnalysisAttempt,
} from '../../persistence/analysisRepository';
import {
  type AnalysisClientDeps,
  type AnalysisError,
  requestAnalysis,
  UPLOAD_CHECK_BYTES,
} from '../../services/analysis/analysisClient';
import type { AnalysisConfig } from '../../services/analysis/analysisConfig';
import type { AnalysisStatus, WarningCode } from '../../services/analysis/analysisContract';
import type { PhotoStore } from '../../services/photoStorage';
import { uploadablePhoto } from './analysisPhotos';
import { candidatesToMarks, duplicateRadiusPx } from './suggestions';

// One analysis attempt from start to stored outcome, without React. The attempt is recorded
// before anything is sent, so a request that never finishes is never lost. No transaction is
// held while the request runs: each write is its own short operation.

export type AnalysisRunInput = {
  readonly attemptId: string;
  readonly roundId: string;
  readonly targetId: string;
  readonly calibration: Calibration;
  readonly after: RoundPhoto;
  // Null in single-photo mode, including when the user chose the after photo only.
  readonly before: RoundPhoto | null;
};

export type AnalysisRunDeps = {
  readonly db: SessionDatabase;
  readonly config: AnalysisConfig;
  readonly photos: Pick<PhotoStore, 'uri' | 'size' | 'readHead'>;
  readonly fetch: AnalysisClientDeps['fetch'];
  readonly timeoutMs: number;
  readonly now: () => string;
  readonly newId: () => string;
  readonly reportError: (error: unknown) => void;
};

export type AnalysisFailureCode =
  | Exclude<AnalysisError, 'cancelled'>
  | Exclude<AnalysisStatus, 'succeeded'>
  // A photo saved before normalisation existed has no copy that may be sent.
  | 'oldPhotoCopy';

export type AnalysisRunResult =
  | { readonly kind: 'applied'; readonly added: number; readonly warnings: readonly WarningCode[] }
  // The answer belongs to an earlier photo, calibration or attempt and was not used.
  | { readonly kind: 'stale' }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'failed'; readonly code: AnalysisFailureCode }
  // A local write failed; photos and marks are unchanged.
  | { readonly kind: 'saveFailed' };

export type AnalysisRunOutcome = {
  readonly result: AnalysisRunResult;
  // The calibration the attempt was sent with, so its summary is not shown for another one.
  readonly calibration: Calibration;
};

export async function runAnalysisAttempt(
  deps: AnalysisRunDeps,
  input: AnalysisRunInput,
  signal: AbortSignal,
): Promise<AnalysisRunOutcome> {
  const { db, reportError } = deps;
  const done = (result: AnalysisRunResult): AnalysisRunOutcome => ({
    result,
    calibration: input.calibration,
  });
  // A failure to record the outcome leaves the attempt pending without a request; the next
  // start, or confirming the round, records it as interrupted.
  const fail = async (code: AnalysisFailureCode | 'cancelled'): Promise<void> => {
    try {
      await failAnalysisAttempt(db, input.attemptId, code);
    } catch (error) {
      reportError(error);
    }
  };

  try {
    await createAnalysisAttempt(db, {
      attemptId: input.attemptId,
      roundId: input.roundId,
      source: 'service',
      createdAtUtc: deps.now(),
      afterFileName: input.after.fileName,
      beforeFileName: input.before?.fileName ?? null,
      calibration: input.calibration,
    });
  } catch (error) {
    reportError(error);
    return done({ kind: 'saveFailed' });
  }

  const afterUpload = uploadablePhoto(input.after, deps.photos.uri);
  const beforeUpload =
    input.before === null ? null : uploadablePhoto(input.before, deps.photos.uri);
  if (afterUpload === null || (input.before !== null && beforeUpload === null)) {
    await fail('oldPhotoCopy');
    return done({ kind: 'failed', code: 'oldPhotoCopy' });
  }

  const result = await requestAnalysis(
    deps.config,
    {
      roundId: input.roundId,
      attemptId: input.attemptId,
      targetId: input.targetId,
      calibration: input.calibration,
      after: afterUpload,
      before: beforeUpload,
    },
    {
      fetch: deps.fetch,
      fileSize: (photo) => deps.photos.size(photo.fileName),
      readHead: (photo) => deps.photos.readHead(photo.fileName, UPLOAD_CHECK_BYTES),
      timeoutMs: deps.timeoutMs,
      signal,
    },
  );
  if (!result.ok) {
    const code = result.error;
    await fail(code);
    return done(code === 'cancelled' ? { kind: 'cancelled' } : { kind: 'failed', code });
  }
  if (result.value.status !== 'succeeded') {
    await fail(result.value.status);
    return done({ kind: 'failed', code: result.value.status });
  }
  // The answer arrived; a cancel tapped from here on is too late to stop it being used, exactly
  // as before the user tapped. The attempt is applied only if it is still the current one.
  try {
    const outcome = await applyAnalysisResult(db, {
      attemptId: input.attemptId,
      roundId: input.roundId,
      algorithmVersion: result.value.algorithmVersion,
      resultJson: JSON.stringify(result.value),
      suggestions: candidatesToMarks(result.value.candidates, deps.newId, input.attemptId),
      duplicateRadiusPx: duplicateRadiusPx(result.value.candidates, input.after),
      calibration: input.calibration,
    });
    return done(
      outcome.kind === 'stale'
        ? { kind: 'stale' }
        : { kind: 'applied', added: outcome.added, warnings: result.value.warnings },
    );
  } catch (error) {
    reportError(error);
    return done({ kind: 'saveFailed' });
  }
}
