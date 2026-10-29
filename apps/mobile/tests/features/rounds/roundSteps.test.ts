import type { DraftRound, HitMark, RoundPhoto } from '../../../src/domain/round/round';
import { initialRoundStep, progressStates } from '../../../src/features/rounds/roundSteps';

const PHOTO: RoundPhoto = {
  role: 'after',
  fileName: 'a.jpg',
  originalFileName: 'a-original.jpg',
  width: 3000,
  height: 4000,
  addedAtUtc: '2026-10-28T10:00:00.000Z',
};

const MARK: HitMark = {
  id: 'm1',
  position: { x: 1, y: 1 },
  shots: 1,
  source: 'manual',
  uncertain: false,
  accepted: true,
  candidateId: null,
  attemptId: null,
};

const CALIBRATION = [
  { x: 1500, y: 500 },
  { x: 2500, y: 1500 },
  { x: 1500, y: 2500 },
  { x: 500, y: 1500 },
] as const;

function draft(overrides: Partial<DraftRound>): DraftRound {
  return {
    state: 'draft',
    revision: 0,
    id: 'r1',
    sessionId: 's1',
    sequence: 1,
    createdAtUtc: '2026-10-28T10:00:00.000Z',
    actualShots: 10,
    declaredMisses: 0,
    unresolvedShots: 0,
    targetId: 'demo-synthetic-v1',
    hitDiameterMm: 9,
    hitDiameterSource: 'assumed',
    calibration: null,
    photos: { before: null, after: null },
    marks: [],
    ...overrides,
  };
}

describe('initialRoundStep', () => {
  it('starts a new round at its settings', () => {
    expect(initialRoundStep(draft({}))).toBe('setup');
  });

  it('continues at the photos while the after photo or the alignment is missing', () => {
    expect(
      initialRoundStep(draft({ photos: { before: { ...PHOTO, role: 'before' }, after: null } })),
    ).toBe('photos');
    expect(initialRoundStep(draft({ photos: { before: null, after: PHOTO } }))).toBe('photos');
    expect(initialRoundStep(draft({ marks: [MARK] }))).toBe('photos');
  });

  it('continues at analysis once the after photo is aligned', () => {
    expect(
      initialRoundStep(draft({ photos: { before: null, after: PHOTO }, calibration: CALIBRATION })),
    ).toBe('analyse');
  });
});

describe('progressStates', () => {
  it('marks steps done only from what the draft holds', () => {
    expect(progressStates(draft({}), 'photos')).toEqual({
      photos: 'current',
      align: 'todo',
      review: 'todo',
    });
    expect(
      progressStates(
        draft({ photos: { before: null, after: PHOTO }, calibration: CALIBRATION }),
        'review',
      ),
    ).toEqual({ photos: 'done', align: 'done', review: 'current' });
  });

  it('does not treat a visited step as done', () => {
    expect(progressStates(draft({}), 'review')).toEqual({
      photos: 'todo',
      align: 'todo',
      review: 'current',
    });
  });
});
