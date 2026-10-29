import {
  applyHomography,
  computeHomography,
  type Homography,
  type Quad,
} from '../target/homography';
import { SCORING_RULE_VERSION, scoreShot } from '../target/scoring';
import type { TargetDefinition } from '../target/targetDefinition';
import { calibrationProblem } from './calibrationCheck';
import type { ConfirmedResult, ConfirmedShot, DraftRound } from './round';
import { accountShots, type AccountingStatus, type RoundScore, scoreRound } from './shotAccounting';

export type BlockReason =
  | 'unknownTarget'
  | 'calibrationNeeded' // hits are marked but the photo is not calibrated
  | 'calibrationInvalid'
  | 'suggestionsPending' // analysis suggestions the user has neither accepted nor deleted
  | 'tooFew'
  | 'tooMany';

export type RoundEvaluation = {
  // Shots in accepted marks only; pending suggestions are not hits yet.
  readonly hitShots: number;
  readonly pendingSuggestions: number;
  // Hits, declared misses and unresolved shots together.
  readonly recordedShots: number;
  readonly status: AccountingStatus;
  // null while hits cannot be placed on the target (no target or no valid calibration).
  readonly shots: readonly ConfirmedShot[] | null;
  readonly score: RoundScore | null;
  readonly blockReason: BlockReason | null;
};

// Where the calibration taps sit on the target: top, right, bottom, left of the outer ring.
export function calibrationTargetQuad(target: TargetDefinition): Quad {
  const r = target.calibrationRadiusMm;
  return [
    { x: 0, y: -r },
    { x: r, y: 0 },
    { x: 0, y: r },
    { x: -r, y: 0 },
  ];
}

export function photoToTarget(calibration: Quad, target: TargetDefinition): Homography | null {
  const result = computeHomography(calibration, calibrationTargetQuad(target));
  return result.ok ? result.value : null;
}

// Pure: the same draft and target always give the same evaluation.
export function evaluateDraft(draft: DraftRound, target: TargetDefinition | null): RoundEvaluation {
  const accepted = draft.marks.filter((mark) => mark.accepted);
  const pendingSuggestions = draft.marks.length - accepted.length;
  const hitShots = accepted.reduce((sum, mark) => sum + mark.shots, 0);
  const status = accountShots({
    actualShots: draft.actualShots,
    hitShots,
    declaredMisses: draft.declaredMisses,
    unresolvedShots: draft.unresolvedShots,
  });
  const recordedShots = hitShots + draft.declaredMisses + draft.unresolvedShots;
  const blocked = (blockReason: BlockReason): RoundEvaluation => ({
    hitShots,
    pendingSuggestions,
    recordedShots,
    status,
    shots: null,
    score: null,
    blockReason,
  });

  if (target === null) {
    return blocked('unknownTarget');
  }
  let shots: ConfirmedShot[] = [];
  if (draft.marks.length > 0) {
    if (draft.calibration === null) {
      return blocked('calibrationNeeded');
    }
    const after = draft.photos.after;
    if (after !== null && calibrationProblem(draft.calibration, after) !== null) {
      return blocked('calibrationInvalid');
    }
    const homography = photoToTarget(draft.calibration, target);
    if (homography === null) {
      return blocked('calibrationInvalid');
    }
    const mapped: ConfirmedShot[] = [];
    for (const mark of accepted) {
      const centreMm = applyHomography(homography, mark.position);
      if (centreMm === null) {
        return blocked('calibrationInvalid');
      }
      const { value } = scoreShot(target, centreMm, draft.hitDiameterMm);
      mapped.push({
        markId: mark.id,
        source: mark.source,
        ...(mark.source !== 'manual' && mark.attemptId !== null
          ? { attemptId: mark.attemptId }
          : {}),
        shots: mark.shots,
        centreMm,
        value,
      });
    }
    shots = mapped;
  }
  const score = scoreRound(shots, status);
  const blockReason =
    pendingSuggestions > 0
      ? 'suggestionsPending'
      : status === 'tooFew' || status === 'tooMany'
        ? status
        : null;
  return { hitShots, pendingSuggestions, recordedShots, status, shots, score, blockReason };
}

export class RoundNotConfirmableError extends Error {
  constructor(readonly reason: BlockReason) {
    super(`The round cannot be confirmed (${reason})`);
    this.name = 'RoundNotConfirmableError';
  }
}

export function buildConfirmedResult(
  draft: DraftRound,
  target: TargetDefinition | null,
): ConfirmedResult {
  const evaluation = evaluateDraft(draft, target);
  if (
    evaluation.blockReason !== null ||
    evaluation.shots === null ||
    evaluation.score === null ||
    target === null
  ) {
    throw new RoundNotConfirmableError(evaluation.blockReason ?? 'unknownTarget');
  }
  if (evaluation.status !== 'complete' && evaluation.status !== 'incomplete') {
    throw new RoundNotConfirmableError(evaluation.status);
  }
  return {
    targetId: target.id,
    scoringRule: SCORING_RULE_VERSION,
    hitDiameterMm: draft.hitDiameterMm,
    hitDiameterSource: draft.hitDiameterSource,
    actualShots: draft.actualShots,
    declaredMisses: draft.declaredMisses,
    unresolvedShots: draft.unresolvedShots,
    status: evaluation.status,
    subtotal: evaluation.score.subtotal,
    total: evaluation.score.total,
    shots: evaluation.shots,
  };
}
