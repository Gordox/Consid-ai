import type { ConfirmedResult, HitMark } from '../../src/domain/round/round';
import {
  confirmRound,
  DraftRoundExistsError,
  finishSession,
  getRound,
  listSessionOverviews,
  RoundNotEditableError,
  saveDraftAnnotations,
  SessionFinishedError,
  SessionNotFoundError,
  setDraftPhoto,
  startRound,
  updateDraftCounts,
} from '../../src/persistence/roundRepository';
import {
  InvalidRoundDataError,
  parseConfirmedResult,
  serializeConfirmedResult,
} from '../../src/persistence/roundRow';
import { type DatabaseCall, FakeDatabase } from './fakeDatabase';

// The fake answers by SQL text and records calls. It checks orchestration and validation,
// not SQLite behaviour (constraints, transactions and locking are verified on the device).

type Answers = {
  finishedAt?: string | null | 'missing';
  draftId?: string | null;
  nextSequence?: number;
  state?: string | null;
  runChanges?: number;
  roundRow?: Record<string, unknown> | null;
  photoRows?: unknown[];
  markRows?: unknown[];
  existingPhoto?: string | null;
};

function fake(answers: Answers): FakeDatabase {
  return new FakeDatabase((call: DatabaseCall) => {
    if (!('sql' in call)) return undefined;
    const sql = call.sql;
    if (sql.startsWith('SELECT finished_at_utc FROM sessions')) {
      if (answers.finishedAt === 'missing') return null;
      return { finished_at_utc: answers.finishedAt ?? null };
    }
    if (sql.includes("state = 'draft' LIMIT 1")) {
      return answers.draftId ? { id: answers.draftId } : null;
    }
    if (sql.startsWith('SELECT COALESCE(MAX(sequence)')) return { next: answers.nextSequence ?? 1 };
    if (sql.startsWith('SELECT state FROM rounds')) {
      return answers.state === null ? null : { state: answers.state ?? 'draft' };
    }
    if (
      sql.startsWith(
        'SELECT file_name, original_file_name FROM round_photos WHERE round_id = ? AND role = ?',
      )
    ) {
      return answers.existingPhoto
        ? { file_name: answers.existingPhoto, original_file_name: 'old-original.jpg' }
        : null;
    }
    if (sql.startsWith('SELECT id, session_id, sequence, state, created_at_utc')) {
      return answers.roundRow ?? null;
    }
    if (sql.startsWith('SELECT role, file_name')) return answers.photoRows ?? [];
    if (sql.startsWith('SELECT id, x, y')) return answers.markRows ?? [];
    if (call.method === 'run') return { changes: answers.runChanges ?? 1 };
    if (call.method === 'getAll') return [];
    return undefined;
  });
}

function writes(db: FakeDatabase): string[] {
  return db.calls.flatMap((call) =>
    'sql' in call && (call.method === 'run' || call.method === 'exec')
      ? [call.sql.split(/\s+/).slice(0, 3).join(' ')]
      : [],
  );
}

const ROUND_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';

const START = {
  roundId: ROUND_ID,
  sessionId: SESSION_ID,
  createdAtUtc: '2026-10-28T10:00:00.000Z',
  actualShots: 5,
  targetId: 'demo-synthetic-v1',
};

const DRAFT_ROW = {
  id: ROUND_ID,
  session_id: SESSION_ID,
  sequence: 2,
  state: 'draft',
  created_at_utc: START.createdAtUtc,
  actual_shots: 5,
  declared_misses: 1,
  unresolved_shots: 0,
  target_id: 'demo-synthetic-v1',
  hit_diameter_mm: 9,
  hit_diameter_source: 'assumed',
  draft_revision: 0,
  calibration_json: JSON.stringify({
    points: [
      { x: 500, y: 100 },
      { x: 900, y: 500 },
      { x: 500, y: 900 },
      { x: 100, y: 500 },
    ],
  }),
  confirmed_at_utc: null,
  confirmed_json: null,
};

const RESULT: ConfirmedResult = {
  targetId: 'demo-synthetic-v1',
  scoringRule: 'contact-highest-v1',
  hitDiameterMm: 9,
  actualShots: 3,
  declaredMisses: 1,
  unresolvedShots: 0,
  status: 'complete',
  subtotal: 17,
  total: 17,
  shots: [
    { markId: 'a', shots: 1, centreMm: { x: 0, y: 0 }, value: 10 },
    { markId: 'b', shots: 1, centreMm: { x: 30, y: 10 }, value: 7 },
  ],
};

describe('startRound', () => {
  it('inserts the next sequence as a draft in one transaction', async () => {
    const db = fake({ nextSequence: 3 });

    await expect(startRound(db, START)).resolves.toBe(3);

    const insert = db.calls.find(
      (call) => 'sql' in call && call.sql.includes('INSERT INTO rounds'),
    );
    expect(insert).toMatchObject({ connection: 'transaction' });
    expect(insert && 'params' in insert ? insert.params : null).toEqual([
      ROUND_ID,
      SESSION_ID,
      3,
      START.createdAtUtc,
      5,
      'demo-synthetic-v1',
      9,
      'assumed',
    ]);
  });

  it('refuses a finished session, a missing session and a second draft without writing', async () => {
    for (const [answers, error] of [
      [{ finishedAt: '2026-10-28T11:00:00.000Z' }, SessionFinishedError],
      [{ finishedAt: 'missing' as const }, SessionNotFoundError],
      [{ draftId: 'other' }, DraftRoundExistsError],
    ] as const) {
      const db = fake(answers);
      await expect(startRound(db, START)).rejects.toBeInstanceOf(error);
      expect(writes(db)).toEqual([]);
      expect(db.calls.at(-1)).toEqual({ connection: 'main', method: 'rollback' });
    }
  });

  it('rejects out-of-range settings before touching the database', async () => {
    const db = fake({});
    await expect(startRound(db, { ...START, actualShots: 101 })).rejects.toBeInstanceOf(RangeError);
    expect(db.calls).toEqual([]);
  });
});

describe('getRound', () => {
  it('reads a draft with calibration, photos and marks', async () => {
    const db = fake({
      roundRow: DRAFT_ROW,
      photoRows: [
        {
          role: 'after',
          file_name: 'f.jpg',
          original_file_name: null,
          width: 4000,
          height: 3000,
          added_at_utc: 't',
        },
      ],
      markRows: [
        {
          id: 'm1',
          x: 510,
          y: 480,
          shots: 2,
          source: 'manual',
          uncertain: 0,
          accepted: 1,
          candidate_id: null,
          attempt_id: null,
        },
      ],
    });

    const round = await getRound(db, ROUND_ID);

    expect(round?.state).toBe('draft');
    if (round?.state !== 'draft') return;
    expect(round.calibration?.[0]).toEqual({ x: 500, y: 100 });
    expect(round.photos.after?.width).toBe(4000);
    expect(round.photos.before).toBeNull();
    expect(round.marks).toEqual([
      {
        id: 'm1',
        position: { x: 510, y: 480 },
        shots: 2,
        source: 'manual',
        uncertain: false,
        accepted: true,
        candidateId: null,
        attemptId: null,
      },
    ]);
  });

  it.each([
    ['broken calibration JSON', { calibration_json: '{' }],
    [
      'three calibration points',
      {
        calibration_json: JSON.stringify({
          points: [
            { x: 1, y: 1 },
            { x: 2, y: 1 },
            { x: 2, y: 2 },
          ],
        }),
      },
    ],
    ['unknown state', { state: 'archived' }],
    ['diameter out of range', { hit_diameter_mm: 0 }],
  ])('reports %s as invalid data', async (_label, override) => {
    const db = fake({ roundRow: { ...DRAFT_ROW, ...override } });
    await expect(getRound(db, ROUND_ID)).rejects.toBeInstanceOf(InvalidRoundDataError);
  });

  it('reports invalid data without including stored values', async () => {
    const db = fake({ roundRow: { ...DRAFT_ROW, calibration_json: '{"secret": 1' } });
    const error = await getRound(db, ROUND_ID).catch((caught: unknown) => caught);
    expect(String(error)).not.toContain('secret');
  });

  it('returns null for an unknown round', async () => {
    await expect(getRound(fake({ roundRow: null }), ROUND_ID)).resolves.toBeNull();
  });
});

describe('draft writes', () => {
  it('refuses to change a confirmed round', async () => {
    const db = fake({ runChanges: 0, state: 'confirmed' });
    await expect(
      updateDraftCounts(db, ROUND_ID, {
        actualShots: 5,
        declaredMisses: 0,
        unresolvedShots: 0,
        hitDiameterMm: 9,
        hitDiameterSource: 'userSet',
      }),
    ).rejects.toBeInstanceOf(RoundNotEditableError);

    const txDb = fake({ state: 'confirmed' });
    await expect(saveDraftAnnotations(txDb, ROUND_ID, null, [])).rejects.toBeInstanceOf(
      RoundNotEditableError,
    );
    expect(writes(txDb)).toEqual([]);
  });

  it('replaces calibration and marks together, in order', async () => {
    const db = fake({});
    const marks: HitMark[] = [
      {
        id: 'b',
        position: { x: 2, y: 2 },
        shots: 1,
        source: 'suggested',
        uncertain: true,
        accepted: false,
        candidateId: 'c1',
        attemptId: null,
      },
      {
        id: 'a',
        position: { x: 1, y: 1 },
        shots: 2,
        source: 'manual',
        uncertain: false,
        accepted: true,
        candidateId: null,
        attemptId: null,
      },
    ];

    await saveDraftAnnotations(db, ROUND_ID, null, marks);

    expect(writes(db)).toEqual([
      'UPDATE rounds SET',
      'DELETE FROM round_marks',
      'INSERT INTO round_marks',
      'INSERT INTO round_marks',
    ]);
    const inserts = db.calls.filter(
      (call) => 'sql' in call && call.sql.startsWith('INSERT INTO round_marks'),
    );
    expect(inserts.map((call) => ('params' in call ? call.params : null))).toEqual([
      ['b', ROUND_ID, 0, 2, 2, 1, 'suggested', 1, 0, 'c1', null],
      ['a', ROUND_ID, 1, 1, 1, 2, 'manual', 0, 1, null, null],
    ]);
  });

  it('clears calibration and marks when the after photo is replaced, and returns the old file', async () => {
    const db = fake({ existingPhoto: 'old.jpg' });

    const replaced = await setDraftPhoto(db, ROUND_ID, {
      role: 'after',
      fileName: 'new.jpg',
      originalFileName: 'new-original.jpg',
      width: 10,
      height: 10,
      addedAtUtc: 't',
    });

    expect(replaced).toEqual(['old.jpg', 'old-original.jpg']);
    expect(writes(db)).toEqual([
      'INSERT INTO round_photos',
      'UPDATE rounds SET',
      'DELETE FROM round_marks',
    ]);
  });

  it('keeps marks when the before photo changes', async () => {
    const db = fake({});
    await setDraftPhoto(db, ROUND_ID, {
      role: 'before',
      fileName: 'b.jpg',
      originalFileName: null,
      width: 1,
      height: 1,
      addedAtUtc: 't',
    });
    expect(writes(db)).toEqual(['INSERT INTO round_photos']);
  });
});

describe('confirmRound', () => {
  it('confirms a draft once and reports a repeat without overwriting', async () => {
    await expect(confirmRound(fake({ runChanges: 1 }), ROUND_ID, RESULT, 't')).resolves.toBe(
      'confirmed',
    );

    const again = fake({ runChanges: 0, state: 'confirmed' });
    await expect(confirmRound(again, ROUND_ID, RESULT, 't')).resolves.toBe('alreadyConfirmed');
    expect(writes(again)).toEqual(['UPDATE rounds SET']);
    const update = again.calls[0];
    expect(update && 'sql' in update ? update.sql : '').toContain(
      "WHERE id = ? AND state = 'draft'",
    );
  });

  it('round-trips the confirmed result and rejects a tampered one', () => {
    expect(parseConfirmedResult(serializeConfirmedResult(RESULT))).toEqual(RESULT);
    const tampered = JSON.stringify({ ...RESULT, status: 'unknown' });
    expect(() => parseConfirmedResult(tampered)).toThrow(InvalidRoundDataError);
    const badShot = JSON.stringify({
      ...RESULT,
      shots: [{ markId: 'a', shots: 0, value: 1, centreMm: { x: 0, y: 0 } }],
    });
    expect(() => parseConfirmedResult(badShot)).toThrow(InvalidRoundDataError);
  });
});

describe('finishSession', () => {
  it('refuses while a round is a draft', async () => {
    const db = fake({ draftId: ROUND_ID });
    await expect(finishSession(db, SESSION_ID, 't')).rejects.toBeInstanceOf(DraftRoundExistsError);
    expect(writes(db)).toEqual([]);
  });

  it('finishes once and reports a repeat', async () => {
    const db = fake({});
    await expect(finishSession(db, SESSION_ID, 't')).resolves.toBe('finished');
    expect(writes(db)).toEqual(['UPDATE sessions SET']);
    await expect(finishSession(fake({ finishedAt: 't' }), SESSION_ID, 't2')).resolves.toBe(
      'alreadyFinished',
    );
  });
});

describe('listSessionOverviews', () => {
  it('groups round summaries per session, including sessions without rounds', async () => {
    const db = new FakeDatabase((call) => {
      if (!('sql' in call)) return undefined;
      if (call.sql.startsWith('SELECT id, finished_at_utc FROM sessions')) {
        return [
          { id: 's1', finished_at_utc: null },
          { id: 's2', finished_at_utc: 't' },
        ];
      }
      return [
        {
          id: 'r1',
          session_id: 's2',
          sequence: 1,
          state: 'confirmed',
          actual_shots: 5,
          target_id: 'demo-synthetic-v1',
          confirmed_subtotal: 40,
          confirmed_complete: 0,
          confirmed_unresolved: 1,
        },
      ];
    });

    const overviews = await listSessionOverviews(db);

    expect(overviews.get('s1')).toEqual({ finishedAtUtc: null, rounds: [] });
    expect(overviews.get('s2')?.rounds).toEqual([
      {
        id: 'r1',
        sequence: 1,
        state: 'confirmed',
        actualShots: 5,
        targetId: 'demo-synthetic-v1',
        confirmedSubtotal: 40,
        confirmedComplete: false,
        confirmedUnresolved: 1,
      },
    ]);
  });

  it('rejects a confirmed round without its summary', async () => {
    const db = new FakeDatabase((call) => {
      if (!('sql' in call)) return undefined;
      if (call.sql.startsWith('SELECT id, finished_at_utc'))
        return [{ id: 's1', finished_at_utc: null }];
      return [
        {
          id: 'r1',
          session_id: 's1',
          sequence: 1,
          state: 'confirmed',
          actual_shots: 5,
          target_id: 'demo-synthetic-v1',
          confirmed_subtotal: null,
          confirmed_complete: null,
          confirmed_unresolved: null,
        },
      ];
    });
    await expect(listSessionOverviews(db)).rejects.toBeInstanceOf(InvalidRoundDataError);
  });
});
