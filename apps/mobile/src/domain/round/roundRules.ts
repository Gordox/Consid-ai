// Limits for rounds (product choices for the MVP, not official rules).

export const ACTUAL_SHOTS_RANGE = { min: 0, max: 100 } as const;
export const HIT_DIAMETER_MM_RANGE = { min: 1, max: 30 } as const;
// One hole may hold several shots, but only when the user says so explicitly.
export const SHOTS_PER_HOLE_RANGE = { min: 1, max: 10 } as const;

// Assumed demo value, not derived from the calibre label. The user can change it per round.
export const DEFAULT_HIT_DIAMETER_MM = 9;

export function isActualShots(value: number): boolean {
  return (
    Number.isInteger(value) && value >= ACTUAL_SHOTS_RANGE.min && value <= ACTUAL_SHOTS_RANGE.max
  );
}

export function isHitDiameterMm(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= HIT_DIAMETER_MM_RANGE.min &&
    value <= HIT_DIAMETER_MM_RANGE.max
  );
}

export function isShotsPerHole(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= SHOTS_PER_HOLE_RANGE.min &&
    value <= SHOTS_PER_HOLE_RANGE.max
  );
}
