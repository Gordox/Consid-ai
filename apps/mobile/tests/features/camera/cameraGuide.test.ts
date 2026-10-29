import { GUIDE_CIRCLE_SHARE, guideLayout } from '../../../src/features/camera/cameraGuide';

describe('guideLayout', () => {
  it('centres a circle inside the preview, sized from the shorter side', () => {
    const { circle, frame } = guideLayout(360, 640);
    expect(circle.diameter).toBeCloseTo(360 * GUIDE_CIRCLE_SHARE);
    expect(circle.x + circle.diameter / 2).toBeCloseTo(180);
    expect(circle.y + circle.diameter / 2).toBeCloseTo(320);
    expect(frame.x).toBeGreaterThan(0);
    expect(frame.x + frame.width).toBeLessThan(360);
    expect(frame.y + frame.height).toBeLessThan(640);
  });

  it('keeps the circle inside the frame in landscape too', () => {
    const { circle, frame } = guideLayout(800, 360);
    expect(circle.y).toBeGreaterThanOrEqual(frame.y);
    expect(circle.y + circle.diameter).toBeLessThanOrEqual(frame.y + frame.height);
  });

  it('never returns negative sizes before layout', () => {
    const { circle, frame } = guideLayout(0, 0);
    expect(circle.diameter).toBe(0);
    expect(frame.width).toBe(0);
  });
});
