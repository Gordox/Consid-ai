import type { HitMark } from '../../domain/round/round';
import type { Point } from '../../domain/target/homography';
import type { EditorAction } from './annotationEditor';
import { scaleOf, type Size, type ViewTransform } from './viewTransform';

// Decisions behind the editor's touch handling, kept pure so they can be tested without a
// device. Positions are image pixels unless a name says screen.

// calibrate: place the four alignment points. add: a tap adds a hit. pan: a tap only selects,
// so moving around the photo can never add a hit by accident.
export type EditorTool = 'calibrate' | 'add' | 'pan';

// Marks whose centre is within reach, nearest first.
export function marksNear(marks: readonly HitMark[], point: Point, reach: number): HitMark[] {
  return marks
    .map((mark) => ({
      mark,
      distance: Math.hypot(mark.position.x - point.x, mark.position.y - point.y),
    }))
    .filter(({ distance }) => distance <= reach)
    .sort((a, b) => a.distance - b.distance)
    .map(({ mark }) => mark);
}

// Overlapping touch areas: repeated taps step through the marks under the finger instead of
// always picking the same one.
export function nextSelection(
  candidates: readonly HitMark[],
  selectedId: string | null,
): string | null {
  if (candidates.length === 0) return null;
  const index = candidates.findIndex((mark) => mark.id === selectedId);
  return candidates[(index + 1) % candidates.length]?.id ?? null;
}

// The placed calibration point within reach, nearest first, or null.
export function pointNear(points: readonly Point[], at: Point, reach: number): number | null {
  let best: number | null = null;
  let bestDistance = reach;
  points.forEach((point, index) => {
    const distance = Math.hypot(point.x - at.x, point.y - at.y);
    if (distance <= bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

export type Release = {
  readonly tool: EditorTool;
  // Placed calibration points; with four, a tap away from them only clears the selection.
  readonly calibrationPoints: readonly Point[];
  // The finger moved beyond the tap slop.
  readonly moved: boolean;
  readonly start: Point;
  // Where the finger lifted; in calibrate and add mode a drag fine-positions the new point.
  readonly end: Point;
  readonly marks: readonly HitMark[];
  readonly selectedId: string | null;
  // Touch reach in image pixels at the current zoom.
  readonly reach: number;
  readonly newId: () => string;
};

// What a single-finger gesture does when the finger lifts. Dragging a selected mark and
// panning are handled while the finger moves and are not decided here.
export function releaseAction(release: Release): EditorAction | null {
  const { tool, moved, start, end, marks, selectedId, reach } = release;
  if (tool === 'calibrate') {
    if (release.calibrationPoints.length < 4) {
      return { type: 'addCalibrationPoint', point: end };
    }
    return moved ? null : { type: 'selectPoint', index: null };
  }
  if (!moved) {
    const candidates = marksNear(marks, start, reach);
    if (candidates.length > 0) {
      return { type: 'select', id: nextSelection(candidates, selectedId) };
    }
  }
  if (tool === 'add') {
    return { type: 'addMark', id: release.newId(), point: end };
  }
  return moved ? null : { type: 'select', id: null };
}

// Accepted marks are numbered 1, 2, 3… in their stored order; suggestions show '?' instead.
export function markerNumbers(marks: readonly HitMark[]): ReadonlyMap<string, number> {
  const numbers = new Map<string, number>();
  for (const mark of marks) {
    if (mark.accepted) numbers.set(mark.id, numbers.size + 1);
  }
  return numbers;
}

export const MAGNIFIER = {
  // Logical diameter and local enlargement from docs/design/ui-ux.md §9.
  size: 120,
  factor: 2,
  // Space between the finger and the magnifier's edge.
  gap: 24,
} as const;

// Top-left corner of the magnifier on the canvas: above the finger, or below it near the top
// edge, and always inside the canvas so it never sits under the status bar or off screen.
export function magnifierPosition(
  finger: Point,
  canvas: Size,
  size: number = MAGNIFIER.size,
): Point {
  const offset = size / 2 + MAGNIFIER.gap;
  const clamp = (value: number, max: number) => Math.min(Math.max(0, value), Math.max(0, max));
  const above = finger.y - offset - size / 2;
  const y = above >= 0 ? above : finger.y + offset - size / 2;
  return {
    x: clamp(finger.x - size / 2, canvas.width - size),
    y: clamp(y, canvas.height - size),
  };
}

// The photo inside the magnifier: the same image, enlarged around the focus point so the focus
// sits in the magnifier's centre. Display only; it never changes stored geometry.
export function magnifiedView(
  view: ViewTransform,
  focus: Point,
  size: number = MAGNIFIER.size,
  factor: number = MAGNIFIER.factor,
): { readonly scale: number; readonly offset: Point } {
  const scale = scaleOf(view) * factor;
  return { scale, offset: { x: size / 2 - focus.x * scale, y: size / 2 - focus.y * scale } };
}
