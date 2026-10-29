import { accountShots, canConfirm, scoreRound } from '../../src/domain/round/shotAccounting';
import { isActualShots, isHitDiameterMm, isShotsPerHole } from '../../src/domain/round/roundRules';

describe('accountShots', () => {
  it('is complete when hits and misses account for every shot', () => {
    expect(
      accountShots({ actualShots: 5, hitShots: 4, declaredMisses: 1, unresolvedShots: 0 }),
    ).toBe('complete');
  });

  it('is incomplete, not complete, when shots are unresolved', () => {
    const status = accountShots({
      actualShots: 5,
      hitShots: 3,
      declaredMisses: 0,
      unresolvedShots: 2,
    });
    expect(status).toBe('incomplete');
    expect(canConfirm(status)).toBe(true);
  });

  it('does not treat missing detections as misses', () => {
    const status = accountShots({
      actualShots: 5,
      hitShots: 3,
      declaredMisses: 0,
      unresolvedShots: 0,
    });
    expect(status).toBe('tooFew');
    expect(canConfirm(status)).toBe(false);
  });

  it('refuses more recorded shots than were fired', () => {
    const status = accountShots({
      actualShots: 2,
      hitShots: 3,
      declaredMisses: 0,
      unresolvedShots: 0,
    });
    expect(status).toBe('tooMany');
    expect(canConfirm(status)).toBe(false);
  });

  it('accepts an interrupted round with no shots', () => {
    expect(
      accountShots({ actualShots: 0, hitShots: 0, declaredMisses: 0, unresolvedShots: 0 }),
    ).toBe('complete');
  });
});

describe('scoreRound', () => {
  it('counts a hole with several shots once per shot', () => {
    expect(
      scoreRound(
        [
          { value: 9, shots: 2 },
          { value: 7, shots: 1 },
        ],
        'complete',
      ),
    ).toEqual({
      subtotal: 25,
      total: 25,
    });
  });

  it('gives only a subtotal when shots are unresolved', () => {
    expect(scoreRound([{ value: 10, shots: 1 }], 'incomplete')).toEqual({
      subtotal: 10,
      total: null,
    });
  });
});

describe('round rules', () => {
  it('validates shot counts, diameters and shots per hole', () => {
    expect([0, 10, 100].every(isActualShots)).toBe(true);
    expect([-1, 1.5, 101, Number.NaN].some(isActualShots)).toBe(false);
    expect([1, 9, 30].every(isHitDiameterMm)).toBe(true);
    expect([0, 0.5, 31, Number.NaN].some(isHitDiameterMm)).toBe(false);
    expect([1, 10].every(isShotsPerHole)).toBe(true);
    expect([0, 11, 1.5].some(isShotsPerHole)).toBe(false);
  });
});
