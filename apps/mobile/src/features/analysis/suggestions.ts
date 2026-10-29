import type { HitMark } from '../../domain/round/round';
import type { AnalysisCandidate } from '../../services/analysis/analysisContract';

// Below this the user is asked to check the suggestion. Product choice, not a measured threshold.
export const UNCERTAIN_BELOW_CONFIDENCE = 0.6;

// Every suggestion is one shot and starts pending: it counts as a hit only once the user accepts
// or edits it. Several shots in one hole always need the user's input.
export function candidatesToMarks(
  candidates: readonly AnalysisCandidate[],
  newId: () => string,
  attemptId: string,
): HitMark[] {
  return candidates.map((candidate) => ({
    id: newId(),
    position: { x: candidate.x, y: candidate.y },
    shots: 1,
    source: 'suggested',
    uncertain: candidate.uncertain || candidate.confidence < UNCERTAIN_BELOW_CONFIDENCE,
    accepted: false,
    candidateId: candidate.id,
    attemptId,
  }));
}

// How close a new suggestion may be to a mark the user keeps before it counts as the same hole:
// the typical suggested hole diameter, or 1 % of the photo's long side when none is given.
export function duplicateRadiusPx(
  candidates: readonly AnalysisCandidate[],
  image: { readonly width: number; readonly height: number },
): number {
  const diameters = candidates
    .map((candidate) => candidate.diameterPx)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  const median = diameters[Math.floor(diameters.length / 2)];
  return median ?? 0.01 * Math.max(image.width, image.height);
}
