import type { HitMark } from '../../../src/domain/round/round';
import {
  calibrationOf,
  editorReducer,
  type EditorState,
  initialEditorState,
  markNear,
} from '../../../src/features/editor/annotationEditor';

const suggestion: HitMark = {
  id: 's1',
  position: { x: 10, y: 10 },
  shots: 1,
  source: 'suggested',
  uncertain: true,
  candidateId: 'c1',
};

function apply(state: EditorState, ...actions: Parameters<typeof editorReducer>[1][]): EditorState {
  return actions.reduce(editorReducer, state);
}

describe('editorReducer', () => {
  it('collects four calibration taps and ignores a fifth', () => {
    const state = apply(
      initialEditorState(null, []),
      { type: 'addCalibrationPoint', point: { x: 1, y: 0 } },
      { type: 'addCalibrationPoint', point: { x: 2, y: 1 } },
      { type: 'addCalibrationPoint', point: { x: 1, y: 2 } },
    );
    expect(calibrationOf(state)).toBeNull();
    const done = apply(state, { type: 'addCalibrationPoint', point: { x: 0, y: 1 } });
    expect(calibrationOf(done)).toHaveLength(4);
    expect(apply(done, { type: 'addCalibrationPoint', point: { x: 9, y: 9 } })).toBe(done);
  });

  it('adds a manual mark with one shot and selects it', () => {
    const state = apply(initialEditorState(null, []), {
      type: 'addMark',
      id: 'm1',
      point: { x: 5, y: 6 },
    });
    expect(state.marks).toEqual([
      {
        id: 'm1',
        position: { x: 5, y: 6 },
        shots: 1,
        source: 'manual',
        uncertain: false,
        candidateId: null,
      },
    ]);
    expect(state.selectedId).toBe('m1');
  });

  it('turns a moved or changed suggestion into an edited, certain mark', () => {
    const moved = apply(initialEditorState(null, [suggestion]), {
      type: 'moveMark',
      id: 's1',
      point: { x: 11, y: 12 },
    });
    expect(moved.marks[0]).toMatchObject({
      source: 'suggestedEdited',
      uncertain: false,
      position: { x: 11, y: 12 },
    });
    const counted = apply(initialEditorState(null, [suggestion]), {
      type: 'setShots',
      id: 's1',
      shots: 2,
    });
    expect(counted.marks[0]).toMatchObject({ source: 'suggestedEdited', shots: 2 });
  });

  it('keeps shots per hole within limits', () => {
    const state = initialEditorState(null, [suggestion]);
    expect(apply(state, { type: 'setShots', id: 's1', shots: 0 }).marks[0]?.shots).toBe(1);
    expect(apply(state, { type: 'setShots', id: 's1', shots: 40 }).marks[0]?.shots).toBe(10);
  });

  it('undoes edits one at a time, but not selection', () => {
    let state = initialEditorState(null, []);
    state = apply(
      state,
      { type: 'addMark', id: 'a', point: { x: 1, y: 1 } },
      { type: 'addMark', id: 'b', point: { x: 2, y: 2 } },
      { type: 'select', id: 'a' },
      { type: 'deleteMark', id: 'a' },
    );
    expect(state.marks.map((mark) => mark.id)).toEqual(['b']);
    state = apply(state, { type: 'undo' });
    expect(state.marks.map((mark) => mark.id)).toEqual(['a', 'b']);
    state = apply(state, { type: 'undo' });
    expect(state.marks.map((mark) => mark.id)).toEqual(['a']);
    state = apply(state, { type: 'undo' }, { type: 'undo' });
    expect(state.marks).toEqual([]);
    expect(state.history).toEqual([]);
  });

  it('replaces only untouched suggestions and keeps manual and edited marks', () => {
    const manual: HitMark = {
      ...suggestion,
      id: 'm',
      source: 'manual',
      uncertain: false,
      candidateId: null,
    };
    const edited: HitMark = { ...suggestion, id: 'e', source: 'suggestedEdited', uncertain: false };
    const fresh: HitMark = { ...suggestion, id: 'n', candidateId: 'c9' };
    const state = apply(initialEditorState(null, [suggestion, manual, edited]), {
      type: 'replaceSuggestions',
      marks: [fresh],
    });
    expect(state.marks.map((mark) => mark.id)).toEqual(['m', 'e', 'n']);
  });
});

describe('markNear', () => {
  it('finds the nearest mark within reach only', () => {
    const marks = [suggestion, { ...suggestion, id: 's2', position: { x: 14, y: 10 } }];
    expect(markNear(marks, { x: 13, y: 10 }, 5)?.id).toBe('s2');
    expect(markNear(marks, { x: 40, y: 40 }, 5)).toBeNull();
  });
});
