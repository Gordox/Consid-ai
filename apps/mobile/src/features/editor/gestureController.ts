import {
  type GestureResponderEvent,
  PanResponder,
  type PanResponderGestureState,
} from 'react-native';

import type { HitMark } from '../../domain/round/round';
import type { Point } from '../../domain/target/homography';
import { type EditorAction, markNear } from './annotationEditor';
import {
  imageToScreen,
  panBy,
  scaleOf,
  screenToImage,
  type Size,
  type ViewTransform,
  zoomAround,
} from './viewTransform';

// Touch handling for the photo canvas, outside React so the responder is created once:
// a tap adds a calibration point or a mark (or selects a nearby mark), a drag starting on the
// selected mark moves it, any other drag pans, and two fingers zoom.

export type EditorMode = 'calibrate' | 'mark';

export type GestureSnapshot = {
  readonly view: ViewTransform | null;
  readonly canvas: Size | null;
  readonly image: Size;
  readonly mode: EditorMode;
  readonly marks: readonly HitMark[];
  readonly selectedId: string | null;
};

export type GestureCallbacks = {
  readonly dispatch: (action: EditorAction) => void;
  readonly setView: (view: ViewTransform) => void;
  readonly setDragPreview: (preview: { id: string; point: Point } | null) => void;
};

// Screen distance within which a tap selects a mark, and the movement that turns a tap into a drag.
export const TOUCH_REACH = 28;
const TAP_SLOP = 8;

type Gesture =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'single';
      readonly start: Point;
      readonly startView: ViewTransform;
      readonly dragId: string | null;
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

  function tap(point: Point): void {
    if (snapshot?.view == null || callbacks === null) return;
    const imagePoint = screenToImage(snapshot.view, point);
    if (snapshot.mode === 'calibrate') {
      callbacks.dispatch({ type: 'addCalibrationPoint', point: imagePoint });
      return;
    }
    const near = markNear(snapshot.marks, imagePoint, TOUCH_REACH / scaleOf(snapshot.view));
    callbacks.dispatch(
      near === null
        ? { type: 'addMark', id: newMarkId(), point: imagePoint }
        : { type: 'select', id: near.id },
    );
  }

  function dragTarget(start: Point): string | null {
    if (snapshot?.view == null || snapshot.mode !== 'mark') return null;
    const selected = snapshot.marks.find((mark) => mark.id === snapshot?.selectedId);
    if (selected === undefined) return null;
    const screen = imageToScreen(snapshot.view, selected.position);
    return Math.hypot(screen.x - start.x, screen.y - start.y) <= TOUCH_REACH ? selected.id : null;
  }

  function dragPoint(
    current: Extract<Gesture, { kind: 'single' }>,
    state: PanResponderGestureState,
  ): Point {
    return screenToImage(current.startView, {
      x: current.start.x + state.dx,
      y: current.start.y + state.dy,
    });
  }

  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => {
      const [first] = touches(event);
      if (snapshot?.view == null || first === undefined) return;
      gesture = {
        kind: 'single',
        start: first,
        startView: snapshot.view,
        dragId: dragTarget(first),
        moved: false,
      };
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
      if (!moved) return;
      if (gesture.dragId !== null) {
        callbacks.setDragPreview({ id: gesture.dragId, point: dragPoint(gesture, state) });
      } else {
        callbacks.setView(
          panBy(gesture.startView, { x: state.dx, y: state.dy }, snapshot.image, snapshot.canvas),
        );
      }
    },
    onPanResponderRelease: (_event, state) => {
      const finished = gesture;
      gesture = { kind: 'idle' };
      if (finished.kind !== 'single' || callbacks === null) return;
      if (!finished.moved) {
        tap(finished.start);
      } else if (finished.dragId !== null) {
        // One history entry per drag, written when the finger lifts.
        callbacks.dispatch({
          type: 'moveMark',
          id: finished.dragId,
          point: dragPoint(finished, state),
        });
      }
      callbacks.setDragPreview(null);
    },
    onPanResponderTerminate: () => {
      gesture = { kind: 'idle' };
      callbacks?.setDragPreview(null);
    },
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
