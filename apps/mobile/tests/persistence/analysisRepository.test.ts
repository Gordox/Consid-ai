import type { HitMark } from '../../src/domain/round/round';
import {
  applyAnalysisResult,
  createAnalysisAttempt,
} from '../../src/persistence/analysisRepository';
import { RoundNotEditableError } from '../../src/persistence/roundRepository';
import { FakeDatabase } from './fakeDatabase';

const SUGGESTION: HitMark = {
  id: 'm1',
  position: { x: 10, y: 20 },
  shots: 1,
  source: 'suggested',
  uncertain: true,
  candidateId: 'c1',
};

function fake(options: { state?: string; latestAttempt?: string; insertChanges?: number }) {
  return new FakeDatabase((call) => {
    if (!('sql' in call)) return undefined;
    if (call.sql.startsWith('SELECT state FROM rounds')) return { state: options.state ?? 'draft' };
    if (call.sql.startsWith('SELECT id FROM analysis_attempts'))
      return { id: options.latestAttempt ?? 'a1' };
    if (call.sql.startsWith('SELECT COALESCE(MAX(ordinal)')) return { next: 4 };
    if (call.method === 'run')
      return {
        changes: call.sql.startsWith('INSERT INTO analysis_attempts')
          ? (options.insertChanges ?? 1)
          : 1,
      };
    return undefined;
  });
}

const INPUT = {
  attemptId: 'a1',
  roundId: 'r1',
  algorithmVersion: 'v1',
  resultJson: '{}',
  suggestions: [SUGGESTION],
};

function statements(db: FakeDatabase): string[] {
  return db.calls.flatMap((call) =>
    'sql' in call && call.method === 'run' ? [call.sql.split(/\s+/).slice(0, 3).join(' ')] : [],
  );
}

describe('analysis attempts', () => {
  it('records an attempt only for a draft round', async () => {
    await expect(
      createAnalysisAttempt(fake({ insertChanges: 0 }), {
        attemptId: 'a1',
        roundId: 'r1',
        source: 'service',
        createdAtUtc: 't',
      }),
    ).rejects.toBeInstanceOf(RoundNotEditableError);
  });

  it('applies the newest attempt by replacing untouched suggestions after existing marks', async () => {
    const db = fake({});
    await expect(applyAnalysisResult(db, INPUT)).resolves.toBe('applied');
    expect(statements(db)).toEqual([
      'UPDATE analysis_attempts SET',
      'DELETE FROM round_marks',
      'INSERT INTO round_marks',
    ]);
    const remove = db.calls.find(
      (call) => 'sql' in call && call.sql.startsWith('DELETE FROM round_marks'),
    );
    expect(remove && 'sql' in remove ? remove.sql : '').toContain("source = 'suggested'");
    const insert = db.calls.find(
      (call) => 'sql' in call && call.sql.startsWith('INSERT INTO round_marks'),
    );
    expect(insert && 'params' in insert ? insert.params : null).toEqual([
      'm1',
      'r1',
      4,
      10,
      20,
      1,
      'c1',
    ]);
  });

  it('ignores a late answer to an older attempt and leaves the marks alone', async () => {
    const db = fake({ latestAttempt: 'a2' });
    await expect(applyAnalysisResult(db, INPUT)).resolves.toBe('stale');
    expect(statements(db)).toEqual(['UPDATE analysis_attempts SET']);
  });

  it('ignores an answer that arrives after the round was confirmed', async () => {
    const db = fake({ state: 'confirmed' });
    await expect(applyAnalysisResult(db, INPUT)).resolves.toBe('stale');
    expect(statements(db)).not.toContain('DELETE FROM round_marks');
  });
});
