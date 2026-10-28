import {
  type GestureResponderEvent,
  PanResponder,
  type PanResponderGestureState,
} from 'react-native';

import type { HitMark } from '../../domain/round/round';
import type { Point } from '../../domain/target/homography';
import type { EditorAction } from './annotationEditor';
import { type EditorTool, pointNear, releaseAction } from './editorInteraction';
import {
  imageToScreen,
  panBy,
  scaleOf,
  screenToImage,
  type Size,
  type ViewTransform,
  zoomAround,
} from './viewTransform';

// Touch handling for the photo canvas, outside React so the responder is created once.
// - calibrate and add: one finger places a point; dragging before lifting fine-positions it
//   under the magnifier. The photo does not pan, so placing never moves the view by accident.
// - calibrate: a placed point under the finger is picked up and follows the finger; with all
//   four placed, a drag elsewhere pans.
// - pan: one finger pans; a tap selects (and steps through overlapping marks).
// - In add and pan, a drag that starts on the selected mark moves it.
// - Two fingers always zoom and cancel whatever one finger started.

export type GestureSnapshot = {
  readonly view: ViewTransform | null;
  readonly canvas: Size | null;
  readonly image: Size;
  readonly tool: EditorTool;
  readonly marks: readonly HitMark[];
  readonly selectedId: string | null;
  readonly calibrationPoints: readonly Point[];
};

// What follows the finger before the edit is committed on release.
export type DragPreview =
  | { readonly kind: 'mark'; readonly id: string; readonly point: Point }
  | { readonly kind: 'calibration'; readonly index: number; readonly point: Point };

// What the magnifier shows: the finger on the canvas and the image point being edited.
export type MagnifierFocus = { readonly finger: Point; readonly image: Point };

export type GestureCallbacks = {
  readonly dispatch: (action: EditorAction) => void;
  readonly setView: (view: ViewTransform) => void;
  readonly setDragPreview: (preview: DragPreview | null) => void;
  readonly setMagnifier: (focus: MagnifierFocus | null) => void;
};

// Screen radius within which a touch reaches a mark (a 56-point circle, above the 48-point
// minimum), independent of the drawn hole size. Movement beyond the slop turns a tap into a drag.
export const TOUCH_REACH = 28;
const TAP_SLOP = 8;

type Gesture =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'single';
      readonly start: Point;
      readonly startView: ViewTransform;
      // Set when the drag started on the selected mark.
      readonly dragId: string | null;
      // Set when the touch started on a placed calibration point.
      readonly pointIndex: number | null;
      readonly moved: boolean;
    }
  | { readonly kind: 'pinch'; readonly startDistance: number; readonly startView: ViewTransform };

export function createGestureController(newMarkId: () => string) {
  let snapshot: GestureSnapshot | null = null;
  let callbacks: GestureCallbacks | null = null;
  let origin: Point = { x: 0, y: 0 };
  let gesture: Gesture = { kind: 'idle' };

  function touches(event: GestureResponderEvent): Point[] {
    return event.nativeEvent.touches.map((touch) => ({
      x: touch.pageX - origin.x,
      y: touch.pageY - origin.y,
    }));
  }

  // Whether a one-finger touch away from existing items places a new point (or pans).
  const places = (current: GestureSnapshot) =>
    current.tool === 'add' ||
    (current.tool === 'calibrate' && current.calibrationPoints.length < 4);

  function calibrationTarget(start: Point): number | null {
    const view = snapshot?.view;
    if (view == null || snapshot?.tool !== 'calibrate') return null;
    const screenPoints = snapshot.calibrationPoints.map((point) => imageToScreen(view, point));
    return pointNear(screenPoints, start, TOUCH_REACH);
  }

  function dragTarget(start: Point): string | null {
    if (snapshot?.view == null || snapshot.tool === 'calibrate') return null;
    const selected = snapshot.marks.find((mark) => mark.id === snapshot?.selectedId);
    if (selected === undefined) return null;
    const screen = imageToScreen(snapshot.view, selected.position);
    return Math.hypot(screen.x - start.x, screen.y - start.y) <= TOUCH_REACH ? selected.id : null;
  }

  function fingerAt(
    current: Extract<Gesture, { kind: 'single' }>,
    state: PanResponderGestureState,
  ): Point {
    return { x: current.start.x + state.dx, y: current.start.y + state.dy };
  }

  function end(): void {
    gesture = { kind: 'idle' };
    callbacks?.setDragPreview(null);
    callbacks?.setMagnifier(null);
  }

  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => {
      const [first] = touches(event);
      if (snapshot?.view == null || first === undefined) return;
      const pointIndex = calibrationTarget(first);
      const dragId = pointIndex === null ? dragTarget(first) : null;
      gesture = {
        kind: 'single',
        start: first,
        startView: snapshot.view,
        dragId,
        pointIndex,
        moved: false,
      };
      if (pointIndex !== null) {
        callbacks?.dispatch({ type: 'selectPoint', index: pointIndex });
        const point = snapshot.calibrationPoints[pointIndex];
        if (point !== undefined) {
          callbacks?.setMagnifier({ finger: first, image: point });
        }
      } else if (dragId === null && places(snapshot)) {
        callbacks?.setMagnifier({ finger: first, image: screenToImage(snapshot.view, first) });
      }
    },
    onPanResponderMove: (event, state) => {
      if (snapshot?.view == null || snapshot.canvas === null || callbacks === null) return;
      const [a, b] = touches(event);
      if (a !== undefined && b !== undefined) {
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (gesture.kind !== 'pinch') {
          gesture = {
            kind: 'pinch',
            startDistance: Math.max(distance, 1),
            startView: snapshot.view,
          };
          callbacks.setDragPreview(null);
          callbacks.setMagnifier(null);
          return;
        }
        const focus = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const zoom = (gesture.startView.zoom * distance) / gesture.startDistance;
        callbacks.setView(
          zoomAround(gesture.startView, zoom, focus, snapshot.image, snapshot.canvas),
        );
        return;
      }
      if (gesture.kind !== 'single') return;
      const moved = gesture.moved || Math.hypot(state.dx, state.dy) > TAP_SLOP;
      gesture = { ...gesture, moved };
      const finger = fingerAt(gesture, state);
      const image = screenToImage(gesture.startView, finger);
      if (gesture.pointIndex !== null) {
        if (!moved) return;
        // The point follows the finger; the rings are redrawn from this preview.
        callbacks.setDragPreview({ kind: 'calibration', index: gesture.pointIndex, point: image });
        callbacks.setMagnifier({ finger, image });
      } else if (gesture.dragId !== null) {
        if (!moved) return;
        callbacks.setDragPreview({ kind: 'mark', id: gesture.dragId, point: image });
        callbacks.setMagnifier({ finger, image });
      } else if (places(snapshot)) {
        callbacks.setMagnifier({ finger, image });
      } else if (moved) {
        callbacks.setView(
          panBy(gesture.startView, { x: state.dx, y: state.dy }, snapshot.image, snapshot.canvas),
        );
      }
    },
    onPanResponderRelease: (_event, state) => {
      const finished = gesture;
      if (finished.kind !== 'single' || callbacks === null || snapshot === null) {
        end();
        return;
      }
      const endPoint = screenToImage(finished.startView, fingerAt(finished, state));
      if (finished.pointIndex !== null) {
        // One history entry and one save per drag, written when the finger lifts.
        if (finished.moved) {
          callbacks.dispatch({
            type: 'moveCalibrationPoint',
            index: finished.pointIndex,
            point: endPoint,
          });
        }
      } else if (finished.dragId !== null && finished.moved) {
        // One history entry per drag, written when the finger lifts.
        callbacks.dispatch({ type: 'moveMark', id: finished.dragId, point: endPoint });
      } else {
        const action = releaseAction({
          tool: snapshot.tool,
          moved: finished.moved,
          start: screenToImage(finished.startView, finished.start),
          end: endPoint,
          marks: snapshot.marks,
          selectedId: snapshot.selectedId,
          calibrationPoints: snapshot.calibrationPoints,
          reach: TOUCH_REACH / scaleOf(finished.startView),
          newId: newMarkId,
        });
        if (action !== null) callbacks.dispatch(action);
      }
      end();
    },
    onPanResponderTerminate: end,
  });

  return {
    panHandlers: responder.panHandlers,
    update(nextSnapshot: GestureSnapshot, nextCallbacks: GestureCallbacks): void {
      snapshot = nextSnapshot;
      callbacks = nextCallbacks;
    },
    // Canvas position in page coordinates, so touch pageX/pageY can be made canvas-relative.
    setOrigin(nextOrigin: Point): void {
      origin = nextOrigin;
    },
  };
}
