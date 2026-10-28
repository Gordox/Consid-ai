import { CONTACT_EPSILON_MM, scoreShot } from '../../src/domain/target/scoring';
import { DEMO_TARGET, findTarget } from '../../src/domain/target/targetDefinition';

// Demo target: zone v has outer radius (11 − v) × 10 mm, so the 6/7 boundary is at 40 mm.
const D = 9;
const HALF = D / 2;

describe('scoreShot on the demo target', () => {
  it('scores the interior of each zone', () => {
    expect(scoreShot(DEMO_TARGET, { x: 0, y: 0 }, D).value).toBe(10);
    expect(scoreShot(DEMO_TARGET, { x: 0, y: -(75 + HALF + 1) }, D).value).toBe(3);
  });

  it('gives the higher value when the hole edge touches the boundary exactly', () => {
    // Centre in zone 6 with its edge exactly on the 7 boundary at 40 mm.
    expect(scoreShot(DEMO_TARGET, { x: 40 + HALF, y: 0 }, D).value).toBe(7);
  });

  it('separates just inside and just outside contact', () => {
    expect(scoreShot(DEMO_TARGET, { x: 40 + HALF - 0.001, y: 0 }, D).value).toBe(7);
    expect(scoreShot(DEMO_TARGET, { x: 40 + HALF + 0.001, y: 0 }, D).value).toBe(6);
  });

  it('measures the distance in any direction', () => {
    const r = (40 + HALF) / Math.SQRT2;
    expect(scoreShot(DEMO_TARGET, { x: -r, y: r }, D).value).toBe(7);
  });

  it('depends on the hole diameter', () => {
    const centre = { x: 44, y: 0 };
    expect(scoreShot(DEMO_TARGET, centre, 7).value).toBe(6);
    expect(scoreShot(DEMO_TARGET, centre, 8).value).toBe(7);
  });

  it('scores 0 outside every zone, including a hole just clear of the outer ring', () => {
    expect(scoreShot(DEMO_TARGET, { x: 100 + HALF + 0.01, y: 0 }, D).value).toBe(0);
    expect(scoreShot(DEMO_TARGET, { x: 100 + HALF, y: 0 }, D).value).toBe(1);
  });

  it('uses only a floating-point epsilon, not a scoring allowance', () => {
    expect(CONTACT_EPSILON_MM).toBeLessThan(1e-6);
    expect(scoreShot(DEMO_TARGET, { x: 40 + HALF + 1e-6, y: 0 }, D).value).toBe(6);
  });

  it('rejects invalid geometry', () => {
    expect(() => scoreShot(DEMO_TARGET, { x: Number.NaN, y: 0 }, D)).toThrow(RangeError);
    expect(() => scoreShot(DEMO_TARGET, { x: 0, y: 0 }, 0)).toThrow(RangeError);
    expect(() => scoreShot(DEMO_TARGET, { x: 0, y: 0 }, -1)).toThrow(RangeError);
    expect(() => scoreShot(DEMO_TARGET, { x: 0, y: 0 }, Number.POSITIVE_INFINITY)).toThrow(
      RangeError,
    );
  });
});

describe('target definitions', () => {
  it('only knows the demo target, which is marked as demo', () => {
    expect(findTarget('demo-synthetic-v1')).toBe(DEMO_TARGET);
    expect(DEMO_TARGET.isDemo).toBe(true);
    expect(findTarget('x-targets-precision')).toBeNull();
  });

  it('orders zones from the highest value with growing radii', () => {
    const values = DEMO_TARGET.zones.map((zone) => zone.value);
    const radii = DEMO_TARGET.zones.map((zone) => zone.radiusMm);
    expect(values).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(radii).toEqual([...radii].sort((a, b) => a - b));
    expect(DEMO_TARGET.calibrationRadiusMm).toBe(radii.at(-1));
  });
});
