import type { Session } from '../../../src/domain/session/session';
import {
  filterItems,
  type ListingWithProgress,
  toListItems,
} from '../../../src/features/sessions/sessionListItems';
import type { RoundSummary, SessionOverview } from '../../../src/persistence/roundRepository';

function session(id: string): Session {
  return {
    id,
    createdAtUtc: '2026-10-27T13:00:00.000Z',
    createdTimeZone: 'Europe/Stockholm',
    settings: {
      firearmName: `Firearm ${id}`,
      firearmType: 'pistol',
      calibreLabel: '9×19 mm',
      distanceMetres: 25,
      plannedShotsPerRound: 10,
      plannedRounds: null,
    },
  };
}

const CONFIRMED: RoundSummary = {
  id: 'r1',
  sequence: 1,
  state: 'confirmed',
  actualShots: 10,
  targetId: 'demo-synthetic-v1',
  confirmedSubtotal: 85,
  confirmedComplete: true,
  confirmedUnresolved: 0,
};

const ACTIVE = 'aaaaaaaa-0000-4000-8000-000000000001';
const FINISHED = 'aaaaaaaa-0000-4000-8000-000000000002';

function listing(): ListingWithProgress {
  const overviews = new Map<string, SessionOverview>([
    [ACTIVE, { finishedAtUtc: null, rounds: [] }],
    [FINISHED, { finishedAtUtc: '2026-10-27T15:00:00.000Z', rounds: [CONFIRMED] }],
  ]);
  return {
    sessions: [session(ACTIVE), session(FINISHED)],
    invalidRows: [{ id: null, errors: { firearm_name: 'required' } }],
    overviews,
  };
}

describe('toListItems', () => {
  it('keeps the read order with unreadable rows last, and labels demo scores', () => {
    const items = toListItems(listing());
    expect(items.map((item) => item.kind)).toEqual(['session', 'session', 'invalid']);
    const finished = items[1];
    expect(finished?.kind === 'session' && finished.summary).toMatchObject({
      status: 'finished',
      roundsLine: '1 confirmed round · 10 shots',
      demo: { short: '85 demo pts', spoken: 'Demo score: 85 points' },
      verified: null,
    });
  });

  it('treats a session without an overview as in progress with no rounds', () => {
    const items = toListItems({ ...listing(), overviews: new Map() });
    const first = items[0];
    expect(first?.kind === 'session' && first.summary.status).toBe('inProgress');
    expect(first?.kind === 'session' && first.summary.roundsLine).toBe('No confirmed rounds');
  });
});

describe('filterItems', () => {
  const items = toListItems(listing());

  it('shows every session for All', () => {
    expect(filterItems(items, 'all').sessions.map((item) => item.key)).toEqual([ACTIVE, FINISHED]);
  });

  it('filters by the actual session status', () => {
    expect(filterItems(items, 'inProgress').sessions.map((item) => item.key)).toEqual([ACTIVE]);
    expect(filterItems(items, 'finished').sessions.map((item) => item.key)).toEqual([FINISHED]);
  });

  it('keeps unreadable rows in every filter, because their status is unknown', () => {
    for (const filter of ['all', 'inProgress', 'finished'] as const) {
      expect(filterItems(items, filter).invalid).toHaveLength(1);
    }
  });

  it('can match no session while unreadable rows remain', () => {
    const onlyActive = items.filter((item) => item.key !== FINISHED);
    const result = filterItems(onlyActive, 'finished');
    expect(result.sessions).toEqual([]);
    expect(result.invalid).toHaveLength(1);
  });
});
