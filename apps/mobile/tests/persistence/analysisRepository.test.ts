import type { Calibration, HitMark, RoundPhoto } from '../../src/domain/round/round';
import {
  applyAnalysisResult,
  createAnalysisAttempt,
  failAnalysisAttempt,
  getLatestAttempt,
} from '../../src/persistence/analysisRepository';
import {
  getRound,
  RoundNotEditableError,
  saveDraftAnnotations,
  setDraftPhoto,
} from '../../src/persistence/roundRepository';
import { databaseWithDraft, ROUND_ID } from '../support/sqliteFixtures';

// Runs on real SQLite (node:sqlite): the statements, constraints and transaction are the app's.

const after = (fileName: string): RoundPhoto => ({
  role: 'after',
  fileName,
  originalFileName: `${fileName}.original.jpg`,
  width: 3024,
  height: 4032,
  addedAtUtc: 't',
});

function suggestion(id: string, x: number, y: number, uncertain = false): HitMark {
  return {
    id,
    position: { x, y },
    shots: 1,
    source: 'suggested',
    uncertain,
    accepted: false,
    candidateId: `c-${id}`,
    attemptId: null,
  };
}

async function draftWithAfter() {
  const db = await databaseWithDraft();
  await setDraftPhoto(db, ROUND_ID, after('a.jpg'));
  return db;
}

async function startAttempt(
  db: Awaited<ReturnType<typeof draftWithAfter>>,
  attemptId: string,
  createdAtUtc: string,
) {
  await createAnalysisAttempt(db, {
    attemptId,
    roundId: ROUND_ID,
    source: 'service',
    createdAtUtc,
    afterFileName: 'a.jpg',
    beforeFileName: null,
  });
}

const apply = (
  db: Awaited<ReturnType<typeof draftWithAfter>>,
  attemptId: string,
  suggestions: HitMark[],
  calibration: Calibration | null = null,
) =>
  applyAnalysisResult(db, {
    attemptId,
    roundId: ROUND_ID,
    algorithmVersion: 'v1',
    resultJson: '{}',
    suggestions,
    duplicateRadiusPx: 20,
    calibration,
  });

async function marks(db: Awaited<ReturnType<typeof draftWithAfter>>) {
  const round = await getRound(db, ROUND_ID);
  if (round?.state !== 'draft') throw new Error('expected a draft');
  return round.marks.map((mark) => [mark.id, mark.source, mark.accepted]);
}

describe('analysis attempts on SQLite', () => {
  it('records an attempt only for a draft round', async () => {
    const db = await draftWithAfter();
    db.raw.exec(`UPDATE rounds SET state = 'confirmed' WHERE id = '${ROUND_ID}'`);
    await expect(startAttempt(db, 'a1', 't1')).rejects.toBeInstanceOf(RoundNotEditableError);
  });

  it('adds suggestions as pending and keeps them out of the hits until accepted', async () => {
    const db = await draftWithAfter();
    await startAttempt(db, 'a1', 't1');
    await expect(apply(db, 'a1', [suggestion('s1', 100, 100)])).resolves.toEqual({
      kind: 'applied',
      added: 1,
      duplicates: 0,
    });
    expect(await marks(db)).toEqual([['s1', 'suggested', false]]);
    await expect(getLatestAttempt(db, ROUND_ID)).resolves.toMatchObject({
      id: 'a1',
      status: 'succeeded',
      algorithmVersion: 'v1',
    });
  });

  it('replaces only pending suggestions; manual, edited and accepted marks stay', async () => {
    const db = await draftWithAfter();
    await saveDraftAnnotations(db, ROUND_ID, null, [
      { ...suggestion('pending', 10, 10) },
      { ...suggestion('accepted', 500, 500), accepted: true },
      { ...suggestion('edited', 900, 900), source: 'suggestedEdited', accepted: true },
      { ...suggestion('manual', 1300, 1300), source: 'manual', accepted: true, candidateId: null },
    ]);
    await startAttempt(db, 'a1', 't1');
    const outcome = await apply(db, 'a1', [
      suggestion('again', 505, 505), // the accepted hole found again: not added twice
      suggestion('new', 2000, 2000),
    ]);
    expect(outcome).toEqual({ kind: 'applied', added: 1, duplicates: 1 });
    expect(await marks(db)).toEqual([
      ['accepted', 'suggested', true],
      ['edited', 'suggestedEdited', true],
      ['manual', 'manual', true],
      ['new', 'suggested', false],
    ]);
  });

  it('ignores a late answer to an older attempt and leaves the marks alone', async () => {
    const db = await draftWithAfter();
    await startAttempt(db, 'old', 't1');
    await startAttempt(db, 'new', 't2');
    await expect(apply(db, 'old', [suggestion('s1', 1, 1)])).resolves.toEqual({ kind: 'stale' });
    expect(await marks(db)).toEqual([]);
  });

  it('ignores an answer for an after photo that was replaced meanwhile', async () => {
    const db = await draftWithAfter();
    await startAttempt(db, 'a1', 't1');
    await setDraftPhoto(db, ROUND_ID, after('b.jpg'));
    await expect(apply(db, 'a1', [suggestion('s1', 1, 1)])).resolves.toEqual({ kind: 'stale' });
    expect(await marks(db)).toEqual([]);
    await expect(getLatestAttempt(db, ROUND_ID)).resolves.toMatchObject({
      status: 'failed',
      errorCode: 'stale',
    });
  });

  it('ignores an answer that arrives after the round was confirmed', async () => {
    const db = await draftWithAfter();
    await startAttempt(db, 'a1', 't1');
    db.raw.exec(`UPDATE rounds SET state = 'confirmed' WHERE id = '${ROUND_ID}'`);
    await expect(apply(db, 'a1', [suggestion('s1', 1, 1)])).resolves.toEqual({ kind: 'stale' });
    expect(db.raw.prepare('SELECT COUNT(*) AS n FROM round_marks').get()).toEqual({ n: 0 });
  });

  it('keeps a failed attempt with its code, and a pending one as pending', async () => {
    const db = await draftWithAfter();
    await startAttempt(db, 'a1', 't1');
    await failAnalysisAttempt(db, 'a1', 'timeout');
    await expect(getLatestAttempt(db, ROUND_ID)).resolves.toMatchObject({
      status: 'failed',
      errorCode: 'timeout',
    });
    await startAttempt(db, 'a2', 't2');
    await expect(getLatestAttempt(db, ROUND_ID)).resolves.toMatchObject({
      id: 'a2',
      status: 'pending',
    });
  });
});

describe('applyAnalysisResult: calibration changed meanwhile', () => {
  const sent: Calibration = [
    { x: 1500, y: 500 },
    { x: 2500, y: 2000 },
    { x: 1500, y: 3500 },
    { x: 500, y: 2000 },
  ];
  const adjusted: Calibration = [{ x: 1520, y: 510 }, sent[1], sent[2], sent[3]];
  const hit: HitMark = { ...suggestion('h', 900, 900), source: 'manual', accepted: true };

  it('ignores an answer for an earlier calibration and keeps the marks', async () => {
    const db = await draftWithAfter();
    await saveDraftAnnotations(db, ROUND_ID, sent, [hit]);
    await startAttempt(db, 'a1', '2026-10-28T10:00:00.000Z');
    await saveDraftAnnotations(db, ROUND_ID, adjusted, [hit]);

    await expect(apply(db, 'a1', [suggestion('s', 100, 100)], sent)).resolves.toEqual({
      kind: 'stale',
    });
    expect(await marks(db)).toEqual([['h', 'manual', true]]);
    expect((await getLatestAttempt(db, ROUND_ID))?.errorCode).toBe('stale');
  });

  it('applies an answer for the calibration still in place', async () => {
    const db = await draftWithAfter();
    await saveDraftAnnotations(db, ROUND_ID, sent, [hit]);
    await startAttempt(db, 'a1', '2026-10-28T10:00:00.000Z');
    const outcome = await apply(db, 'a1', [suggestion('s', 100, 100)], sent);
    expect(outcome.kind).toBe('applied');
  });
});

describe('applyAnalysisResult: after photo only by choice', () => {
  const before = (fileName: string): RoundPhoto => ({ ...after(fileName), role: 'before' });

  async function pairedDraft() {
    const db = await draftWithAfter();
    await setDraftPhoto(db, ROUND_ID, before('before.jpg'));
    return db;
  }

  it('applies an attempt that left out the before photo the round still has', async () => {
    const db = await pairedDraft();
    await startAttempt(db, 'a1', '2026-10-28T10:00:00.000Z');
    const outcome = await apply(db, 'a1', [suggestion('s', 100, 100)]);
    expect(outcome.kind).toBe('applied');
  });

  it('still discards an attempt that used a before photo since replaced', async () => {
    const db = await pairedDraft();
    await createAnalysisAttempt(db, {
      attemptId: 'a2',
      roundId: ROUND_ID,
      source: 'service',
      createdAtUtc: '2026-10-28T10:00:00.000Z',
      afterFileName: 'a.jpg',
      beforeFileName: 'before.jpg',
    });
    await setDraftPhoto(db, ROUND_ID, before('before-2.jpg'));
    await expect(apply(db, 'a2', [suggestion('s', 100, 100)])).resolves.toEqual({ kind: 'stale' });
  });
});
