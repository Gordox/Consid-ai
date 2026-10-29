import { formatHitDiameterMm, parseHitDiameterMm } from '../../../src/domain/round/roundRules';
import { diameterCommit } from '../../../src/features/rounds/useDiameterField';
import type { DraftCounts } from '../../../src/persistence/roundRepository';

const COUNTS: DraftCounts = {
  actualShots: 5,
  declaredMisses: 0,
  unresolvedShots: 0,
  hitDiameterMm: 9,
  hitDiameterSource: 'assumed',
};

describe('parseHitDiameterMm', () => {
  it.each([
    ['9', 9],
    ['9,65', 9.65],
    ['9.65', 9.65],
    ['5.6', 5.6],
    [' 30 ', 30],
    ['1', 1],
  ])('accepts %s', (raw, value) => {
    expect(parseHitDiameterMm(raw)).toEqual({ ok: true, value });
  });

  it.each([
    ['', 'required'],
    ['0.9', 'outOfRange'],
    ['30.01', 'outOfRange'],
    ['9.655', 'tooManyDecimals'],
    ['1e1', 'invalidNumber'],
    ['-5', 'invalidNumber'],
    ['9.', 'invalidNumber'],
    ['.5', 'invalidNumber'],
  ])('refuses %s', (raw, error) => {
    expect(parseHitDiameterMm(raw)).toEqual({ ok: false, error });
  });
});

describe('formatHitDiameterMm', () => {
  it('shows one or two decimals and never rounds a more precise stored value', () => {
    expect(formatHitDiameterMm(9)).toBe('9.0');
    expect(formatHitDiameterMm(9.65)).toBe('9.65');
    expect(formatHitDiameterMm(5.6)).toBe('5.6');
    expect(formatHitDiameterMm(9.123)).toBe('9.123');
  });
});

describe('diameterCommit', () => {
  it('writes nothing for the saved value, also when typed differently', () => {
    expect(diameterCommit('9.0', COUNTS)).toEqual({ kind: 'unchanged' });
    expect(diameterCommit('9', COUNTS)).toEqual({ kind: 'unchanged' });
  });

  it('commits a new value as set by the user', () => {
    expect(diameterCommit('9,65', COUNTS)).toEqual({
      kind: 'committed',
      counts: { ...COUNTS, hitDiameterMm: 9.65, hitDiameterSource: 'userSet' },
      text: '9.65',
    });
  });

  it('keeps invalid text out of the counts', () => {
    expect(diameterCommit('abc', COUNTS)).toMatchObject({ kind: 'invalid' });
    expect(diameterCommit('', COUNTS)).toMatchObject({ kind: 'invalid' });
  });

  it('leaves a more precise stored value alone when its text is untouched', () => {
    const precise = { ...COUNTS, hitDiameterMm: 9.123 };
    expect(diameterCommit(formatHitDiameterMm(9.123), precise)).toEqual({ kind: 'unchanged' });
    // Typing it again is new input, limited to two decimals.
    expect(diameterCommit('9.123', { ...COUNTS })).toMatchObject({ kind: 'invalid' });
  });
});
