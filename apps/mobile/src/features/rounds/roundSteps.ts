import type { DraftRound } from '../../domain/round/round';

// The round screen shows one step at a time (docs/design/ui-ux.md §7). Alignment and hit review
// happen in the editor route, confirmation in the confirm route.
export type RoundStep = 'setup' | 'photos' | 'analyse';

// Where a draft continues after a restart or when it is opened again. Only what the draft
// contains decides this; a step is never treated as finished because it was visited.
export function initialRoundStep(draft: DraftRound): RoundStep {
  const { before, after } = draft.photos;
  if (after === null && before === null && draft.marks.length === 0) {
    return 'setup';
  }
  if (after === null || draft.calibration === null) {
    return 'photos';
  }
  return 'analyse';
}

export type ProgressStep = 'photos' | 'align' | 'review';
export type ProgressState = 'done' | 'current' | 'todo';

export const PROGRESS_STEPS: readonly { readonly step: ProgressStep; readonly label: string }[] = [
  { step: 'photos', label: 'Photos' },
  { step: 'align', label: 'Align' },
  { step: 'review', label: 'Review' },
];

// Done means the draft holds the step's result (an after photo, a calibration); review is never
// done before the round is confirmed.
export function progressStates(
  draft: Pick<DraftRound, 'photos' | 'calibration'>,
  current: ProgressStep,
): Record<ProgressStep, ProgressState> {
  const done: Record<ProgressStep, boolean> = {
    photos: draft.photos.after !== null,
    align: draft.calibration !== null,
    review: false,
  };
  const state = (step: ProgressStep): ProgressState =>
    step === current ? 'current' : done[step] ? 'done' : 'todo';
  return { photos: state('photos'), align: state('align'), review: state('review') };
}
