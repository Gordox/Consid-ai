import { findTarget } from '../../domain/target/targetDefinition';
import type { RoundSummary } from '../../persistence/roundRepository';

// Totals over confirmed rounds that share one kind of target geometry.
export type ResultGroup = {
  readonly rounds: number;
  readonly shots: number;
  readonly subtotal: number;
  // Every round in the group is complete, so the subtotal is the exact total.
  readonly complete: boolean;
  readonly unresolvedShots: number;
};

// Planned rounds and shots are plans; only confirmed rounds count as results. Scores on demo
// geometry and on a verified target are never added together.
export type RoundsSummary = {
  readonly confirmedRounds: number;
  readonly demo: ResultGroup | null;
  readonly verified: ResultGroup | null;
  readonly draftSequence: number | null;
};

// A target the app does not know is treated like the demo: its scores are not verified.
export function isVerifiedTarget(targetId: string): boolean {
  return findTarget(targetId)?.isDemo === false;
}

function group(rounds: readonly RoundSummary[]): ResultGroup | null {
  if (rounds.length === 0) return null;
  return {
    rounds: rounds.length,
    shots: rounds.reduce((sum, round) => sum + round.actualShots, 0),
    subtotal: rounds.reduce((sum, round) => sum + (round.confirmedSubtotal ?? 0), 0),
    complete: rounds.every((round) => round.confirmedComplete === true),
    unresolvedShots: rounds.reduce((sum, round) => sum + (round.confirmedUnresolved ?? 0), 0),
  };
}

type IsVerified = (targetId: string) => boolean;

export function summarizeRounds(
  rounds: readonly RoundSummary[],
  isVerified: IsVerified = isVerifiedTarget,
): RoundsSummary {
  const confirmed = rounds.filter((round) => round.state === 'confirmed');
  return {
    confirmedRounds: confirmed.length,
    demo: group(confirmed.filter((round) => !isVerified(round.targetId))),
    verified: group(confirmed.filter((round) => isVerified(round.targetId))),
    draftSequence: rounds.find((round) => round.state === 'draft')?.sequence ?? null,
  };
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

// A complete result is a total. Otherwise it is a subtotal, with the unresolved shots named
// when the count is known: they are unknown, never zero.
export function formatPoints(
  subtotal: number,
  complete: boolean,
  unresolvedShots?: number,
): string {
  if (complete) {
    return plural(subtotal, 'point', 'points');
  }
  const missing =
    unresolvedShots === undefined || unresolvedShots === 0
      ? 'incomplete'
      : `${plural(unresolvedShots, 'unresolved shot', 'unresolved shots')} not counted`;
  return `Subtotal ${plural(subtotal, 'point', 'points')}, ${missing}`;
}

export function formatGroup(result: ResultGroup): string {
  return `${plural(result.rounds, 'round', 'rounds')} · ${formatPoints(result.subtotal, result.complete, result.unresolvedShots)}`;
}

export function formatProgressLine(
  finishedAtUtc: string | null,
  rounds: readonly RoundSummary[],
  isVerified: IsVerified = isVerifiedTarget,
): string {
  const summary = summarizeRounds(rounds, isVerified);
  const parts = [finishedAtUtc === null ? 'In progress' : 'Finished'];
  if (summary.confirmedRounds === 0) {
    parts.push('No confirmed rounds');
  }
  if (summary.verified !== null) {
    parts.push(formatGroup(summary.verified));
  }
  if (summary.demo !== null) {
    parts.push(`Demo scores: ${formatGroup(summary.demo)}`);
  }
  if (summary.draftSequence !== null) {
    parts.push(`Round ${summary.draftSequence} in progress`);
  }
  return parts.join(' · ');
}

export function formatRoundResult(
  round: RoundSummary,
  isVerified: IsVerified = isVerifiedTarget,
): string {
  if (round.state === 'draft') {
    return 'In progress, not confirmed';
  }
  const points = formatPoints(
    round.confirmedSubtotal ?? 0,
    round.confirmedComplete === true,
    round.confirmedUnresolved ?? undefined,
  );
  return isVerified(round.targetId) ? points : `${points} (demo)`;
}
