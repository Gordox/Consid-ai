import { holeRadiusInPhoto, ringOutlines } from '../../../src/features/editor/targetOverlay';
import { DEMO_TARGET } from '../../../src/domain/target/targetDefinition';

// 4 px per mm, centre (500, 500).
const CALIBRATION = [
  { x: 500, y: 100 },
  { x: 900, y: 500 },
  { x: 500, y: 900 },
  { x: 100, y: 500 },
] as const;

describe('target overlay', () => {
  it('projects every zone outline onto the photo', () => {
    const outlines = ringOutlines(CALIBRATION, DEMO_TARGET);
    expect(outlines).toHaveLength(10);
    const outer = outlines?.at(-1) ?? [];
    for (const point of outer) {
      expect(Math.hypot(point.x - 500, point.y - 500)).toBeCloseTo(400, 6);
    }
    const ten = outlines?.[0]?.[0];
    expect(ten?.x).toBeCloseTo(540, 6);
  });

  it('gives the hole radius in photo pixels', () => {
    expect(holeRadiusInPhoto(CALIBRATION, DEMO_TARGET, { x: 520, y: 500 }, 9)).toBeCloseTo(18, 6);
    expect(holeRadiusInPhoto(null, DEMO_TARGET, { x: 520, y: 500 }, 9)).toBeNull();
  });

  it('returns null for a calibration that is not a valid outline', () => {
    const swapped = [CALIBRATION[0], CALIBRATION[2], CALIBRATION[1], CALIBRATION[3]] as const;
    expect(ringOutlines(swapped, DEMO_TARGET)).toBeNull();
  });
});
