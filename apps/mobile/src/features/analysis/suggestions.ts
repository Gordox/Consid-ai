import type { Calibration, HitMark } from '../../domain/round/round';
import { applyHomography } from '../../domain/target/homography';
import type { TargetDefinition } from '../../domain/target/targetDefinition';
import type { AnalysisCandidate } from '../../services/analysis/analysisContract';
import { targetToPhoto } from '../editor/targetOverlay';

// Below this the user is asked to check the suggestion. Product choice, not a measured threshold.
export const UNCERTAIN_BELOW_CONFIDENCE = 0.6;

// Every suggestion is one shot and starts pending: it counts as a hit only once the user accepts
// or edits it. Several shots in one hole always need the user's input.
export function candidatesToMarks(
  candidates: readonly AnalysisCandidate[],
  newId: () => string,
): HitMark[] {
  return candidates.map((candidate) => ({
    id: newId(),
    position: { x: candidate.x, y: candidate.y },
    shots: 1,
    source: 'suggested',
    uncertain: candidate.uncertain || candidate.confidence < UNCERTAIN_BELOW_CONFIDENCE,
    accepted: false,
    candidateId: candidate.id,
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

export const DEMO_ALGORITHM_VERSION = 'demo-fixture-v1';

// Fixed positions on the target, in millimetres, for trying the review flow in development.
// They have nothing to do with the photo's real holes and are never shown as analysis.
const DEMO_POSITIONS_MM = [
  { x: 3, y: -4, confidence: 0.92, uncertain: false },
  { x: -18, y: 11, confidence: 0.81, uncertain: false },
  { x: 33, y: 27, confidence: 0.45, uncertain: true },
] as const;

export function demoCandidates(
  calibration: Calibration,
  target: TargetDefinition,
): AnalysisCandidate[] | null {
  const toPhoto = targetToPhoto(calibration, target);
  if (toPhoto === null) return null;
  const candidates: AnalysisCandidate[] = [];
  for (const [index, position] of DEMO_POSITIONS_MM.entries()) {
    const point = applyHomography(toPhoto, position);
    if (point === null) return null;
    candidates.push({
      id: `demo-${index + 1}`,
      x: point.x,
      y: point.y,
      diameterPx: null,
      confidence: position.confidence,
      uncertain: position.uncertain,
    });
  }
  return candidates;
}
