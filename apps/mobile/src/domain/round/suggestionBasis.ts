import type { Calibration, HitMark } from './round';

// Which alignment a pending suggestion was found with. Analysis searched only inside the
// calibrated target, sized holes from it and, without a before photo, left out the number
// columns, so a suggestion found with another alignment may be outside the target now, inside a
// band that should have been left out, and areas newly inside were never searched. Its photo
// position is still exact; only what the search covered has changed.
export type SuggestionBasis =
  // Found with the alignment the round has now.
  | 'current'
  // Found with an alignment that has since been changed.
  | 'earlierAlignment'
  // Saved before the attempt's alignment was recorded: unknown, never assumed current.
  | 'unrecorded';

export function sameCalibration(a: Calibration | null, b: Calibration | null): boolean {
  if (a === null || b === null) return a === b;
  return a.every((point, index) => {
    const other = b[index];
    return other !== undefined && other.x === point.x && other.y === point.y;
  });
}

// attemptCalibration: the calibration stored with an attempt, null when the attempt has none
// recorded, undefined when the attempt is unknown.
export function suggestionBasis(
  mark: Pick<HitMark, 'attemptId'>,
  attemptCalibration: (attemptId: string) => Calibration | null | undefined,
  current: Calibration | null,
): SuggestionBasis {
  if (mark.attemptId === null) return 'unrecorded';
  const used = attemptCalibration(mark.attemptId);
  if (used === null || used === undefined) return 'unrecorded';
  return sameCalibration(used, current) ? 'current' : 'earlierAlignment';
}
