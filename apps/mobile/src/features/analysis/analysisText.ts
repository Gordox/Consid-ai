import type { AnalysisError } from '../../services/analysis/analysisClient';
import type { AnalysisStatus, WarningCode } from '../../services/analysis/analysisContract';

// Each failure says what happened and what the user can do; photos and marks are always kept.
export const ANALYSIS_ERROR_TEXT: Record<
  AnalysisError | Exclude<AnalysisStatus, 'succeeded'>,
  string
> = {
  fileTooLarge:
    'A photo is too large to send (limit 15 MB) or could not be read. Retake it or mark hits yourself.',
  network:
    "Couldn't reach the analysis service. Check the connection and try again. Your photos and marks are kept.",
  timeout: 'Analysis took too long and was stopped. Try again, or mark hits yourself.',
  rejected: "The analysis service didn't accept the photos. Retake them or mark hits yourself.",
  rateLimited: 'The analysis service is busy. Try again in a moment.',
  serverError: 'The analysis service had a problem. Try again later or mark hits yourself.',
  invalidResponse:
    "The analysis answer couldn't be used and was ignored. Try again or mark hits yourself.",
  stale: 'An older analysis answer arrived after a newer request and was ignored.',
  imageMismatch: 'The analysis answer was for a different photo and was ignored. Try again.',
  unusableImage:
    "The photo couldn't be analysed, for example because of blur or glare. Retake it or mark hits yourself.",
  registrationFailed:
    "The target couldn't be found in the photo. Retake it with the whole target in view, or mark hits yourself.",
};

const WARNING_TEXT: Record<WarningCode, string> = {
  blur: 'blur',
  glare: 'glare',
  shadow: 'shadows',
  clipping: 'part of the target cut off',
  partialTarget: 'target not fully visible',
  stickerEdges: 'sticker edges that may look like holes',
  other: 'other photo problems',
};

export function suggestionSummary(count: number, warnings: readonly WarningCode[]): string {
  const found =
    count === 0
      ? 'No new holes were found. Mark any hits yourself.'
      : `${count === 1 ? '1 suggestion' : `${count} suggestions`} added. Check each one before confirming.`;
  if (warnings.length === 0) return found;
  return `${found} The analysis noticed: ${[...new Set(warnings)].map((code) => WARNING_TEXT[code]).join(', ')}.`;
}
