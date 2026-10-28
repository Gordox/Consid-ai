import type { Point } from '../../domain/target/homography';

// Screen position of the photo in the editor. Image pixels map to screen points as
// screen = image × baseScale × zoom + offset. Never stored; marks are saved in image pixels.

export type Size = { readonly width: number; readonly height: number };

export type ViewTransform = {
  readonly baseScale: number; // fits the whole photo in the canvas at zoom 1
  readonly zoom: number;
  readonly offset: Point;
};

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;

export function scaleOf(view: ViewTransform): number {
  return view.baseScale * view.zoom;
}

export function imageToScreen(view: ViewTransform, point: Point): Point {
  const scale = scaleOf(view);
  return { x: point.x * scale + view.offset.x, y: point.y * scale + view.offset.y };
}

export function screenToImage(view: ViewTransform, point: Point): Point {
  const scale = scaleOf(view);
  return { x: (point.x - view.offset.x) / scale, y: (point.y - view.offset.y) / scale };
}

// Centres a dimension that fits, otherwise keeps the photo edge from leaving the canvas edge.
function clampAxis(offset: number, content: number, canvas: number): number {
  if (content <= canvas) {
    return (canvas - content) / 2;
  }
  return Math.min(0, Math.max(canvas - content, offset));
}

export function clampView(view: ViewTransform, image: Size, canvas: Size): ViewTransform {
  const scale = scaleOf(view);
  return {
    ...view,
    offset: {
      x: clampAxis(view.offset.x, image.width * scale, canvas.width),
      y: clampAxis(view.offset.y, image.height * scale, canvas.height),
    },
  };
}

export function fitView(image: Size, canvas: Size): ViewTransform {
  const baseScale = Math.min(canvas.width / image.width, canvas.height / image.height);
  return clampView({ baseScale, zoom: 1, offset: { x: 0, y: 0 } }, image, canvas);
}

// Zooms around a screen point so the image point under it stays under it.
export function zoomAround(
  view: ViewTransform,
  nextZoom: number,
  focus: Point,
  image: Size,
  canvas: Size,
): ViewTransform {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
  const anchor = screenToImage(view, focus);
  const scale = view.baseScale * zoom;
  return clampView(
    {
      baseScale: view.baseScale,
      zoom,
      offset: { x: focus.x - anchor.x * scale, y: focus.y - anchor.y * scale },
    },
    image,
    canvas,
  );
}

export function panBy(view: ViewTransform, delta: Point, image: Size, canvas: Size): ViewTransform {
  return clampView(
    { ...view, offset: { x: view.offset.x + delta.x, y: view.offset.y + delta.y } },
    image,
    canvas,
  );
}
