import type { Calibration } from '../../src/domain/round/round';
import { sameCalibration, suggestionBasis } from '../../src/domain/round/suggestionBasis';

const A: Calibration = [
  { x: 1, y: 0 },
  { x: 2, y: 1 },
  { x: 1, y: 2 },
  { x: 0, y: 1 },
];
const B: Calibration = [{ x: 1.5, y: 0 }, A[1], A[2], A[3]];

describe('sameCalibration', () => {
  it('compares every point exactly', () => {
    expect(sameCalibration(A, [...A])).toBe(true);
    expect(sameCalibration(A, B)).toBe(false);
    expect(sameCalibration(null, null)).toBe(true);
    expect(sameCalibration(A, null)).toBe(false);
  });
});

describe('suggestionBasis', () => {
  const calibrations = new Map<string, Calibration | null>([
    ['a1', A],
    ['old', null],
  ]);
  const lookup = (id: string) => calibrations.get(id);

  it('is current while the alignment is the one the attempt used', () => {
    expect(suggestionBasis({ attemptId: 'a1' }, lookup, A)).toBe('current');
  });

  it('is an earlier alignment once a point moved', () => {
    expect(suggestionBasis({ attemptId: 'a1' }, lookup, B)).toBe('earlierAlignment');
    expect(suggestionBasis({ attemptId: 'a1' }, lookup, null)).toBe('earlierAlignment');
  });

  it('never assumes an unrecorded alignment is current', () => {
    expect(suggestionBasis({ attemptId: null }, lookup, A)).toBe('unrecorded');
    expect(suggestionBasis({ attemptId: 'old' }, lookup, A)).toBe('unrecorded');
    expect(suggestionBasis({ attemptId: 'gone' }, lookup, A)).toBe('unrecorded');
  });
});
