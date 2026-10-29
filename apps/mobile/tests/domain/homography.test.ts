import {
  applyHomography,
  computeHomography,
  type Homography,
  invertHomography,
  isConvexQuad,
  type Point,
  type Quad,
} from '../../src/domain/target/homography';

const R = 100;
const TARGET_QUAD: Quad = [
  { x: 0, y: -R },
  { x: R, y: 0 },
  { x: 0, y: R },
  { x: -R, y: 0 },
];

function toQuad(points: readonly Point[]): Quad {
  const [a, b, c, d] = points;
  if (a === undefined || b === undefined || c === undefined || d === undefined) {
    throw new Error('expected four points');
  }
  return [a, b, c, d];
}

function expectClose(actual: Point | null, expected: Point, digits = 6): void {
  expect(actual).not.toBeNull();
  expect(actual?.x).toBeCloseTo(expected.x, digits);
  expect(actual?.y).toBeCloseTo(expected.y, digits);
}

function homography(from: Quad, to: Quad): Homography {
  const result = computeHomography(from, to);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

// A known projective map, used to generate perspective photos of the target plane.
function project(point: Point): Point {
  const w = 0.0004 * point.x - 0.0007 * point.y + 1;
  return {
    x: (1.8 * point.x + 0.3 * point.y + 640) / w,
    y: (-0.2 * point.x + 1.6 * point.y + 480) / w,
  };
}

describe('computeHomography', () => {
  it('maps a scaled and shifted photo back to target millimetres', () => {
    const photo: Quad = [
      { x: 500, y: 100 },
      { x: 900, y: 500 },
      { x: 500, y: 900 },
      { x: 100, y: 500 },
    ];
    const h = homography(photo, TARGET_QUAD);

    expectClose(applyHomography(h, { x: 500, y: 500 }), { x: 0, y: 0 });
    expectClose(applyHomography(h, { x: 540, y: 500 }), { x: 10, y: 0 });
  });

  it('recovers target positions from a perspective photo', () => {
    const photo = toQuad(TARGET_QUAD.map(project));
    const h = homography(photo, TARGET_QUAD);

    for (const point of [
      { x: 0, y: 0 },
      { x: 37.5, y: -12.25 },
      { x: -80, y: 60 },
      { x: 99, y: 99 },
    ]) {
      expectClose(applyHomography(h, project(point)), point, 5);
    }
  });

  it('round-trips through the inverse', () => {
    const photo = toQuad(TARGET_QUAD.map(project));
    const h = homography(photo, TARGET_QUAD);
    const inverse = invertHomography(h);
    if (inverse === null) {
      throw new Error('expected an inverse');
    }

    const target = { x: 23, y: -41 };
    expectClose(applyHomography(inverse, target), project(target), 4);
  });

  it('rejects taps in the wrong order (self-intersecting quad)', () => {
    const swapped: Quad = [
      { x: 500, y: 100 },
      { x: 500, y: 900 },
      { x: 900, y: 500 },
      { x: 100, y: 500 },
    ];
    expect(computeHomography(swapped, TARGET_QUAD)).toEqual({ ok: false, error: 'notConvex' });
  });

  it('rejects three points on a line and repeated points', () => {
    const flat: Quad = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 100, y: 100 },
    ];
    const repeated: Quad = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(computeHomography(flat, TARGET_QUAD).ok).toBe(false);
    expect(computeHomography(repeated, TARGET_QUAD).ok).toBe(false);
  });

  it('rejects non-finite coordinates', () => {
    const broken: Quad = [
      { x: Number.NaN, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(computeHomography(broken, TARGET_QUAD)).toEqual({ ok: false, error: 'notFinite' });
  });
});

describe('isConvexQuad', () => {
  it('accepts both winding directions', () => {
    expect(isConvexQuad(TARGET_QUAD)).toBe(true);
    expect(isConvexQuad(toQuad([...TARGET_QUAD].reverse()))).toBe(true);
  });
});
