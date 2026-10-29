import type { Result } from '../result';
import { type DistanceError, parseScaledDecimal } from '../session/parseNumber';

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

// Typed diameters have at most two decimals, a hundredth of a millimetre. A stored value with more
// precision (from an earlier version) stays as it is; this only limits new input.
export const HIT_DIAMETER_INPUT_DECIMALS = 2;

export type HitDiameterInputError = DistanceError;

// The diameter field's text, with a point or a comma like distances, within HIT_DIAMETER_MM_RANGE.
export function parseHitDiameterMm(raw: string): Result<number, HitDiameterInputError> {
  const scale = 10 ** HIT_DIAMETER_INPUT_DECIMALS;
  const hundredths = parseScaledDecimal(raw, HIT_DIAMETER_INPUT_DECIMALS, {
    min: HIT_DIAMETER_MM_RANGE.min * scale,
    max: HIT_DIAMETER_MM_RANGE.max * scale,
  });
  return hundredths.ok ? { ok: true, value: hundredths.value / scale } : hundredths;
}

// Millimetres for display and as the field's starting text: at least one decimal, up to two, and
// a stored value with more decimals shown in full rather than rounded.
export function formatHitDiameterMm(mm: number): string {
  const hundredths = Math.round(mm * 100);
  if (Math.abs(hundredths - mm * 100) > 1e-9) return String(mm);
  const text = (hundredths / 100).toFixed(2);
  return text.endsWith('0') ? text.slice(0, -1) : text;
}
