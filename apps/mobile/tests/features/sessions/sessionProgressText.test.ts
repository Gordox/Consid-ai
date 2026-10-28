import type { RoundSummary } from '../../../src/persistence/roundRepository';
import {
  formatPoints,
  formatProgressLine,
  formatRoundResult,
  formatShortScore,
  summarizeRounds,
  summarizeSessionCard,
} from '../../../src/features/sessions/sessionProgressText';

// No verified target exists yet; this stands in for one so the separation can be tested.
const isVerified = (targetId: string) => targetId === 'verified-v1';

function round(overrides: Partial<RoundSummary>): RoundSummary {
  return {
    id: 'r',
    sequence: 1,
    state: 'confirmed',
    actualShots: 5,
    targetId: 'demo-synthetic-v1',
    confirmedSubtotal: 40,
    confirmedComplete: true,
    confirmedUnresolved: 0,
    ...overrides,
  };
}

const DRAFT = { state: 'draft', confirmedSubtotal: null, confirmedComplete: null } as const;

describe('summarizeRounds', () => {
  it('counts only confirmed rounds, and never adds demo and verified scores together', () => {
    const summary = summarizeRounds(
      [
        round({ sequence: 1 }),
        round({ sequence: 2, targetId: 'verified-v1', confirmedSubtotal: 30, actualShots: 4 }),
        round({ sequence: 3, ...DRAFT, actualShots: 10 }),
      ],
      isVerified,
    );
    expect(summary).toEqual({
      confirmedRounds: 2,
      demo: { rounds: 1, shots: 5, subtotal: 40, complete: true, unresolvedShots: 0 },
      verified: { rounds: 1, shots: 4, subtotal: 30, complete: true, unresolvedShots: 0 },
      draftSequence: 3,
    });
  });

  it('treats an unknown target as unverified', () => {
    const summary = summarizeRounds([round({ targetId: 'gone-v9' })], isVerified);
    expect(summary.verified).toBeNull();
    expect(summary.demo?.subtotal).toBe(40);
  });

  it('adds up unresolved shots of incomplete rounds', () => {
    const summary = summarizeRounds([
      round({ confirmedComplete: false, confirmedUnresolved: 2 }),
      round({ sequence: 2, confirmedComplete: false, confirmedUnresolved: 1 }),
    ]);
    expect(summary.demo).toMatchObject({ complete: false, unresolvedShots: 3, subtotal: 80 });
  });
});

describe('formatPoints', () => {
  it('names the unresolved shots of a subtotal, which are unknown, not zero', () => {
    expect(formatPoints(41, true)).toBe('41 points');
    expect(formatPoints(40, false, 2)).toBe('Subtotal 40 points, 2 unresolved shots not counted');
    expect(formatPoints(1, false)).toBe('Subtotal 1 point, incomplete');
  });
});

describe('formatProgressLine', () => {
  it('describes a new session without inventing results', () => {
    expect(formatProgressLine(null, [])).toBe('In progress · No confirmed rounds');
  });

  it('labels demo scores and keeps them apart from verified ones', () => {
    expect(
      formatProgressLine(
        't',
        [round({}), round({ sequence: 2, targetId: 'verified-v1', confirmedSubtotal: 1 })],
        isVerified,
      ),
    ).toBe('Finished · 1 round · 1 point · Demo scores: 1 round · 40 points');
    expect(
      formatProgressLine(null, [round({ confirmedComplete: false, confirmedUnresolved: 1 })]),
    ).toBe(
      'In progress · Demo scores: 1 round · Subtotal 40 points, 1 unresolved shot not counted',
    );
  });

  it('mentions a draft round', () => {
    expect(formatProgressLine(null, [round({}), round({ sequence: 2, ...DRAFT })])).toBe(
      'In progress · Demo scores: 1 round · 40 points · Round 2 in progress',
    );
  });
});

describe('formatRoundResult', () => {
  it('separates drafts, demo results and incomplete results', () => {
    expect(formatRoundResult(round({ ...DRAFT }))).toBe('In progress, not confirmed');
    expect(formatRoundResult(round({ confirmedSubtotal: 1 }))).toBe('1 point (demo)');
    expect(formatRoundResult(round({ targetId: 'verified-v1' }), isVerified)).toBe('40 points');
    expect(formatRoundResult(round({ confirmedComplete: false, confirmedUnresolved: 2 }))).toBe(
      'Subtotal 40 points, 2 unresolved shots not counted (demo)',
    );
  });
});

describe('summarizeSessionCard', () => {
  it('describes an in-progress session with a draft and no confirmed rounds', () => {
    const summary = summarizeSessionCard(null, [round({ sequence: 1, ...DRAFT })], isVerified);
    expect(summary).toMatchObject({
      status: 'inProgress',
      statusLabel: 'In progress',
      roundsLine: 'No confirmed rounds',
      draftLine: 'Round 1 in progress',
      demo: null,
      verified: null,
    });
    expect(summary.spoken).toBe('In progress. No confirmed rounds. Round 1 in progress');
  });

  it('keeps verified and demo scores apart and says which is which', () => {
    const summary = summarizeSessionCard(
      '2026-10-28T10:00:00.000Z',
      [
        round({ sequence: 1 }),
        round({ sequence: 2, targetId: 'verified-v1', confirmedSubtotal: 30 }),
      ],
      isVerified,
    );
    expect(summary.roundsLine).toBe('2 confirmed rounds · 10 shots');
    expect(summary.verified).toEqual({ short: '30 pts', spoken: '30 points' });
    expect(summary.demo).toEqual({ short: '40 demo pts', spoken: 'Demo score: 40 points' });
  });

  it('shows an incomplete result as a subtotal with its unresolved shots', () => {
    const summary = summarizeSessionCard(
      null,
      [round({ confirmedComplete: false, confirmedUnresolved: 1, confirmedSubtotal: 28 })],
      isVerified,
    );
    expect(summary.demo).toEqual({
      short: 'Subtotal 28 demo pts',
      spoken: 'Demo score: Subtotal 28 points, 1 unresolved shot not counted',
    });
  });
});

describe('formatShortScore', () => {
  it('never drops the demo label or calls a subtotal a total', () => {
    expect(formatShortScore(1, true, false)).toBe('1 pts');
    expect(formatShortScore(87, true, true)).toBe('87 demo pts');
    expect(formatShortScore(28, false, true)).toBe('Subtotal 28 demo pts');
  });
});
