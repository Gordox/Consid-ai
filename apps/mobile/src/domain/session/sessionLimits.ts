// Product choices for the prototype (decision B1), not official rules.

export type IntegerRange = { readonly min: number; readonly max: number };

export const FIREARM_NAME_MAX_CODE_POINTS = 100;
export const CALIBRE_LABEL_MAX_CODE_POINTS = 50;

// Distance is bounded in tenths of a metre so the range check stays integer-based: 0.1–1000 m.
export const DISTANCE_TENTHS_RANGE: IntegerRange = { min: 1, max: 10_000 };

export const PLANNED_SHOTS_PER_ROUND_RANGE: IntegerRange = { min: 1, max: 100 };
export const PLANNED_ROUNDS_RANGE: IntegerRange = { min: 1, max: 100 };
