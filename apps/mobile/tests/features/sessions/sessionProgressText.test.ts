import type { RoundSummary } from '../../../src/persistence/roundRepository';
import {
  formatProgressLine,
  formatRoundResult,
  summarizeRounds,
} from '../../../src/features/sessions/sessionProgressText';

function round(overrides: Partial<RoundSummary>): RoundSummary {
  return {
    id: 'r',
    sequence: 1,
    state: 'confirmed',
    actualShots: 5,
    confirmedSubtotal: 40,
    confirmedComplete: true,
    ...overrides,
  };
}

describe('summarizeRounds', () => {
  it('counts only confirmed rounds as results', () => {
    const summary = summarizeRounds([
      round({ sequence: 1 }),
      round({ sequence: 2, confirmedSubtotal: 30, confirmedComplete: false, actualShots: 4 }),
      round({
        sequence: 3,
        state: 'draft',
        confirmedSubtotal: null,
        confirmedComplete: null,
        actualShots: 10,
      }),
    ]);
    expect(summary).toEqual({
      confirmedRounds: 2,
      confirmedShots: 9,
      subtotal: 70,
      complete: false,
      draftSequence: 3,
    });
  });
});

describe('formatProgressLine', () => {
  it('describes a new session without inventing results', () => {
    expect(formatProgressLine(null, [])).toBe('In progress · No confirmed rounds');
  });

  it('shows a total only when every round is complete', () => {
    expect(formatProgressLine('t', [round({}), round({ sequence: 2, confirmedSubtotal: 1 })])).toBe(
      'Finished · 2 rounds · 41 points',
    );
    expect(formatProgressLine(null, [round({ confirmedComplete: false })])).toBe(
      'In progress · 1 round · Subtotal 40 points, incomplete',
    );
  });

  it('mentions a draft round', () => {
    expect(
      formatProgressLine(null, [
        round({}),
        round({ sequence: 2, state: 'draft', confirmedSubtotal: null, confirmedComplete: null }),
      ]),
    ).toBe('In progress · 1 round · 40 points · Round 2 in progress');
  });
});

describe('formatRoundResult', () => {
  it('separates drafts, complete and incomplete results', () => {
    expect(
      formatRoundResult(
        round({ state: 'draft', confirmedSubtotal: null, confirmedComplete: null }),
      ),
    ).toBe('In progress, not confirmed');
    expect(formatRoundResult(round({ confirmedSubtotal: 1 }))).toBe('1 point');
    expect(formatRoundResult(round({ confirmedComplete: false }))).toBe(
      'Subtotal 40 points, incomplete',
    );
  });
});
