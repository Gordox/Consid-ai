import type { Result } from '../result';
import { DISTANCE_TENTHS_RANGE, type IntegerRange } from './sessionLimits';

export type WholeNumberError = 'required' | 'invalidNumber' | 'outOfRange';
export type DistanceError = WholeNumberError | 'tooManyDecimals';

// Without the `u` flag, \d matches ASCII digits only.
const WHOLE_NUMBER_PATTERN = /^\d+$/;
const DECIMAL_PATTERN = /^(\d+)(?:[.,](\d+))?$/;

// Absorbs binary floating-point noise in stored values (0.3 * 10 = 3.0000000000000004).
// It is not a tolerance for values that genuinely have more than one decimal.
const TENTHS_FLOAT_EPSILON = 1e-9;

export function checkWholeNumber(
  value: number,
  range: IntegerRange,
): 'invalidNumber' | 'outOfRange' | null {
  if (!Number.isInteger(value)) {
    return 'invalidNumber';
  }
  return value < range.min || value > range.max ? 'outOfRange' : null;
}

export function checkDistanceMetres(
  value: number,
): 'invalidNumber' | 'tooManyDecimals' | 'outOfRange' | null {
  if (!Number.isFinite(value)) {
    return 'invalidNumber';
  }
  const tenths = value * 10;
  const roundedTenths = Math.round(tenths);
  if (Math.abs(tenths - roundedTenths) > TENTHS_FLOAT_EPSILON) {
    return 'tooManyDecimals';
  }
  return checkWholeNumber(roundedTenths, DISTANCE_TENTHS_RANGE);
}

// Rejects digit strings longer than the range maximum before converting them,
// so huge inputs never pass through an unsafe Number.
function digitsWithinRange(digits: string, range: IntegerRange): Result<number, 'outOfRange'> {
  const significantDigits = digits.replace(/^0+/, '');
  if (significantDigits.length > String(range.max).length) {
    return { ok: false, error: 'outOfRange' };
  }
  const value = significantDigits === '' ? 0 : Number(significantDigits);
  if (checkWholeNumber(value, range) !== null) {
    return { ok: false, error: 'outOfRange' };
  }
  return { ok: true, value };
}

export function parseWholeNumber(
  raw: string,
  range: IntegerRange,
): Result<number, WholeNumberError> {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { ok: false, error: 'required' };
  }
  if (!WHOLE_NUMBER_PATTERN.test(trimmed)) {
    return { ok: false, error: 'invalidNumber' };
  }
  return digitsWithinRange(trimmed, range);
}

export function parseDistanceMetres(raw: string): Result<number, DistanceError> {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { ok: false, error: 'required' };
  }
  const match = DECIMAL_PATTERN.exec(trimmed);
  const integerDigits = match?.[1];
  if (integerDigits === undefined) {
    return { ok: false, error: 'invalidNumber' };
  }
  const fractionDigits = match?.[2] ?? '0';
  if (fractionDigits.length > 1) {
    return { ok: false, error: 'tooManyDecimals' };
  }
  const tenths = digitsWithinRange(integerDigits + fractionDigits, DISTANCE_TENTHS_RANGE);
  if (!tenths.ok) {
    return tenths;
  }
  return { ok: true, value: tenths.value / 10 };
}
