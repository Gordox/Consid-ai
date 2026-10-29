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
  unsafePhoto:
    "The photo copy to send isn't an upright JPEG without location data, so nothing was sent. Take or choose the photo again.",
  calibrationRejected:
    "The analysis service couldn't use the calibration with this photo. Calibrate again, then try again.",
  rateLimited: 'The analysis service is busy. Try again in a moment.',
  serverError: 'The analysis service had a problem. Try again later or mark hits yourself.',
  invalidResponse:
    "The analysis answer couldn't be used and was ignored. Try again or mark hits yourself.",
  stale: 'An older analysis answer arrived after a newer request and was ignored.',
  imageMismatch: 'The analysis answer was for a different photo and was ignored. Try again.',
  // The service may already have the photos and may finish; only its answer is discarded.
  cancelled:
    'You cancelled the analysis. Your photos and marks are kept, and any answer that still arrives is ignored. Try again, or mark the hits yourself.',
  unusableImage:
    "The photo couldn't be analysed, for example because of blur or glare. Retake it or mark hits yourself.",
  registrationFailed:
    "The target couldn't be found in the photo. Retake it with the whole target in view, or mark hits yourself.",
};

// Photo problems the analysis noticed. numberColumnsSkipped is about what was searched, not
// about the photo, and gets its own sentence.
const WARNING_TEXT: Record<Exclude<WarningCode, 'numberColumnsSkipped'>, string> = {
  blur: 'blur',
  glare: 'glare',
  shadow: 'shadows',
  clipping: 'part of the target cut off',
  partialTarget: 'target not fully visible',
  stickerEdges: 'sticker edges that may look like holes',
  other: 'other photo problems',
};

export const NUMBER_COLUMNS_SKIPPED_TEXT =
  'The columns of printed numbers were not searched. Mark any holes there yourself; a hole that is not marked is never counted as a miss.';

export function suggestionSummary(count: number, warnings: readonly WarningCode[]): string {
  const skipped = warnings.includes('numberColumnsSkipped');
  const where = skipped ? ' outside the number columns' : '';
  const parts = [
    count === 0
      ? `No new holes were found${where}. Mark any hits yourself.`
      : `${count === 1 ? '1 suggestion' : `${count} suggestions`} added. Check each one before confirming.`,
  ];
  if (skipped) {
    parts.push(NUMBER_COLUMNS_SKIPPED_TEXT);
  }
  const problems = [...new Set(warnings)].flatMap((code) =>
    code === 'numberColumnsSkipped' ? [] : [WARNING_TEXT[code]],
  );
  if (problems.length > 0) {
    parts.push(`The analysis noticed: ${problems.join(', ')}.`);
  }
  return parts.join(' ');
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
    : 'Without a before photo only the after photo is used. This is less reliable: sticker edges can look like holes, and holes on the columns of printed numbers are not suggested. Mark those yourself; an unmarked hole is never counted as a miss.';
}

const STORED_ERROR_TEXT: Record<string, string> = {
  ...ANALYSIS_ERROR_TEXT,
  stale: 'The last answer arrived after the photos or the request changed, and was ignored.',
  calibrationNeeded: 'The last demo run needed a calibration.',
  interrupted:
    "The last analysis didn't finish because the app was closed or restarted. Your photos and marks are kept. Try again.",
  oldPhotoCopy: ANALYSIS_BLOCK_TEXT.oldPhotoCopy,
};

// One line about the newest stored attempt. A pending attempt without a running request in this
// app has no outcome and never will (its result could not be recorded).
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
          text: "The last analysis didn't finish and has no result. Your photos and marks are kept. Try again.",
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
  if (attempt.errorCode === 'cancelled') {
    return {
      tone: 'info',
      text: 'You cancelled the last analysis. Try again, or mark the hits yourself.',
    };
  }
  const known = attempt.errorCode !== null ? STORED_ERROR_TEXT[attempt.errorCode] : undefined;
  return { tone: 'error', text: known ?? 'The last analysis failed. Try again.' };
}

// Banner titles from the error table in docs/design/ui-ux.md §8; the body is ANALYSIS_ERROR_TEXT.
export function analysisErrorTitle(code: string): string {
  switch (code) {
    case 'network':
    case 'timeout':
    case 'rateLimited':
    case 'serverError':
      return "Couldn't reach analysis service";
    case 'registrationFailed':
      return "Photos couldn't be aligned";
    case 'unusableImage':
      return 'This photo may be hard to review';
    case 'cancelled':
      return 'Analysis cancelled';
    default:
      return "Couldn't analyse the photos";
  }
}
