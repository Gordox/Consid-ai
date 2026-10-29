import type { HitMark } from '../../../src/domain/round/round';
import { calibrationProblem } from '../../../src/domain/round/calibrationCheck';
import {
  MAGNIFIER,
  magnifiedView,
  magnifierPosition,
  markerNumbers,
  marksNear,
  nextSelection,
  pointNear,
  releaseAction,
  type Release,
  scrollLockAfter,
} from '../../../src/features/editor/editorInteraction';
import {
  fitView,
  imageToScreen,
  scaleOf,
  screenToImage,
  zoomAround,
} from '../../../src/features/editor/viewTransform';

function mark(id: string, x: number, y: number, accepted = true): HitMark {
  return {
    id,
    position: { x, y },
    shots: 1,
    source: accepted ? 'manual' : 'suggested',
    uncertain: false,
    accepted,
    candidateId: null,
    attemptId: null,
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
    calibrationPoints: [],
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

const IMAGE = { width: 1000, height: 1000 };
const CLOCKWISE = [
  { x: 500, y: 100 },
  { x: 900, y: 500 },
  { x: 500, y: 900 },
  { x: 100, y: 500 },
];

describe('calibration points', () => {
  it('adds points until there are four, then a tap only clears the point selection', () => {
    expect(releaseAction(release({ tool: 'calibrate', end: { x: 5, y: 6 } }))).toEqual({
      type: 'addCalibrationPoint',
      point: { x: 5, y: 6 },
    });
    expect(
      releaseAction(
        release({ tool: 'calibrate', calibrationPoints: CLOCKWISE, end: { x: 5, y: 6 } }),
      ),
    ).toEqual({ type: 'selectPoint', index: null });
    expect(
      releaseAction(release({ tool: 'calibrate', calibrationPoints: CLOCKWISE, moved: true })),
    ).toBeNull();
  });

  it('finds the placed point under the finger', () => {
    expect(pointNear(CLOCKWISE, { x: 895, y: 505 }, 20)).toBe(1);
    expect(pointNear(CLOCKWISE, { x: 700, y: 700 }, 20)).toBeNull();
  });

  it('accepts four points in order round the target', () => {
    expect(calibrationProblem(CLOCKWISE, IMAGE)).toBeNull();
    expect(calibrationProblem(CLOCKWISE.slice(0, 3), IMAGE)).toBeNull();
  });

  it('explains points placed in the wrong order or crossed', () => {
    const swapped = [CLOCKWISE[0], CLOCKWISE[3], CLOCKWISE[2], CLOCKWISE[1]].filter(
      (point) => point !== undefined,
    );
    expect(calibrationProblem(swapped, IMAGE)).toBe('wrongOrder');
    const crossed = [CLOCKWISE[0], CLOCKWISE[2], CLOCKWISE[1], CLOCKWISE[3]].filter(
      (point) => point !== undefined,
    );
    expect(calibrationProblem(crossed, IMAGE)).toBe('wrongOrder');
  });

  it('explains points on top of each other', () => {
    const doubled = [CLOCKWISE[0], { x: 505, y: 102 }, CLOCKWISE[2], CLOCKWISE[3]].filter(
      (point) => point !== undefined,
    );
    expect(calibrationProblem(doubled, IMAGE)).toBe('tooClose');
  });
});

describe('calibration points after zoom and pan', () => {
  it('finds the touched point in screen space and maps the drop back to photo pixels', () => {
    const view = zoomAround(
      fitView({ width: 1000, height: 1000 }, { width: 360, height: 480 }),
      3,
      { x: 300, y: 200 },
      { width: 1000, height: 1000 },
      { width: 360, height: 480 },
    );
    const screenPoints = CLOCKWISE.map((point) => imageToScreen(view, point));
    const right = screenPoints[1] ?? { x: 0, y: 0 };
    expect(pointNear(screenPoints, { x: right.x + 10, y: right.y - 10 }, 28)).toBe(1);
    const drop = screenToImage(view, { x: right.x + 30, y: right.y });
    expect(drop.x).toBeCloseTo(900 + 30 / scaleOf(view));
    expect(drop.y).toBeCloseTo(500);
  });
});

describe('scrollLockAfter', () => {
  // Logic only: whether Android's scroll view honours the lock in time needs the S20.
  it('keeps the page locked while any finger remains on the photo', () => {
    expect(scrollLockAfter('start', 1)).toBe(true);
    expect(scrollLockAfter('start', 2)).toBe(true);
    // Pinch, then one finger lifts: the other is still there.
    expect(scrollLockAfter('end', 1)).toBe(true);
    expect(scrollLockAfter('end', 0)).toBe(false);
  });

  it('always releases the lock when the gesture is cancelled', () => {
    expect(scrollLockAfter('cancel', 2)).toBe(false);
    expect(scrollLockAfter('cancel', 0)).toBe(false);
  });
});
