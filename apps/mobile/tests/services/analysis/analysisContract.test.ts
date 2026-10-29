import { parseAnalysisResponse } from '../../../src/services/analysis/analysisContract';

const EXPECTED = { roundId: 'r1', attemptId: 'a1', imageWidth: 4000, imageHeight: 3000 };

function body(overrides: Record<string, unknown> = {}) {
  return {
    roundId: 'r1',
    attemptId: 'a1',
    status: 'succeeded',
    algorithmVersion: 'opencv-baseline-0.1',
    image: { width: 4000, height: 3000 },
    candidates: [{ id: 'c1', x: 2000, y: 1500, diameterPx: 40, confidence: 0.9, uncertain: false }],
    warnings: [{ code: 'glare' }],
    ...overrides,
  };
}

describe('parseAnalysisResponse', () => {
  it('accepts a valid answer and keeps only the fields the app uses', () => {
    expect(parseAnalysisResponse(body(), EXPECTED)).toEqual({
      ok: true,
      value: {
        status: 'succeeded',
        algorithmVersion: 'opencv-baseline-0.1',
        candidates: [
          { id: 'c1', x: 2000, y: 1500, diameterPx: 40, confidence: 0.9, uncertain: false },
        ],
        warnings: ['glare'],
      },
    });
  });

  it('accepts the numberColumnsSkipped warning of contract 1.2', () => {
    expect(
      parseAnalysisResponse(
        body({ warnings: [{ code: 'stickerEdges' }, { code: 'numberColumnsSkipped' }] }),
        EXPECTED,
      ),
    ).toMatchObject({ ok: true, value: { warnings: ['stickerEdges', 'numberColumnsSkipped'] } });
  });

  it('allows a missing image size only when the photo could not be decoded', () => {
    expect(
      parseAnalysisResponse(
        body({ status: 'unusableImage', image: null, candidates: [] }),
        EXPECTED,
      ),
    ).toMatchObject({ ok: true, value: { status: 'unusableImage' } });
    expect(parseAnalysisResponse(body({ image: null }), EXPECTED)).toEqual({
      ok: false,
      error: 'imageMismatch',
    });
  });

  it.each([0, -3, Number.NaN, '40'])('rejects a diameter of %p', (diameterPx) => {
    const candidate = { id: 'c1', x: 2000, y: 1500, diameterPx, confidence: 0.9, uncertain: false };
    expect(parseAnalysisResponse(body({ candidates: [candidate] }), EXPECTED)).toEqual({
      ok: false,
      error: 'invalidResponse',
    });
  });

  it('accepts an empty candidate list only as a real result', () => {
    expect(parseAnalysisResponse(body({ candidates: [] }), EXPECTED).ok).toBe(true);
    expect(
      parseAnalysisResponse(body({ status: 'unusableImage', candidates: [] }), EXPECTED),
    ).toMatchObject({
      ok: true,
      value: { status: 'unusableImage' },
    });
  });

  it('refuses candidates on a failed analysis', () => {
    expect(parseAnalysisResponse(body({ status: 'registrationFailed' }), EXPECTED)).toEqual({
      ok: false,
      error: 'invalidResponse',
    });
  });

  it('marks an answer to another attempt as stale', () => {
    expect(parseAnalysisResponse(body({ attemptId: 'a0' }), EXPECTED)).toEqual({
      ok: false,
      error: 'stale',
    });
  });

  it('rejects an answer for a photo of another size', () => {
    expect(parseAnalysisResponse(body({ image: { width: 3000, height: 4000 } }), EXPECTED)).toEqual(
      {
        ok: false,
        error: 'imageMismatch',
      },
    );
  });

  it.each([
    ['not an object', 'nonsense'],
    ['unknown status', body({ status: 'done' })],
    ['missing version', body({ algorithmVersion: '' })],
    [
      'candidate outside the photo',
      body({ candidates: [{ id: 'c', x: 4001, y: 1, confidence: 1, uncertain: false }] }),
    ],
    [
      'negative coordinate',
      body({ candidates: [{ id: 'c', x: -1, y: 1, confidence: 1, uncertain: false }] }),
    ],
    [
      'non-finite coordinate',
      body({ candidates: [{ id: 'c', x: Number.NaN, y: 1, confidence: 1, uncertain: false }] }),
    ],
    [
      'confidence above 1',
      body({ candidates: [{ id: 'c', x: 1, y: 1, confidence: 1.2, uncertain: false }] }),
    ],
    ['missing uncertain flag', body({ candidates: [{ id: 'c', x: 1, y: 1, confidence: 0.5 }] })],
    [
      'duplicate candidate ids',
      body({
        candidates: [
          { id: 'c', x: 1, y: 1, confidence: 0.5, uncertain: false },
          { id: 'c', x: 2, y: 2, confidence: 0.5, uncertain: false },
        ],
      }),
    ],
    [
      'too many candidates',
      body({
        candidates: Array.from({ length: 101 }, (_, i) => ({
          id: `c${i}`,
          x: 1,
          y: 1,
          confidence: 1,
          uncertain: false,
        })),
      }),
    ],
    ['unknown warning', body({ warnings: [{ code: 'rain' }] })],
    ['missing round id', body({ roundId: undefined, attemptId: undefined })],
  ])('rejects %s', (_label, answer) => {
    expect(parseAnalysisResponse(answer, EXPECTED).ok).toBe(false);
  });
});
