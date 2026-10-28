import type { Point } from '../target/homography';

// Whether four calibration taps can describe the target, checked before any ring or score is
// derived from them. A homography exists for many crossed or folded outlines, so that alone is
// not enough: it would draw misleading rings and score hits in the wrong zones.

export type CalibrationProblem = 'tooClose' | 'wrongOrder';

type Size = { readonly width: number; readonly height: number };

// Points closer than this share of the photo's shorter side are treated as the same point.
const MIN_POINT_SEPARATION = 0.02;

// Why four calibration points cannot describe the target, or null when they can. Top, right,
// bottom and left go round the target clockwise on screen (y grows downwards), so every turn of
// the outline must have the same sign; a crossed or folded outline would draw misleading rings.
export function calibrationProblem(
  points: readonly Point[],
  image: Size,
): CalibrationProblem | null {
  if (points.length !== 4) return null;
  const minSeparation = MIN_POINT_SEPARATION * Math.min(image.width, image.height);
  for (let a = 0; a < 4; a += 1) {
    for (let b = a + 1; b < 4; b += 1) {
      const p = points[a];
      const q = points[b];
      if (p !== undefined && q !== undefined && Math.hypot(p.x - q.x, p.y - q.y) < minSeparation) {
        return 'tooClose';
      }
    }
  }
  for (let index = 0; index < 4; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % 4];
    const c = points[(index + 2) % 4];
    if (a === undefined || b === undefined || c === undefined) return 'wrongOrder';
    const turn = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (turn <= 0) return 'wrongOrder';
  }
  return null;
}
