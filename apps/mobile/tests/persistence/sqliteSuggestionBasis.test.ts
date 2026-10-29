import type { Calibration, HitMark } from '../../src/domain/round/round';
import { suggestionBasis } from '../../src/domain/round/suggestionBasis';
import {
  applyAnalysisResult,
  createAnalysisAttempt,
  listAttemptCalibrations,
} from '../../src/persistence/analysisRepository';
import {
  getRound,
  saveDraftAnnotations,
  setDraftPhoto,
} from '../../src/persistence/roundRepository';
import {
  databaseWithDraft,
  draftRevision,
  ROUND_ID,
  TEST_CALIBRATION,
} from '../support/sqliteFixtures';

type Db = Awaited<ReturnType<typeof databaseWithDraft>>;

const [top, right, bottom, left] = TEST_CALIBRATION;
const MOVED: Calibration = [{ x: 1520, y: 510 }, right, bottom, left];
const ORIGINAL: Calibration = [top, right, bottom, left];

const suggestion = (id: string, x: number, y: number, attemptId: string): HitMark => ({
  id,
  position: { x, y },
  shots: 1,
  source: 'suggested',
  uncertain: false,
  accepted: false,
  candidateId: `c-${id}`,
  attemptId,
});

async function analyse(db: Db, attemptId: string, createdAtUtc: string, marks: HitMark[]) {
  const round = await getRound(db, ROUND_ID);
  const calibration = round?.state === 'draft' ? round.calibration : null;
  if (calibration === null) throw new Error('fixture needs a calibration');
  await createAnalysisAttempt(db, {
    attemptId,
    roundId: ROUND_ID,
    source: 'service',
    createdAtUtc,
    afterFileName: 'a.jpg',
    beforeFileName: null,
    calibration,
  });
  return applyAnalysisResult(db, {
    attemptId,
    roundId: ROUND_ID,
    algorithmVersion: 'v1',
    resultJson: '{}',
    suggestions: marks,
    duplicateRadiusPx: 20,
    calibration,
  });
}

async function draftMarks(db: Db) {
  const round = await getRound(db, ROUND_ID);
  if (round?.state !== 'draft') throw new Error('expected a draft');
  return round;
}

describe('suggestions after a new alignment on SQLite', () => {
  it('marks pending suggestions of the earlier alignment and keeps their photo positions', async () => {
    const db = await databaseWithDraft();
    await setDraftPhoto(
      db,
      ROUND_ID,
      {
        role: 'after',
        fileName: 'a.jpg',
        originalFileName: 'a.o.jpg',
        width: 3024,
        height: 4032,
        addedAtUtc: 't',
      },
      await draftRevision(db),
    );
    await saveDraftAnnotations(db, ROUND_ID, await draftRevision(db), ORIGINAL, []);
    await analyse(db, 'a1', '2026-10-28T10:00:00.000Z', [
      suggestion('s1', 1000, 1000, 'a1'),
      suggestion('s2', 2000, 2000, 'a1'),
    ]);
    // The user accepts one and then moves an alignment point.
    const draft = await draftMarks(db);
    const accepted = draft.marks.map((mark) =>
      mark.id === 's1' ? { ...mark, accepted: true } : mark,
    );
    await saveDraftAnnotations(db, ROUND_ID, await draftRevision(db), MOVED, accepted);

    const moved = await draftMarks(db);
    const calibrations = await listAttemptCalibrations(db, ROUND_ID);
    const basis = (mark: HitMark) =>
      suggestionBasis(mark, (id) => calibrations.get(id), moved.calibration);
    expect(moved.marks.map((mark) => [mark.id, mark.position, mark.accepted, basis(mark)])).toEqual(
      [
        ['s1', { x: 1000, y: 1000 }, true, 'earlierAlignment'],
        ['s2', { x: 2000, y: 2000 }, false, 'earlierAlignment'],
      ],
    );

    // Analysing again replaces only the pending suggestion; the accepted hit stays, and the
    // same hole found again is not added twice.
    await analyse(db, 'a2', '2026-10-28T11:00:00.000Z', [
      suggestion('again', 1005, 1005, 'a2'),
      suggestion('s3', 2500, 2500, 'a2'),
    ]);
    const after = await draftMarks(db);
    const nowCalibrations = await listAttemptCalibrations(db, ROUND_ID);
    expect(
      after.marks.map((mark) => [
        mark.id,
        mark.accepted,
        suggestionBasis(mark, (id) => nowCalibrations.get(id), after.calibration),
      ]),
    ).toEqual([
      ['s1', true, 'earlierAlignment'],
      ['s3', false, 'current'],
    ]);
  });
});
