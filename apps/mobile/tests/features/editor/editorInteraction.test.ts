import type { HitMark } from '../../../src/domain/round/round';
import {
  MAGNIFIER,
  magnifiedView,
  magnifierPosition,
  markerNumbers,
  marksNear,
  nextSelection,
  releaseAction,
  type Release,
} from '../../../src/features/editor/editorInteraction';
import { imageToScreen } from '../../../src/features/editor/viewTransform';

function mark(id: string, x: number, y: number, accepted = true): HitMark {
  return {
    id,
    position: { x, y },
    shots: 1,
    source: accepted ? 'manual' : 'suggested',
    uncertain: false,
    accepted,
    candidateId: null,
  };
}

const A = mark('a', 100, 100);
const B = mark('b', 104, 100);
const S = mark('s', 300, 300, false);

function release(overrides: Partial<Release>): Release {
  return {
    tool: 'add',
    moved: false,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 0 },
    marks: [A, B, S],
    selectedId: null,
    reach: 10,
    newId: () => 'new',
    ...overrides,
  };
}

describe('marksNear and nextSelection', () => {
  it('lists overlapping marks nearest first', () => {
    expect(marksNear([A, B, S], { x: 103, y: 100 }, 10).map((m) => m.id)).toEqual(['b', 'a']);
  });

  it('steps through overlapping marks on repeated taps', () => {
    const candidates = [B, A];
    expect(nextSelection(candidates, null)).toBe('b');
    expect(nextSelection(candidates, 'b')).toBe('a');
    expect(nextSelection(candidates, 'a')).toBe('b');
    expect(nextSelection([], 'a')).toBeNull();
  });
});

describe('releaseAction', () => {
  it('adds a hit where the finger lifted in add mode', () => {
    expect(
      releaseAction(release({ moved: true, start: { x: 0, y: 0 }, end: { x: 50, y: 60 } })),
    ).toEqual({
      type: 'addMark',
      id: 'new',
      point: { x: 50, y: 60 },
    });
  });

  it('selects instead of adding when a tap lands on a mark', () => {
    expect(releaseAction(release({ start: { x: 101, y: 100 }, end: { x: 101, y: 100 } }))).toEqual({
      type: 'select',
      id: 'a',
    });
  });

  it('never adds a hit in pan mode', () => {
    expect(releaseAction(release({ tool: 'pan', start: { x: 0, y: 0 } }))).toEqual({
      type: 'select',
      id: null,
    });
    expect(releaseAction(release({ tool: 'pan', moved: true }))).toBeNull();
    expect(releaseAction(release({ tool: 'pan', start: { x: 300, y: 301 } }))).toEqual({
      type: 'select',
      id: 's',
    });
  });

  it('places an alignment point where the finger lifted, even on a mark', () => {
    expect(
      releaseAction(
        release({ tool: 'calibrate', start: { x: 100, y: 100 }, end: { x: 100, y: 100 } }),
      ),
    ).toEqual({ type: 'addCalibrationPoint', point: { x: 100, y: 100 } });
  });
});

describe('markerNumbers', () => {
  it('numbers accepted marks in order and leaves suggestions unnumbered', () => {
    const numbers = markerNumbers([A, S, B]);
    expect([...numbers.entries()]).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });
});

describe('magnifierPosition', () => {
  const canvas = { width: 360, height: 500 };

  it('sits above the finger, horizontally centred on it', () => {
    expect(magnifierPosition({ x: 180, y: 300 }, canvas)).toEqual({
      x: 180 - MAGNIFIER.size / 2,
      y: 300 - MAGNIFIER.size / 2 - MAGNIFIER.gap - MAGNIFIER.size / 2,
    });
  });

  it('moves below the finger near the top edge', () => {
    const position = magnifierPosition({ x: 180, y: 40 }, canvas);
    expect(position.y).toBe(40 + MAGNIFIER.gap);
    expect(position.y).toBeGreaterThan(40);
  });

  it('stays inside the canvas at the corners', () => {
    for (const finger of [
      { x: 0, y: 0 },
      { x: 360, y: 0 },
      { x: 0, y: 500 },
      { x: 360, y: 500 },
    ]) {
      const { x, y } = magnifierPosition(finger, canvas);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + MAGNIFIER.size).toBeLessThanOrEqual(canvas.width);
      expect(y + MAGNIFIER.size).toBeLessThanOrEqual(canvas.height);
    }
  });
});

describe('magnifiedView', () => {
  it('shows the focus point at the centre, enlarged twice, at any zoom and pan', () => {
    const view = { baseScale: 0.09, zoom: 3, offset: { x: -420, y: -133 } };
    const focus = { x: 2100, y: 1650 };
    const magnified = magnifiedView(view, focus);
    expect(magnified.scale).toBeCloseTo(0.09 * 3 * 2);
    const centre = imageToScreen(
      { baseScale: magnified.scale, zoom: 1, offset: magnified.offset },
      focus,
    );
    expect(centre.x).toBeCloseTo(MAGNIFIER.size / 2);
    expect(centre.y).toBeCloseTo(MAGNIFIER.size / 2);
  });
});
