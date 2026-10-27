import { codePointLength, normalizeLabel, parseLabel } from '../../src/domain/session/parseText';
import {
  CALIBRE_LABEL_MAX_CODE_POINTS,
  FIREARM_NAME_MAX_CODE_POINTS,
} from '../../src/domain/session/sessionLimits';

const DECOMPOSED_E_ACUTE = 'é';
const COMPOSED_E_ACUTE = 'é';
const THUMBS_UP = '\u{1F44D}';
const THUMBS_UP_MEDIUM_SKIN_TONE = '\u{1F44D}\u{1F3FD}';
const IDEOGRAPHIC_SPACE = '　';

describe('normalizeLabel', () => {
  it('trims surrounding whitespace, including ideographic space', () => {
    expect(normalizeLabel(`  Glock 17 ${IDEOGRAPHIC_SPACE}`)).toBe('Glock 17');
  });

  it('keeps inner whitespace', () => {
    expect(normalizeLabel(' 9 mm  Luger ')).toBe('9 mm  Luger');
  });

  it('composes decomposed characters to NFC', () => {
    expect(normalizeLabel(DECOMPOSED_E_ACUTE)).toBe(COMPOSED_E_ACUTE);
  });

  it('is stable when applied twice', () => {
    const once = normalizeLabel(` ${DECOMPOSED_E_ACUTE}pée `);
    expect(normalizeLabel(once)).toBe(once);
  });
});

describe('codePointLength', () => {
  it.each([
    ['empty string', '', 0],
    ['ASCII', 'abc', 3],
    ['emoji outside the BMP', THUMBS_UP, 1],
    ['emoji with skin tone modifier', THUMBS_UP_MEDIUM_SKIN_TONE, 2],
    ['decomposed e with acute accent', DECOMPOSED_E_ACUTE, 2],
    ['composed e with acute accent', COMPOSED_E_ACUTE, 1],
  ])('counts code points in %s', (_label, value, expected) => {
    expect(codePointLength(value)).toBe(expected);
  });
});

describe('parseLabel with the firearm name limit', () => {
  const max = FIREARM_NAME_MAX_CODE_POINTS;

  it.each([
    ['a single character', 'A', 'A'],
    ['exactly the limit', 'a'.repeat(max), 'a'.repeat(max)],
    ['surrounding whitespace', '  Glock 17 ', 'Glock 17'],
  ])('accepts %s', (_label, raw, expected) => {
    expect(parseLabel(raw, max)).toEqual({ ok: true, value: expected });
  });

  it('rejects one character over the limit', () => {
    expect(parseLabel('a'.repeat(max + 1), max)).toEqual({ ok: false, error: 'tooLong' });
  });

  it.each([
    ['empty string', ''],
    ['spaces only', '   '],
    ['ideographic space only', IDEOGRAPHIC_SPACE],
    ['tabs and newlines only', '\t\n'],
  ])('reports %s as required', (_label, raw) => {
    expect(parseLabel(raw, max)).toEqual({ ok: false, error: 'required' });
  });

  it('measures length after NFC normalization', () => {
    const raw = DECOMPOSED_E_ACUTE.repeat(max);
    expect(codePointLength(raw)).toBe(max * 2);
    expect(parseLabel(raw, max)).toEqual({ ok: true, value: COMPOSED_E_ACUTE.repeat(max) });
  });

  it('measures length after trimming', () => {
    expect(parseLabel(`  ${'a'.repeat(max)}  `, max)).toEqual({
      ok: true,
      value: 'a'.repeat(max),
    });
  });

  it('counts emoji outside the BMP as one code point each', () => {
    expect(parseLabel(THUMBS_UP.repeat(max), max)).toEqual({
      ok: true,
      value: THUMBS_UP.repeat(max),
    });
    expect(parseLabel(THUMBS_UP.repeat(max + 1), max)).toEqual({ ok: false, error: 'tooLong' });
  });

  it('counts an emoji with skin tone modifier as two code points', () => {
    const half = max / 2;
    expect(parseLabel(THUMBS_UP_MEDIUM_SKIN_TONE.repeat(half), max)).toEqual({
      ok: true,
      value: THUMBS_UP_MEDIUM_SKIN_TONE.repeat(half),
    });
    expect(parseLabel(THUMBS_UP_MEDIUM_SKIN_TONE.repeat(half + 1), max)).toEqual({
      ok: false,
      error: 'tooLong',
    });
  });

  it('never truncates an over-long value', () => {
    const result = parseLabel('a'.repeat(max + 50), max);
    expect(result.ok).toBe(false);
  });
});

describe('parseLabel with the calibre limit', () => {
  const max = CALIBRE_LABEL_MAX_CODE_POINTS;

  it('accepts exactly the limit', () => {
    expect(parseLabel('9'.repeat(max), max)).toEqual({ ok: true, value: '9'.repeat(max) });
  });

  it('rejects one character over the limit', () => {
    expect(parseLabel('9'.repeat(max + 1), max)).toEqual({ ok: false, error: 'tooLong' });
  });

  it.each(['', '  '])('reports %p as required', (raw) => {
    expect(parseLabel(raw, max)).toEqual({ ok: false, error: 'required' });
  });

  it('keeps non-ASCII characters in the label', () => {
    expect(parseLabel(' 9×19 mm ', max)).toEqual({ ok: true, value: '9×19 mm' });
  });
});
