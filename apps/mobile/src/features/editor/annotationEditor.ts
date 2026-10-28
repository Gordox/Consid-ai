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
  // Earlier annotations, newest last. Selection is not an edit and is not undone.
  readonly history: readonly Annotations[];
};

export type EditorAction =
  | { readonly type: 'addCalibrationPoint'; readonly point: Point }
  | { readonly type: 'restartCalibration' }
  | { readonly type: 'addMark'; readonly id: string; readonly point: Point }
  | { readonly type: 'select'; readonly id: string | null }
  | { readonly type: 'moveMark'; readonly id: string; readonly point: Point }
  | { readonly type: 'setShots'; readonly id: string; readonly shots: number }
  | { readonly type: 'deleteMark'; readonly id: string }
  | { readonly type: 'acceptMark'; readonly id: string }
  | { readonly type: 'acceptCertainSuggestions' }
  | { readonly type: 'replaceSuggestions'; readonly marks: readonly HitMark[] }
  | { readonly type: 'undo' };

const HISTORY_LIMIT = 100;

export function initialEditorState(
  calibration: Calibration | null,
  marks: readonly HitMark[],
): EditorState {
  return { calibrationPoints: calibration ?? [], marks, selectedId: null, history: [] };
}

export function calibrationOf(state: Annotations): Calibration | null {
  const [a, b, c, d] = state.calibrationPoints;
  return a && b && c && d ? [a, b, c, d] : null;
}

function edit(state: EditorState, next: Annotations, selectedId: string | null): EditorState {
  const snapshot: Annotations = { calibrationPoints: state.calibrationPoints, marks: state.marks };
  return {
    ...next,
    selectedId,
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
      );
    case 'restartCalibration':
      if (state.calibrationPoints.length === 0) return state;
      return edit(state, { ...state, calibrationPoints: [] }, state.selectedId);
    case 'addMark': {
      const mark: HitMark = {
        id: action.id,
        position: action.point,
        shots: 1,
        source: 'manual',
        uncertain: false,
        accepted: true,
        candidateId: null,
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
    case 'acceptCertainSuggestions': {
      // Uncertain suggestions always need a look of their own.
      if (!state.marks.some((mark) => isPending(mark) && !mark.uncertain)) return state;
      return edit(
        state,
        {
          ...state,
          marks: state.marks.map((mark) =>
            isPending(mark) && !mark.uncertain ? { ...mark, accepted: true } : mark,
          ),
        },
        state.selectedId,
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
      return { ...previous, selectedId, history: state.history.slice(0, -1) };
    }
  }
}

// The nearest mark within reach of a tap, so tapping a hole selects it instead of adding one.
export function markNear(marks: readonly HitMark[], point: Point, reach: number): HitMark | null {
  let best: HitMark | null = null;
  let bestDistance = reach;
  for (const mark of marks) {
    const distance = Math.hypot(mark.position.x - point.x, mark.position.y - point.y);
    if (distance <= bestDistance) {
      best = mark;
      bestDistance = distance;
    }
  }
  return best;
}
