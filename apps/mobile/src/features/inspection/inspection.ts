import type {
  Calibration,
  ConfirmedShot,
  HitMark,
  Round,
  RoundPhoto,
} from '../../domain/round/round';
import { evaluateDraft } from '../../domain/round/roundEvaluation';
import { findTarget } from '../../domain/target/targetDefinition';
import type { SessionDatabase } from '../../persistence/database';
import { getRound, getRoundAnnotations } from '../../persistence/roundRepository';
import { formatShortScore } from '../sessions/sessionProgressText';

// Read-only inspection of a round's photos and hits. Only reads are made here; nothing in this
// module can change marks, calibration or scores.

export type Inspection = {
  readonly roundId: string;
  readonly sequence: number;
  readonly confirmed: boolean;
  readonly after: RoundPhoto | null;
  readonly before: RoundPhoto | null;
  readonly calibration: Calibration | null;
  readonly targetId: string;
  readonly hitDiameterMm: number;
  readonly marks: readonly HitMark[];
  // Per mark: its number (accepted hits only) and what is known about its score.
  readonly details: ReadonlyMap<string, string>;
  // A confirmed round's stored shots by mark; null for a draft. A confirmed round is shown from
  // these, never from the marks' current review state.
  readonly confirmedShots: ReadonlyMap<string, ConfirmedShot> | null;
};

export type MarkerKind = 'counted' | 'suggestion' | 'notInResult';

export type InspectionMarkers = {
  readonly numbers: ReadonlyMap<string, number>;
  readonly kind: (mark: HitMark) => MarkerKind;
  readonly status: (mark: HitMark) => string;
};

const SOURCE_TEXT = {
  manual: 'marked by you',
  suggested: 'accepted suggestion',
  suggestedEdited: 'suggestion you moved',
} as const;

// How the markers of an inspected round are numbered, drawn and described. For a confirmed round
// this follows the stored result: a mark in it is a counted hit even if an older schema left it
// looking like an unreviewed suggestion, and a mark outside it is labelled so. Where the result
// does not record where a hit came from, it says so instead of guessing.
export function inspectionMarkers(inspection: Inspection): InspectionMarkers {
  const shots = inspection.confirmedShots;
  if (shots === null) {
    const numbers = new Map<string, number>();
    for (const mark of inspection.marks) {
      if (mark.accepted) numbers.set(mark.id, numbers.size + 1);
    }
    return {
      numbers,
      kind: (mark) => (mark.accepted ? 'counted' : 'suggestion'),
      status: (mark) =>
        mark.accepted
          ? `${SOURCE_TEXT[mark.source]}${mark.shots > 1 ? `, ${mark.shots} shots in this hole` : ''}`
          : mark.uncertain
            ? 'uncertain suggestion, not counted'
            : 'suggestion, not counted',
    };
  }
  const numbers = new Map<string, number>();
  for (const mark of inspection.marks) {
    if (shots.has(mark.id)) numbers.set(mark.id, numbers.size + 1);
  }
  return {
    numbers,
    kind: (mark) => (shots.has(mark.id) ? 'counted' : 'notInResult'),
    status: (mark) => {
      const shot = shots.get(mark.id);
      if (shot === undefined) return 'not part of the confirmed result';
      const origin = shot.source === undefined ? 'source not recorded' : SOURCE_TEXT[shot.source];
      return `${origin}${shot.shots > 1 ? `, ${shot.shots} shots in this hole` : ''}`;
    },
  };
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

// A confirmed round shows the values fixed at confirmation, never a recalculation. A draft shows
// the domain's current evaluation; a suggestion has no score until it is accepted.
export function hitDetails(round: Round, marks: readonly HitMark[]): Map<string, string> {
  const details = new Map<string, string>();
  if (round.state === 'confirmed') {
    const demo = findTarget(round.result.targetId)?.isDemo !== false;
    for (const mark of marks) {
      const shot = round.result.shots.find((entry) => entry.markId === mark.id);
      details.set(
        mark.id,
        shot === undefined
          ? 'Not part of the confirmed result'
          : `${formatShortScore(shot.value, true, demo)}${shot.shots > 1 ? ` × ${shot.shots}` : ''}`,
      );
    }
    return details;
  }
  const target = findTarget(round.targetId);
  const evaluation = evaluateDraft(round, target);
  const demo = target?.isDemo !== false;
  for (const mark of marks) {
    if (!mark.accepted) {
      details.set(mark.id, 'Suggestion, no score until accepted');
      continue;
    }
    const shot = evaluation.shots?.find((entry) => entry.markId === mark.id);
    details.set(
      mark.id,
      shot === undefined
        ? 'No score until the target is aligned'
        : `${formatShortScore(shot.value, true, demo)}${mark.shots > 1 ? ` × ${plural(mark.shots, 'shot', 'shots')}` : ''}`,
    );
  }
  return details;
}

export async function loadInspection(
  db: SessionDatabase,
  sessionId: string,
  roundId: string,
): Promise<Inspection | null> {
  const round = await getRound(db, roundId);
  if (round === null || round.sessionId !== sessionId) return null;
  const annotations =
    round.state === 'draft'
      ? { calibration: round.calibration, marks: round.marks }
      : await getRoundAnnotations(db, roundId);
  if (annotations === null) return null;
  return {
    roundId: round.id,
    sequence: round.sequence,
    confirmed: round.state === 'confirmed',
    after: round.photos.after,
    before: round.photos.before,
    calibration: annotations.calibration,
    targetId: round.state === 'confirmed' ? round.result.targetId : round.targetId,
    hitDiameterMm: round.state === 'confirmed' ? round.result.hitDiameterMm : round.hitDiameterMm,
    marks: annotations.marks,
    details: hitDetails(round, annotations.marks),
    confirmedShots:
      round.state === 'confirmed'
        ? new Map(round.result.shots.map((shot) => [shot.markId, shot]))
        : null,
  };
}
