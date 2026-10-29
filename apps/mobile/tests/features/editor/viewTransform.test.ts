import {
  fitView,
  imageToScreen,
  MAX_ZOOM,
  panBy,
  screenToImage,
  zoomAround,
} from '../../../src/features/editor/viewTransform';

const IMAGE = { width: 4000, height: 3000 };
const CANVAS = { width: 400, height: 600 };

describe('view transform', () => {
  it('fits and centres the photo at zoom 1', () => {
    const view = fitView(IMAGE, CANVAS);
    expect(view.baseScale).toBeCloseTo(0.1);
    expect(imageToScreen(view, { x: 0, y: 0 })).toEqual({ x: 0, y: 150 });
    expect(imageToScreen(view, { x: 4000, y: 3000 })).toEqual({ x: 400, y: 450 });
  });

  it('round-trips between image pixels and screen points at any zoom and pan', () => {
    let view = fitView(IMAGE, CANVAS);
    view = zoomAround(view, 3.5, { x: 120, y: 260 }, IMAGE, CANVAS);
    view = panBy(view, { x: -37, y: 12 }, IMAGE, CANVAS);
    const point = { x: 1234.5, y: 987.25 };
    const back = screenToImage(view, imageToScreen(view, point));
    expect(back.x).toBeCloseTo(point.x, 9);
    expect(back.y).toBeCloseTo(point.y, 9);
  });

  it('keeps the image point under the fingers while zooming', () => {
    const view = fitView(IMAGE, CANVAS);
    const focus = { x: 200, y: 300 };
    const before = screenToImage(view, focus);
    const zoomed = zoomAround(view, 2, focus, IMAGE, CANVAS);
    const after = screenToImage(zoomed, focus);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  it('limits zoom and keeps the photo inside the canvas', () => {
    const view = zoomAround(fitView(IMAGE, CANVAS), 100, { x: 0, y: 0 }, IMAGE, CANVAS);
    expect(view.zoom).toBe(MAX_ZOOM);
    const panned = panBy(view, { x: 99999, y: 99999 }, IMAGE, CANVAS);
    expect(panned.offset.x).toBe(0);
    expect(panned.offset.y).toBe(0);
    const far = panBy(view, { x: -99999, y: -99999 }, IMAGE, CANVAS);
    expect(imageToScreen(far, { x: 4000, y: 3000 }).x).toBeCloseTo(CANVAS.width, 6);
  });
});
