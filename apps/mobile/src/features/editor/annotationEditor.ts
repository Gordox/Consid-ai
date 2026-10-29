import type { Calibration, HitMark } from '../../domain/round/round';
import { SHOTS_PER_HOLE_RANGE } from '../../domain/round/roundRules';
import type { Point } from '../../domain/target/homography';

// Editing state for calibration and hit marks on the after photo, in image pixels. Pure, so
// undo and every edit can be tested without rendering.

export type Annotations = {
  // 0–4 taps: top, right, bottom, left of the outer ring.
  readonly calibrationPoints: readonly Point[];
  readonly marks: readonly HitMark[];
};

export type EditorState = Annotations & {
  readonly selectedId: string | null;
  // The calibration point being adjusted (0 top … 3 left). Selection only; never saved.
  readonly selectedPoint: number | null;
  // Earlier annotations, newest last. Selection is not an edit and is not undone.
  readonly history: readonly Annotations[];
};

export type EditorAction =
  | { readonly type: 'addCalibrationPoint'; readonly point: Point }
  | { readonly type: 'restartCalibration' }
  // A placed point dragged to a new place. Marks keep their photo positions; only how they map
  // onto the target changes, and the domain rescores them.
  | { readonly type: 'moveCalibrationPoint'; readonly index: number; readonly point: Point }
  | { readonly type: 'selectPoint'; readonly index: number | null }
  | { readonly type: 'addMark'; readonly id: string; readonly point: Point }
  | { readonly type: 'select'; readonly id: string | null }
  | { readonly type: 'moveMark'; readonly id: string; readonly point: Point }
  | { readonly type: 'setShots'; readonly id: string; readonly shots: number }
  | { readonly type: 'deleteMark'; readonly id: string }
  | { readonly type: 'acceptMark'; readonly id: string }
  | { readonly type: 'replaceSuggestions'; readonly marks: readonly HitMark[] }
  | { readonly type: 'undo' };

const HISTORY_LIMIT = 100;

export function initialEditorState(
  calibration: Calibration | null,
  marks: readonly HitMark[],
): EditorState {
  return {
    calibrationPoints: calibration ?? [],
    marks,
    selectedId: null,
    selectedPoint: null,
    history: [],
  };
}

export function calibrationOf(state: Annotations): Calibration | null {
  const [a, b, c, d] = state.calibrationPoints;
  return a && b && c && d ? [a, b, c, d] : null;
}

function edit(
  state: EditorState,
  next: Annotations,
  selectedId: string | null,
  selectedPoint: number | null = state.selectedPoint,
): EditorState {
  const snapshot: Annotations = { calibrationPoints: state.calibrationPoints, marks: state.marks };
  return {
    calibrationPoints: next.calibrationPoints,
    marks: next.marks,
    selectedId,
    selectedPoint,
    history: [...state.history, snapshot].slice(-HISTORY_LIMIT),
  };
}

// A suggestion the user changes becomes their own mark: accepted and no longer uncertain.
function touched(mark: HitMark): Pick<HitMark, 'source' | 'uncertain' | 'accepted'> {
  return {
    source: mark.source === 'manual' ? 'manual' : 'suggestedEdited',
    uncertain: false,
    accepted: true,
  };
}

const isPending = (mark: HitMark): boolean => !mark.accepted;

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'addCalibrationPoint':
      if (state.calibrationPoints.length >= 4) return state;
      return edit(
        state,
        { ...state, calibrationPoints: [...state.calibrationPoints, action.point] },
        state.selectedId,
        state.calibrationPoints.length,
      );
    case 'restartCalibration':
      if (state.calibrationPoints.length === 0) return state;
      return edit(state, { ...state, calibrationPoints: [] }, state.selectedId, null);
    case 'moveCalibrationPoint': {
      if (action.index < 0 || action.index >= state.calibrationPoints.length) return state;
      const calibrationPoints = state.calibrationPoints.map((point, index) =>
        index === action.index ? action.point : point,
      );
      return edit(state, { ...state, calibrationPoints }, state.selectedId, action.index);
    }
    case 'selectPoint':
      if (
        action.index !== null &&
        (action.index < 0 || action.index >= state.calibrationPoints.length)
      ) {
        return state;
      }
      return { ...state, selectedPoint: action.index };
    case 'addMark': {
      const mark: HitMark = {
        id: action.id,
        position: action.point,
        shots: 1,
        source: 'manual',
        uncertain: false,
        accepted: true,
        candidateId: null,
        attemptId: null,
      };
      return edit(state, { ...state, marks: [...state.marks, mark] }, mark.id);
    }
    case 'select':
      return { ...state, selectedId: action.id };
    case 'moveMark':
      return edit(
        state,
        {
          ...state,
          marks: state.marks.map((mark) =>
            mark.id === action.id ? { ...mark, ...touched(mark), position: action.point } : mark,
          ),
        },
        action.id,
      );
    case 'setShots': {
      const shots = Math.min(
        SHOTS_PER_HOLE_RANGE.max,
        Math.max(SHOTS_PER_HOLE_RANGE.min, Math.round(action.shots)),
      );
      return edit(
        state,
        {
          ...state,
          marks: state.marks.map((mark) =>
            mark.id === action.id ? { ...mark, ...touched(mark), shots } : mark,
          ),
        },
        action.id,
      );
    }
    case 'deleteMark':
      return edit(
        state,
        { ...state, marks: state.marks.filter((mark) => mark.id !== action.id) },
        null,
      );
    case 'acceptMark': {
      const target = state.marks.find((mark) => mark.id === action.id);
      if (target === undefined || target.accepted) return state;
      // Accepting keeps the suggestion's position and provenance; the user has checked it.
      return edit(
        state,
        {
          ...state,
          marks: state.marks.map((mark) =>
            mark.id === action.id ? { ...mark, accepted: true, uncertain: false } : mark,
          ),
        },
        action.id,
      );
    }
    case 'replaceSuggestions': {
      // Pending suggestions are replaced; manual, edited and accepted marks always stay.
      const kept = state.marks.filter((mark) => !isPending(mark));
      return edit(state, { ...state, marks: [...kept, ...action.marks] }, null);
    }
    case 'undo': {
      const previous = state.history.at(-1);
      if (previous === undefined) return state;
      const selectedId = previous.marks.some((mark) => mark.id === state.selectedId)
        ? state.selectedId
        : null;
      const selectedPoint =
        state.selectedPoint !== null && state.selectedPoint < previous.calibrationPoints.length
          ? state.selectedPoint
          : null;
      return {
        calibrationPoints: previous.calibrationPoints,
        marks: previous.marks,
        selectedId,
        selectedPoint,
        history: state.history.slice(0, -1),
      };
    }
  }
}
