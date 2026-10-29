import {
  applyHomography,
  type Homography,
  invertHomography,
  type Point,
} from '../../domain/target/homography';
import { photoToTarget } from '../../domain/round/roundEvaluation';
import type { Calibration } from '../../domain/round/round';
import type { TargetDefinition } from '../../domain/target/targetDefinition';

// Outlines of the target's zones drawn onto the photo through the calibration, so the user can
// see whether the calibration matches the printed rings.

const SEGMENTS = 72;

export function targetToPhoto(
  calibration: Calibration,
  target: TargetDefinition,
): Homography | null {
  const forward = photoToTarget(calibration, target);
  return forward === null ? null : invertHomography(forward);
}

// Points of a circle around the target centre, in photo pixels. Null if any point cannot be
// projected (a broken calibration).
export function projectCircle(
  toPhoto: Homography,
  radiusMm: number,
  centreMm: Point = { x: 0, y: 0 },
): Point[] | null {
  const points: Point[] = [];
  for (let index = 0; index < SEGMENTS; index += 1) {
    const angle = (index / SEGMENTS) * Math.PI * 2;
    const projected = applyHomography(toPhoto, {
      x: centreMm.x + radiusMm * Math.cos(angle),
      y: centreMm.y + radiusMm * Math.sin(angle),
    });
    if (projected === null) return null;
    points.push(projected);
  }
  return points;
}

export function ringOutlines(calibration: Calibration, target: TargetDefinition): Point[][] | null {
  const toPhoto = targetToPhoto(calibration, target);
  if (toPhoto === null) return null;
  const outlines: Point[][] = [];
  for (const zone of target.zones) {
    const outline = projectCircle(toPhoto, zone.radiusMm);
    if (outline === null) return null;
    outlines.push(outline);
  }
  return outlines;
}

// Hole size on the photo near a mark: the photo distance covered by the hole radius there.
export function holeRadiusInPhoto(
  calibration: Calibration | null,
  target: TargetDefinition,
  markInPhoto: Point,
  diameterMm: number,
): number | null {
  if (calibration === null) return null;
  const toTarget = photoToTarget(calibration, target);
  const toPhoto = toTarget === null ? null : invertHomography(toTarget);
  if (toTarget === null || toPhoto === null) return null;
  const centreMm = applyHomography(toTarget, markInPhoto);
  if (centreMm === null) return null;
  const edge = applyHomography(toPhoto, { x: centreMm.x + diameterMm / 2, y: centreMm.y });
  return edge === null ? null : Math.hypot(edge.x - markInPhoto.x, edge.y - markInPhoto.y);
}
