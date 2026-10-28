import type { RoundSummary } from '../../persistence/roundRepository';

// Planned rounds and shots are plans; only confirmed rounds count as results.
export type RoundsSummary = {
  readonly confirmedRounds: number;
  readonly confirmedShots: number;
  readonly subtotal: number;
  // Every confirmed round is complete, so the subtotal is the exact total.
  readonly complete: boolean;
  readonly draftSequence: number | null;
};

export function summarizeRounds(rounds: readonly RoundSummary[]): RoundsSummary {
  const confirmed = rounds.filter((round) => round.state === 'confirmed');
  return {
    confirmedRounds: confirmed.length,
    confirmedShots: confirmed.reduce((sum, round) => sum + round.actualShots, 0),
    subtotal: confirmed.reduce((sum, round) => sum + (round.confirmedSubtotal ?? 0), 0),
    complete: confirmed.every((round) => round.confirmedComplete === true),
    draftSequence: rounds.find((round) => round.state === 'draft')?.sequence ?? null,
  };
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

export function formatPoints(subtotal: number, complete: boolean): string {
  return complete
    ? plural(subtotal, 'point', 'points')
    : `Subtotal ${plural(subtotal, 'point', 'points')}, incomplete`;
}

export function formatProgressLine(
  finishedAtUtc: string | null,
  rounds: readonly RoundSummary[],
): string {
  const summary = summarizeRounds(rounds);
  const parts = [finishedAtUtc === null ? 'In progress' : 'Finished'];
  if (summary.confirmedRounds === 0) {
    parts.push('No confirmed rounds');
  } else {
    parts.push(plural(summary.confirmedRounds, 'round', 'rounds'));
    parts.push(formatPoints(summary.subtotal, summary.complete));
  }
  if (summary.draftSequence !== null) {
    parts.push(`Round ${summary.draftSequence} in progress`);
  }
  return parts.join(' · ');
}

export function formatRoundResult(round: RoundSummary): string {
  if (round.state === 'draft') {
    return 'In progress, not confirmed';
  }
  return formatPoints(round.confirmedSubtotal ?? 0, round.confirmedComplete === true);
}
