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
  calibrationRejected:
    "The analysis service couldn't use the calibration with this photo. Calibrate again, then try again.",
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

export type AnalysisBlock =
  'noAfterPhoto' | 'photoMissing' | 'oldPhotoCopy' | 'notCalibrated' | 'unknownTarget';

export const ANALYSIS_BLOCK_TEXT: Record<AnalysisBlock, string> = {
  noAfterPhoto: 'Add an after photo first.',
  photoMissing: 'A photo file is missing from this device. Take or choose it again.',
  oldPhotoCopy:
    'A photo was saved by an earlier version of the app, before orientation handling. Take or choose it again to analyse it.',
  notCalibrated:
    'Calibrate the after photo in the editor first, so analysis looks only at the target.',
  unknownTarget: 'This round uses a target the app does not know.',
};

// Why analysis cannot start yet, or null when it can. Checked in this order so the user always
// gets the first thing to fix.
export function analysisBlock(input: {
  hasAfter: boolean;
  photosMissing: boolean;
  oldPhotoCopy: boolean;
  calibrated: boolean;
  targetKnown: boolean;
}): AnalysisBlock | null {
  if (!input.hasAfter) return 'noAfterPhoto';
  if (input.photosMissing) return 'photoMissing';
  if (input.oldPhotoCopy) return 'oldPhotoCopy';
  if (!input.targetKnown) return 'unknownTarget';
  if (!input.calibrated) return 'notCalibrated';
  return null;
}

export function modeText(paired: boolean): string {
  return paired
    ? 'Compares the before and after photos to find new holes.'
    : 'Without a before photo only the after photo is used. This is less reliable: sticker edges can look like holes, and holes on the columns of printed numbers are not suggested.';
}

const STORED_ERROR_TEXT: Record<string, string> = {
  ...ANALYSIS_ERROR_TEXT,
  stale: 'The last answer arrived after the photos or the request changed, and was ignored.',
  calibrationNeeded: 'The last demo run needed a calibration.',
};

// One line about the newest stored attempt. A pending attempt that is not running in this
// screen was interrupted (the app closed or the request never finished).
export function latestAttemptText(
  attempt: {
    readonly status: 'pending' | 'succeeded' | 'failed';
    readonly errorCode: string | null;
    readonly source: 'service' | 'demo';
  },
  runningHere: boolean,
): { readonly tone: 'info' | 'error'; readonly text: string } {
  if (attempt.status === 'pending') {
    return runningHere
      ? { tone: 'info', text: 'Analysing…' }
      : {
          tone: 'error',
          text: "The last analysis didn't finish (the app closed or the connection dropped). Your photos and marks are kept. Try again.",
        };
  }
  if (attempt.status === 'succeeded') {
    return {
      tone: 'info',
      text:
        attempt.source === 'demo'
          ? 'Last run: demo suggestions (development only, not analysis of your photo).'
          : 'Last analysis finished.',
    };
  }
  const known = attempt.errorCode !== null ? STORED_ERROR_TEXT[attempt.errorCode] : undefined;
  return { tone: 'error', text: known ?? 'The last analysis failed. Try again.' };
}
