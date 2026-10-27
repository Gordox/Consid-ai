import {
  checkDistanceMetres,
  checkWholeNumber,
  parseDistanceMetres,
  parseWholeNumber,
} from '../../src/domain/session/parseNumber';
import {
  PLANNED_ROUNDS_RANGE,
  PLANNED_SHOTS_PER_ROUND_RANGE,
} from '../../src/domain/session/sessionLimits';

describe('parseDistanceMetres', () => {
  it.each([
    ['0.1', 0.1],
    ['0,1', 0.1],
    ['1', 1],
    ['25.5', 25.5],
    ['25,5', 25.5],
    ['1000', 1000],
    ['1000.0', 1000],
    ['0001000', 1000],
    [' 25.5 ', 25.5],
    ['00000000000000000025', 25],
  ])('parses %p as %p metres', (raw, expected) => {
    expect(parseDistanceMetres(raw)).toEqual({ ok: true, value: expected });
  });

  it.each(['0', '0.0', '000', '1000,1', '1001', '99999999999999999999'])(
    'rejects %p as out of range',
    (raw) => {
      expect(parseDistanceMetres(raw)).toEqual({ ok: false, error: 'outOfRange' });
    },
  );

  it.each(['0.09', '25,55', '1.000', '1.10'])('rejects %p as having too many decimals', (raw) => {
    expect(parseDistanceMetres(raw)).toEqual({ ok: false, error: 'tooManyDecimals' });
  });

  it.each([
    '1 000',
    '1,000.5',
    '1e3',
    '25.5m',
    '-5',
    '+5',
    '.5',
    '25.',
    '25 .5',
    '25.5.5',
    'Infinity',
    'NaN',
    '0x10',
    '２５', // fullwidth "25"
    '١٢', // Arabic-Indic "12"
  ])('rejects %p as an invalid number', (raw) => {
    expect(parseDistanceMetres(raw)).toEqual({ ok: false, error: 'invalidNumber' });
  });

  it.each(['', '  '])('reports %p as required', (raw) => {
    expect(parseDistanceMetres(raw)).toEqual({ ok: false, error: 'required' });
  });
});

describe('parseWholeNumber', () => {
  const range = PLANNED_SHOTS_PER_ROUND_RANGE;

  it.each([
    ['1', 1],
    ['100', 100],
    ['007', 7],
    [' 10 ', 10],
  ])('parses %p as %p', (raw, expected) => {
    expect(parseWholeNumber(raw, range)).toEqual({ ok: true, value: expected });
  });

  it.each(['0', '101', '9007199254740993', '9'.repeat(1000)])(
    'rejects %p as out of range',
    (raw) => {
      expect(parseWholeNumber(raw, range)).toEqual({ ok: false, error: 'outOfRange' });
    },
  );

  it.each(['1.0', '1,5', '10abc', '1e2', '-1', '+1', '1 0'])(
    'rejects %p as an invalid number',
    (raw) => {
      expect(parseWholeNumber(raw, range)).toEqual({ ok: false, error: 'invalidNumber' });
    },
  );

  it.each(['', '  '])('reports %p as required', (raw) => {
    expect(parseWholeNumber(raw, range)).toEqual({ ok: false, error: 'required' });
  });

  it('applies the range it is given', () => {
    expect(parseWholeNumber('100', PLANNED_ROUNDS_RANGE)).toEqual({ ok: true, value: 100 });
    expect(parseWholeNumber('101', PLANNED_ROUNDS_RANGE)).toEqual({
      ok: false,
      error: 'outOfRange',
    });
  });
});

describe('checkWholeNumber', () => {
  const range = PLANNED_ROUNDS_RANGE;

  it.each([1, 50, 100])('accepts %p', (value) => {
    expect(checkWholeNumber(value, range)).toBeNull();
  });

  it.each([0, 101, -1])('reports %p as out of range', (value) => {
    expect(checkWholeNumber(value, range)).toBe('outOfRange');
  });

  it.each([1.5, NaN, Infinity, -Infinity])('reports %p as an invalid number', (value) => {
    expect(checkWholeNumber(value, range)).toBe('invalidNumber');
  });
});

describe('checkDistanceMetres', () => {
  it.each([0.1, 0.3, 1, 25.5, 999.9, 1000])('accepts %p', (value) => {
    expect(checkDistanceMetres(value)).toBeNull();
  });

  it.each([0, 1000.1, 1001, -1])('reports %p as out of range', (value) => {
    expect(checkDistanceMetres(value)).toBe('outOfRange');
  });

  it.each([0.15, 0.05, 25.55])('reports %p as having too many decimals', (value) => {
    expect(checkDistanceMetres(value)).toBe('tooManyDecimals');
  });

  it.each([NaN, Infinity, -Infinity])('reports %p as an invalid number', (value) => {
    expect(checkDistanceMetres(value)).toBe('invalidNumber');
  });
});
