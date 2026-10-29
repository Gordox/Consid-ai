// Target definitions are versioned; a confirmed round keeps the id it was scored with.

export type ScoringZone = {
  readonly value: number;
  // Outer edge of the zone, measured from the target centre.
  readonly radiusMm: number;
};

export type TargetDefinition = {
  readonly id: string;
  readonly label: string;
  // Synthetic geometry: scores are only for trying the workflow, never for a real target.
  readonly isDemo: boolean;
  // Highest value first. Each zone contains every zone with a higher value.
  readonly zones: readonly ScoringZone[];
  // Calibration taps where the outer edge of the lowest zone crosses the vertical and
  // horizontal axes: top, right, bottom, left.
  readonly calibrationRadiusMm: number;
};

// Ten rings 10 mm apart, the same structure as the owner's X-Targets target but with
// invented dimensions. See implementation/mvp-plan.md §3 for what the real target needs.
export const DEMO_TARGET: TargetDefinition = {
  id: 'demo-synthetic-v1',
  label: 'Demo target',
  isDemo: true,
  zones: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((value) => ({
    value,
    radiusMm: (11 - value) * 10,
  })),
  calibrationRadiusMm: 100,
};

const TARGETS: readonly TargetDefinition[] = [DEMO_TARGET];

export function findTarget(id: string): TargetDefinition | null {
  return TARGETS.find((target) => target.id === id) ?? null;
}

export const DEMO_TARGET_NOTICE =
  'Scores use synthetic demo geometry and are not valid for your real target.';
