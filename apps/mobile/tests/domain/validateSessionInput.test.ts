import type { SessionFormInput } from '../../src/domain/session/session';
import { validateSessionInput } from '../../src/domain/session/validateSessionInput';

const VALID: SessionFormInput = {
  firearmName: '  Glock 17 ',
  firearmType: 'pistol',
  calibreLabel: '9×19 mm',
  distanceMetres: '25,5',
  plannedShotsPerRound: '10',
  plannedRounds: '',
};

function withField(overrides: Partial<SessionFormInput>): SessionFormInput {
  return { ...VALID, ...overrides };
}

describe('validateSessionInput', () => {
  it('returns normalized settings for complete valid input', () => {
    expect(validateSessionInput(VALID)).toEqual({
      ok: true,
      value: {
        firearmName: 'Glock 17',
        firearmType: 'pistol',
        calibreLabel: '9×19 mm',
        distanceMetres: 25.5,
        plannedShotsPerRound: 10,
        plannedRounds: null,
      },
    });
  });

  it.each(['', '   '])('maps empty planned rounds %p to null, never 0', (plannedRounds) => {
    const result = validateSessionInput(withField({ plannedRounds }));
    expect(result.ok && result.value.plannedRounds).toBeNull();
  });

  it.each([
    ['1', 1],
    ['100', 100],
  ])('accepts planned rounds %p', (plannedRounds, expected) => {
    const result = validateSessionInput(withField({ plannedRounds }));
    expect(result.ok && result.value.plannedRounds).toBe(expected);
  });

  it.each(['pistol', 'revolver', 'rifle', 'other'])('accepts firearm type %p', (firearmType) => {
    const result = validateSessionInput(withField({ firearmType }));
    expect(result.ok && result.value.firearmType).toBe(firearmType);
  });

  // One case per field and error, to show each field uses its own rule and limit.
  it.each<[string, Partial<SessionFormInput>, Record<string, string>]>([
    ['firearm name too long', { firearmName: 'a'.repeat(101) }, { firearmName: 'tooLong' }],
    ['firearm name blank', { firearmName: '   ' }, { firearmName: 'required' }],
    ['firearm type missing', { firearmType: null }, { firearmType: 'required' }],
    ['firearm type empty', { firearmType: '' }, { firearmType: 'required' }],
    ['firearm type capitalized', { firearmType: 'Pistol' }, { firearmType: 'unsupportedValue' }],
    ['firearm type unknown', { firearmType: 'shotgun' }, { firearmType: 'unsupportedValue' }],
    ['firearm type padded', { firearmType: ' pistol' }, { firearmType: 'unsupportedValue' }],
    ['calibre too long', { calibreLabel: '9'.repeat(51) }, { calibreLabel: 'tooLong' }],
    ['calibre blank', { calibreLabel: '  ' }, { calibreLabel: 'required' }],
    ['distance blank', { distanceMetres: ' ' }, { distanceMetres: 'required' }],
    ['distance above limit', { distanceMetres: '1000,1' }, { distanceMetres: 'outOfRange' }],
    ['distance two decimals', { distanceMetres: '25,55' }, { distanceMetres: 'tooManyDecimals' }],
    ['distance malformed', { distanceMetres: '1e3' }, { distanceMetres: 'invalidNumber' }],
    ['shots blank', { plannedShotsPerRound: '' }, { plannedShotsPerRound: 'required' }],
    ['shots above limit', { plannedShotsPerRound: '101' }, { plannedShotsPerRound: 'outOfRange' }],
    ['shots decimal', { plannedShotsPerRound: '1.0' }, { plannedShotsPerRound: 'invalidNumber' }],
    ['rounds zero', { plannedRounds: '0' }, { plannedRounds: 'outOfRange' }],
    ['rounds above limit', { plannedRounds: '101' }, { plannedRounds: 'outOfRange' }],
    ['rounds decimal', { plannedRounds: '1.0' }, { plannedRounds: 'invalidNumber' }],
  ])('reports %s', (_label, overrides, expectedErrors) => {
    expect(validateSessionInput(withField(overrides))).toEqual({
      ok: false,
      error: expectedErrors,
    });
  });

  it('reports every required field at once when the form is empty', () => {
    const empty: SessionFormInput = {
      firearmName: '',
      firearmType: null,
      calibreLabel: '',
      distanceMetres: '',
      plannedShotsPerRound: '',
      plannedRounds: '',
    };
    expect(validateSessionInput(empty)).toEqual({
      ok: false,
      error: {
        firearmName: 'required',
        firearmType: 'required',
        calibreLabel: 'required',
        distanceMetres: 'required',
        plannedShotsPerRound: 'required',
      },
    });
  });

  it('reports different errors on several fields at once', () => {
    const input = withField({
      firearmName: 'a'.repeat(101),
      firearmType: 'shotgun',
      distanceMetres: '25,55',
      plannedShotsPerRound: '0',
      plannedRounds: 'abc',
    });
    expect(validateSessionInput(input)).toEqual({
      ok: false,
      error: {
        firearmName: 'tooLong',
        firearmType: 'unsupportedValue',
        distanceMetres: 'tooManyDecimals',
        plannedShotsPerRound: 'outOfRange',
        plannedRounds: 'invalidNumber',
      },
    });
  });

  it('does not mutate the input and returns a new object', () => {
    const input = Object.freeze({ ...VALID });
    const snapshot = { ...input };
    const result = validateSessionInput(input);
    expect(input).toEqual(snapshot);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).not.toBe(input);
  });
});
