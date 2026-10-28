// Limits for rounds (product choices for the MVP, not official rules).

export const ACTUAL_SHOTS_RANGE = { min: 0, max: 100 } as const;
export const HIT_DIAMETER_MM_RANGE = { min: 1, max: 30 } as const;
// One hole may hold several shots, but only when the user says so explicitly.
export const SHOTS_PER_HOLE_RANGE = { min: 1, max: 10 } as const;

// Assumed value, not derived from the calibre label: no source for nominal diameters per calibre
// has been chosen (CLAUDE.md open input 3). It is always shown as an assumption until the user
// sets or confirms a diameter.
export const DEFAULT_HIT_DIAMETER_MM = 9;

// 'assumed': the default nobody has confirmed. 'userSet': chosen or confirmed by the user.
export type HitDiameterSource = 'assumed' | 'userSet';

export type HitDiameter = { readonly mm: number; readonly source: HitDiameterSource };

// A new round reuses the diameter the user set in the session's previous round; otherwise it
// starts from the stated assumption.
export function diameterForNewRound(previous: HitDiameter | null): HitDiameter {
  return previous !== null && previous.source === 'userSet'
    ? previous
    : { mm: DEFAULT_HIT_DIAMETER_MM, source: 'assumed' };
}

export function isHitDiameterSource(value: string): value is HitDiameterSource {
  return value === 'assumed' || value === 'userSet';
}

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
