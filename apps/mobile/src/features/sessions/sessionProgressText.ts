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

// Short score text for cards and rows, e.g. "174 demo pts" or "Subtotal 28 demo pts". Every
// demo score says so; an incomplete result is a subtotal, never a total.
export function formatShortScore(subtotal: number, complete: boolean, demo: boolean): string {
  const points = `${subtotal} ${demo ? 'demo pts' : 'pts'}`;
  return complete ? points : `Subtotal ${points}`;
}

export type ScoreText = {
  readonly short: string;
  readonly spoken: string;
};

function scoreText(result: ResultGroup, demo: boolean): ScoreText {
  const points = formatPoints(result.subtotal, result.complete, result.unresolvedShots);
  return {
    short: formatShortScore(result.subtotal, result.complete, demo),
    spoken: demo ? `Demo score: ${points}` : points,
  };
}

export type SessionStatus = 'inProgress' | 'finished';

export type SessionCardSummary = {
  readonly status: SessionStatus;
  readonly statusLabel: string;
  // Confirmed rounds and shots fired in them, e.g. "2 confirmed rounds · 20 shots".
  readonly roundsLine: string;
  readonly draftLine: string | null;
  // Verified and demo results are separate and never added together.
  readonly verified: ScoreText | null;
  readonly demo: ScoreText | null;
  // Status, rounds, scores and draft in one sentence for the card's accessible name.
  readonly spoken: string;
};

export function sessionStatus(finishedAtUtc: string | null): SessionStatus {
  return finishedAtUtc === null ? 'inProgress' : 'finished';
}

export function summarizeSessionCard(
  finishedAtUtc: string | null,
  rounds: readonly RoundSummary[],
  isVerified: IsVerified = isVerifiedTarget,
): SessionCardSummary {
  const summary = summarizeRounds(rounds, isVerified);
  const status = sessionStatus(finishedAtUtc);
  const shots = (summary.demo?.shots ?? 0) + (summary.verified?.shots ?? 0);
  const roundsLine =
    summary.confirmedRounds === 0
      ? 'No confirmed rounds'
      : `${plural(summary.confirmedRounds, 'confirmed round', 'confirmed rounds')} · ${plural(shots, 'shot', 'shots')}`;
  const draftLine =
    summary.draftSequence === null ? null : `Round ${summary.draftSequence} in progress`;
  const verified = summary.verified === null ? null : scoreText(summary.verified, false);
  const demo = summary.demo === null ? null : scoreText(summary.demo, true);
  const statusLabel = status === 'finished' ? 'Finished' : 'In progress';
  return {
    status,
    statusLabel,
    roundsLine,
    draftLine,
    verified,
    demo,
    spoken: [statusLabel, roundsLine, verified?.spoken, demo?.spoken, draftLine]
      .filter((part) => part !== null && part !== undefined)
      .join('. '),
  };
}
