import type { RoundEvaluation } from '../../domain/round/roundEvaluation';

function shots(count: number): string {
  return count === 1 ? '1 shot' : `${count} shots`;
}

// One sentence on what is still needed before the round can be confirmed.
export function roundStatusText(evaluation: RoundEvaluation, actualShots: number): string {
  switch (evaluation.blockReason) {
    case 'unknownTarget':
      return 'This round uses a target the app does not know, so it cannot be scored.';
    case 'calibrationNeeded':
      return 'Calibrate the after photo so the marked hits can be scored.';
    case 'calibrationInvalid':
      return 'The calibration points do not form a valid target outline. Calibrate again.';
    case 'tooFew':
      return `${shots(actualShots)} fired, but only ${shots(evaluation.recordedShots)} recorded. Mark the missing hits, or declare them as misses or unresolved.`;
    case 'tooMany':
      return `More shots are recorded than the ${shots(actualShots)} fired. Remove marks or lower the counts.`;
    case null:
      return evaluation.status === 'incomplete'
        ? 'Ready to confirm. Unresolved shots make the result a subtotal.'
        : 'Ready to confirm. Every shot is a hit or a miss.';
  }
}
