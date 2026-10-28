// Geometry of the camera guide: a circle to centre the target in and a frame inside the
// preview's edges. Drawn on screen only, so it is never in the photo's pixels, never used for
// calibration and never a measurement of the target.

export type GuideLayout = {
  readonly circle: { readonly x: number; readonly y: number; readonly diameter: number };
  readonly frame: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
};

// Share of the preview's shorter side the circle covers: room around the target so the whole
// sheet stays in the photo.
export const GUIDE_CIRCLE_SHARE = 0.78;
const FRAME_INSET_SHARE = 0.06;

export function guideLayout(width: number, height: number): GuideLayout {
  const shorter = Math.max(0, Math.min(width, height));
  const diameter = shorter * GUIDE_CIRCLE_SHARE;
  const inset = shorter * FRAME_INSET_SHARE;
  return {
    circle: { x: (width - diameter) / 2, y: (height - diameter) / 2, diameter },
    frame: {
      x: inset,
      y: inset,
      width: Math.max(0, width - 2 * inset),
      height: Math.max(0, height - 2 * inset),
    },
  };
}
