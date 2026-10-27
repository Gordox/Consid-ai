import type { Result } from '../result';

export type TextError = 'required' | 'tooLong';

// NFC first, then trim: trimming an NFC string keeps it in NFC, so the result is stable
// when normalized again (checkSessionSettings relies on that).
export function normalizeLabel(raw: string): string {
  return raw.normalize('NFC').trim();
}

// Counts Unicode code points, not UTF-16 code units.
export function codePointLength(value: string): number {
  return [...value].length;
}

export function parseLabel(raw: string, maxCodePoints: number): Result<string, TextError> {
  const value = normalizeLabel(raw);
  if (value === '') {
    return { ok: false, error: 'required' };
  }
  if (codePointLength(value) > maxCodePoints) {
    return { ok: false, error: 'tooLong' };
  }
  return { ok: true, value };
}
