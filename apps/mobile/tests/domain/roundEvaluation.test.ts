import type { DraftRound, HitMark } from '../../src/domain/round/round';
import {
  buildConfirmedResult,
  evaluateDraft,
  RoundNotConfirmableError,
} from '../../src/domain/round/roundEvaluation';
import { DEMO_TARGET } from '../../src/domain/target/targetDefinition';

// Photo where the demo target's outer ring (100 mm) spans 400 px: 4 px per mm, centre (500, 500).
const CALIBRATION = [
  { x: 500, y: 100 },
  { x: 900, y: 500 },
  { x: 500, y: 900 },
  { x: 100, y: 500 },
] as const;

function mark(id: string, xMm: number, yMm: number, shots = 1): HitMark {
  return {
    id,
    position: { x: 500 + xMm * 4, y: 500 + yMm * 4 },
    shots,
    source: 'manual',
    uncertain: false,
    accepted: true,
    candidateId: null,
    attemptId: null,
  };
}

function draft(overrides: Partial<DraftRound> = {}): DraftRound {
  return {
    state: 'draft',
    revision: 0,
    id: 'r',
    sessionId: 's',
    sequence: 1,
    createdAtUtc: 't',
    actualShots: 3,
    declaredMisses: 0,
    unresolvedShots: 0,
    targetId: DEMO_TARGET.id,
    hitDiameterMm: 9,
    hitDiameterSource: 'userSet',
    calibration: CALIBRATION,
    photos: { before: null, after: null },
    marks: [mark('a', 0, 0), mark('b', 44.5, 0), mark('c', 0, 120)],
    ...overrides,
  };
}

describe('evaluateDraft', () => {
  it('maps marks through the calibration and scores them', () => {
    const evaluation = evaluateDraft(draft(), DEMO_TARGET);

    expect(evaluation.blockReason).toBeNull();
    expect(evaluation.status).toBe('complete');
    expect(evaluation.shots?.map((shot) => shot.value)).toEqual([10, 7, 0]);
    expect(evaluation.shots?.[1]?.centreMm.x).toBeCloseTo(44.5, 6);
    expect(evaluation.score).toEqual({ subtotal: 17, total: 17 });
  });

  it('gives the higher value when a hole touches a boundary after mapping', () => {
    const evaluation = evaluateDraft(
      draft({ marks: [mark('b', 44.5, 0)], actualShots: 1 }),
      DEMO_TARGET,
    );
    expect(evaluation.shots?.[0]?.value).toBe(7);
  });

  it('changes the score when the hole diameter changes', () => {
    const marks = [mark('b', 44.5, 0)];
    expect(
      evaluateDraft(draft({ marks, actualShots: 1, hitDiameterMm: 8 }), DEMO_TARGET).shots?.[0]
        ?.value,
    ).toBe(6);
  });

  it('counts a hole with several shots once per shot', () => {
    const evaluation = evaluateDraft(
      draft({ marks: [mark('a', 0, 0, 2)], actualShots: 2 }),
      DEMO_TARGET,
    );
    expect(evaluation.hitShots).toBe(2);
    expect(evaluation.score).toEqual({ subtotal: 20, total: 20 });
  });

  it('needs a calibration before hits can be scored', () => {
    const evaluation = evaluateDraft(draft({ calibration: null }), DEMO_TARGET);
    expect(evaluation.blockReason).toBe('calibrationNeeded');
    expect(evaluation.score).toBeNull();
  });

  it('does not need a calibration when every shot is a miss or unresolved', () => {
    const evaluation = evaluateDraft(
      draft({ calibration: null, marks: [], declaredMisses: 2, unresolvedShots: 1 }),
      DEMO_TARGET,
    );
    expect(evaluation.blockReason).toBeNull();
    expect(evaluation.status).toBe('incomplete');
    expect(evaluation.score).toEqual({ subtotal: 0, total: null });
  });

  it('rejects a calibration in the wrong tap order', () => {
    const swapped = [CALIBRATION[0], CALIBRATION[2], CALIBRATION[1], CALIBRATION[3]] as const;
    expect(evaluateDraft(draft({ calibration: swapped }), DEMO_TARGET).blockReason).toBe(
      'calibrationInvalid',
    );
  });

  it('blocks when marks and declared shots do not add up', () => {
    expect(evaluateDraft(draft({ actualShots: 5 }), DEMO_TARGET).blockReason).toBe('tooFew');
    expect(evaluateDraft(draft({ actualShots: 2 }), DEMO_TARGET).blockReason).toBe('tooMany');
  });

  it('blocks an unknown target', () => {
    expect(evaluateDraft(draft(), null).blockReason).toBe('unknownTarget');
  });
});

describe('buildConfirmedResult', () => {
  it('fixes the target, rule, counts and scores', () => {
    const result = buildConfirmedResult(draft({ actualShots: 4, declaredMisses: 1 }), DEMO_TARGET);
    expect(result).toMatchObject({
      targetId: 'demo-synthetic-v1',
      scoringRule: 'contact-highest-v1',
      hitDiameterMm: 9,
      actualShots: 4,
      declaredMisses: 1,
      unresolvedShots: 0,
      status: 'complete',
      subtotal: 17,
      total: 17,
    });
    expect(result.shots).toHaveLength(3);
  });

  it('keeps an incomplete round as a subtotal', () => {
    const result = buildConfirmedResult(draft({ actualShots: 4, unresolvedShots: 1 }), DEMO_TARGET);
    expect(result.status).toBe('incomplete');
    expect(result.total).toBeNull();
    expect(result.subtotal).toBe(17);
  });

  it('refuses a round that does not add up', () => {
    expect(() => buildConfirmedResult(draft({ actualShots: 9 }), DEMO_TARGET)).toThrow(
      RoundNotConfirmableError,
    );
  });

  it('keeps the attempt of accepted or moved suggestions and none for the user’s own hits', () => {
    const result = buildConfirmedResult(
      draft({
        marks: [
          { ...mark('a', 0, 0), source: 'suggested', attemptId: 'att-1' },
          { ...mark('b', 44.5, 0), source: 'suggestedEdited', attemptId: 'att-1' },
          // Accepted before attempts were recorded on marks: nothing is filled in.
          { ...mark('c', 0, 120), source: 'suggested', attemptId: null },
        ],
      }),
      DEMO_TARGET,
    );
    expect(result.shots.map((shot) => [shot.markId, shot.attemptId])).toEqual([
      ['a', 'att-1'],
      ['b', 'att-1'],
      ['c', undefined],
    ]);
    const manual = buildConfirmedResult(draft(), DEMO_TARGET);
    expect(manual.shots.every((shot) => !('attemptId' in shot))).toBe(true);
  });
});

describe('pending suggestions', () => {
  const pending: HitMark = {
    ...mark('s', 0, 0),
    source: 'suggested',
    accepted: false,
    candidateId: 'c1',
    attemptId: null,
  };

  it('are not hits, are not scored and block confirmation', () => {
    const evaluation = evaluateDraft(
      draft({ actualShots: 2, marks: [mark('a', 44.5, 0), pending] }),
      DEMO_TARGET,
    );
    expect(evaluation.hitShots).toBe(1);
    expect(evaluation.pendingSuggestions).toBe(1);
    expect(evaluation.shots?.map((shot) => shot.markId)).toEqual(['a']);
    expect(evaluation.score?.subtotal).toBe(7);
    expect(evaluation.blockReason).toBe('suggestionsPending');
    expect(() =>
      buildConfirmedResult(
        draft({ actualShots: 2, marks: [mark('a', 44.5, 0), pending] }),
        DEMO_TARGET,
      ),
    ).toThrow(RoundNotConfirmableError);
  });

  it('count once accepted, and the result records where each hit came from', () => {
    const result = buildConfirmedResult(
      draft({ actualShots: 2, marks: [mark('a', 44.5, 0), { ...pending, accepted: true }] }),
      DEMO_TARGET,
    );
    expect(result.shots.map((shot) => [shot.markId, shot.source, shot.value])).toEqual([
      ['a', 'manual', 7],
      ['s', 'suggested', 10],
    ]);
  });
});

describe('calibration geometry', () => {
  const after = {
    role: 'after' as const,
    fileName: 'a.jpg',
    originalFileName: 'a.o.jpg',
    width: 1000,
    height: 1000,
    addedAtUtc: 't',
  };

  it('scores nothing from a crossed calibration even though a homography exists', () => {
    const crossed = [CALIBRATION[0], CALIBRATION[2], CALIBRATION[1], CALIBRATION[3]] as const;
    const evaluation = evaluateDraft(
      draft({ calibration: crossed, photos: { before: null, after } }),
      DEMO_TARGET,
    );
    expect(evaluation.blockReason).toBe('calibrationInvalid');
    expect(evaluation.score).toBeNull();
  });

  it('rescores the same photo positions when the calibration moves', () => {
    const base = evaluateDraft(draft({ photos: { before: null, after } }), DEMO_TARGET);
    // Shifting every point 120 px (30 mm) right moves the target centre under the marks.
    const shifted = CALIBRATION.map((point) => ({ x: point.x + 120, y: point.y }));
    const moved = evaluateDraft(
      draft({
        calibration: [
          shifted[0] ?? CALIBRATION[0],
          shifted[1] ?? CALIBRATION[1],
          shifted[2] ?? CALIBRATION[2],
          shifted[3] ?? CALIBRATION[3],
        ],
        photos: { before: null, after },
      }),
      DEMO_TARGET,
    );
    expect(base.shots?.[0]?.value).toBe(10);
    expect(moved.shots?.[0]?.centreMm.x).toBeCloseTo(-30);
    expect(moved.shots?.[0]?.value).toBeLessThan(10);
  });
});
