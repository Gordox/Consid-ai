import type { Point } from './homography';
import type { TargetDefinition } from './targetDefinition';

// Rule id stored with every confirmed round, so a later rule change never rescores history.
export const SCORING_RULE_VERSION = 'contact-highest-v1';

// Floating-point noise only, in millimetres. Not a scoring allowance.
export const CONTACT_EPSILON_MM = 1e-9;

export type ShotScore = {
  readonly value: number;
  // Distance from the target centre to the centre of the hole.
  readonly centreDistanceMm: number;
};

// A hole touching the boundary between two zones gets the higher value: zone R is touched
// when d − D/2 ≤ R. Outside every zone the value is 0 ("outside rings"), not a miss.
export function scoreShot(
  target: TargetDefinition,
  centreMm: Point,
  diameterMm: number,
): ShotScore {
  if (!Number.isFinite(centreMm.x) || !Number.isFinite(centreMm.y)) {
    throw new RangeError('Shot centre must be finite');
  }
  if (!Number.isFinite(diameterMm) || diameterMm <= 0) {
    throw new RangeError('Hit diameter must be a positive finite number');
  }
  const centreDistanceMm = Math.hypot(centreMm.x, centreMm.y);
  const nearestEdge = centreDistanceMm - diameterMm / 2;
  for (const zone of target.zones) {
    if (nearestEdge <= zone.radiusMm + CONTACT_EPSILON_MM) {
      return { value: zone.value, centreDistanceMm };
    }
  }
  return { value: 0, centreDistanceMm };
}
