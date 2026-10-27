import type { SessionSettings } from '../../src/domain/session/session';
import { checkSessionSettings } from '../../src/domain/session/validateSessionInput';

const VALID: SessionSettings = {
  firearmName: 'Glock 17',
  firearmType: 'pistol',
  calibreLabel: '9×19 mm',
  distanceMetres: 25.5,
  plannedShotsPerRound: 10,
  plannedRounds: null,
};

// Builds plain objects on purpose: these tests feed values the type system would reject.
function withField(field: string, value: unknown): Record<string, unknown> {
  return { ...VALID, [field]: value };
}

describe('checkSessionSettings', () => {
  it('accepts valid settings and returns a new object', () => {
    const result = checkSessionSettings(VALID);
    expect(result).toEqual({ ok: true, value: VALID });
    expect(result.ok && result.value).not.toBe(VALID);
  });

  it.each([1, 100])('accepts planned rounds %p', (plannedRounds) => {
    expect(checkSessionSettings(withField('plannedRounds', plannedRounds)).ok).toBe(true);
  });

  it.each([
    ['null', null],
    ['string', 'x'],
    ['array', []],
    ['number', 42],
    ['undefined', undefined],
  ])('reports every field as invalidType for a non-object (%s)', (_label, value) => {
    expect(checkSessionSettings(value)).toEqual({
      ok: false,
      error: {
        firearmName: 'invalidType',
        firearmType: 'invalidType',
        calibreLabel: 'invalidType',
        distanceMetres: 'invalidType',
        plannedShotsPerRound: 'invalidType',
        plannedRounds: 'invalidType',
      },
    });
  });

  it.each<[string, string, unknown, string]>([
    ['firearm name with surrounding space', 'firearmName', ' x', 'notNormalized'],
    ['firearm name in NFD', 'firearmName', 'é', 'notNormalized'],
    ['firearm name empty', 'firearmName', '', 'required'],
    ['firearm name too long', 'firearmName', 'a'.repeat(101), 'tooLong'],
    ['firearm name not a string', 'firearmName', 17, 'invalidType'],
    ['firearm type unknown', 'firearmType', 'shotgun', 'unsupportedValue'],
    ['firearm type not a string', 'firearmType', 1, 'invalidType'],
    ['calibre too long', 'calibreLabel', '9'.repeat(51), 'tooLong'],
    ['calibre missing', 'calibreLabel', undefined, 'invalidType'],
    ['distance with two decimals', 'distanceMetres', 0.15, 'tooManyDecimals'],
    ['distance NaN', 'distanceMetres', NaN, 'invalidNumber'],
    ['distance Infinity', 'distanceMetres', Infinity, 'invalidNumber'],
    ['distance as string', 'distanceMetres', '25', 'invalidType'],
    ['distance zero', 'distanceMetres', 0, 'outOfRange'],
    ['shots fractional', 'plannedShotsPerRound', 1.5, 'invalidNumber'],
    ['shots above limit', 'plannedShotsPerRound', 101, 'outOfRange'],
    ['rounds zero', 'plannedRounds', 0, 'outOfRange'],
    ['rounds fractional', 'plannedRounds', 1.5, 'invalidNumber'],
    ['rounds undefined', 'plannedRounds', undefined, 'invalidType'],
  ])('reports %s', (_label, field, value, expectedError) => {
    expect(checkSessionSettings(withField(field, value))).toEqual({
      ok: false,
      error: { [field]: expectedError },
    });
  });

  it('accepts a stored distance with float noise', () => {
    expect(checkSessionSettings(withField('distanceMetres', 0.1 + 0.2)).ok).toBe(true);
  });

  it('collects errors from several fields at once', () => {
    const value = { ...VALID, firearmName: ' x', distanceMetres: 0.15, plannedRounds: 0 };
    expect(checkSessionSettings(value)).toEqual({
      ok: false,
      error: {
        firearmName: 'notNormalized',
        distanceMetres: 'tooManyDecimals',
        plannedRounds: 'outOfRange',
      },
    });
  });

  it('does not mutate the input', () => {
    const input = Object.freeze({ ...VALID, firearmName: ' x' });
    const snapshot = { ...input };
    checkSessionSettings(input);
    expect(input).toEqual(snapshot);
  });
});
