// Plane-to-plane projective mapping from four point pairs. Used to map photo pixels to target
// millimetres, so perspective is handled and the photo's scale is never used as a length.

export type Point = { readonly x: number; readonly y: number };

// Row-major 3x3 matrix with h[8] normalised to 1.
export type Homography = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export type Quad = readonly [Point, Point, Point, Point];

export type HomographyError = 'notFinite' | 'notConvex' | 'degenerate';

// Below this a pivot or projective denominator is treated as zero.
const SINGULAR_EPSILON = 1e-12;

function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

// Indexes are always in range here; a miss is a programming error, not a data error.
function at<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) {
    throw new RangeError(`Index ${index} is out of range`);
  }
  return value;
}

// Taps in the wrong order or three points on a line give a self-intersecting or flat quad.
export function isConvexQuad(quad: Quad): boolean {
  const signs = quad.map((point, index) =>
    Math.sign(cross(point, at(quad, (index + 1) % 4), at(quad, (index + 2) % 4))),
  );
  return signs.every((sign) => sign === 1) || signs.every((sign) => sign === -1);
}

// Gauss-Jordan elimination with partial pivoting on an augmented copy; null when singular.
function solve(matrix: readonly (readonly number[])[], vector: readonly number[]): number[] | null {
  const n = vector.length;
  const rows = matrix.map((row, index) => [...row, at(vector, index)]);
  for (let column = 0; column < n; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < n; row += 1) {
      if (Math.abs(at(at(rows, row), column)) > Math.abs(at(at(rows, pivot), column))) {
        pivot = row;
      }
    }
    if (Math.abs(at(at(rows, pivot), column)) < SINGULAR_EPSILON) {
      return null;
    }
    const pivotRow = at(rows, pivot);
    rows[pivot] = at(rows, column);
    rows[column] = pivotRow;
    for (let row = 0; row < n; row += 1) {
      if (row === column) {
        continue;
      }
      const target = at(rows, row);
      const factor = at(target, column) / at(pivotRow, column);
      for (let k = column; k <= n; k += 1) {
        target[k] = at(target, k) - factor * at(pivotRow, k);
      }
    }
  }
  return rows.map((row, index) => at(row, n) / at(row, index));
}

export function computeHomography(
  from: Quad,
  to: Quad,
): { ok: true; value: Homography } | { ok: false; error: HomographyError } {
  if (![...from, ...to].every(isFinitePoint)) {
    return { ok: false, error: 'notFinite' };
  }
  if (!isConvexQuad(from) || !isConvexQuad(to)) {
    return { ok: false, error: 'notConvex' };
  }
  const rows: number[][] = [];
  const values: number[] = [];
  from.forEach((source, index) => {
    const target = at(to, index);
    rows.push([source.x, source.y, 1, 0, 0, 0, -target.x * source.x, -target.x * source.y]);
    values.push(target.x);
    rows.push([0, 0, 0, source.x, source.y, 1, -target.y * source.x, -target.y * source.y]);
    values.push(target.y);
  });
  const solution = solve(rows, values);
  const homography = solution === null ? null : toHomography([...solution, 1]);
  return homography === null ? { ok: false, error: 'degenerate' } : { ok: true, value: homography };
}

export function applyHomography(h: Homography, point: Point): Point | null {
  const w = h[6] * point.x + h[7] * point.y + h[8];
  if (Math.abs(w) < SINGULAR_EPSILON) {
    return null;
  }
  const x = (h[0] * point.x + h[1] * point.y + h[2]) / w;
  const y = (h[3] * point.x + h[4] * point.y + h[5]) / w;
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

export function invertHomography(h: Homography): Homography | null {
  const [a, b, c, d, e, f, g, k, m] = h;
  const det = a * (e * m - f * k) - b * (d * m - f * g) + c * (d * k - e * g);
  if (Math.abs(det) < SINGULAR_EPSILON) {
    return null;
  }
  const inverse = [
    (e * m - f * k) / det,
    (c * k - b * m) / det,
    (b * f - c * e) / det,
    (f * g - d * m) / det,
    (a * m - c * g) / det,
    (c * d - a * f) / det,
    (d * k - e * g) / det,
    (b * g - a * k) / det,
    (a * e - b * d) / det,
  ];
  const scale = at(inverse, 8);
  if (Math.abs(scale) < SINGULAR_EPSILON) {
    return null;
  }
  return toHomography(inverse.map((value) => value / scale));
}

function toHomography(values: readonly number[]): Homography | null {
  const [a, b, c, d, e, f, g, h, i] = values;
  if (
    a === undefined ||
    b === undefined ||
    c === undefined ||
    d === undefined ||
    e === undefined ||
    f === undefined ||
    g === undefined ||
    h === undefined ||
    i === undefined
  ) {
    return null;
  }
  const matrix: Homography = [a, b, c, d, e, f, g, h, i];
  return matrix.every(Number.isFinite) ? matrix : null;
}
