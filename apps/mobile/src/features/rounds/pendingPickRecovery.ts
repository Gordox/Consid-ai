import type { PendingPhotoPick } from '../../persistence/pendingPhotoPick';
import { RoundNotEditableError, RoundNotFoundError } from '../../persistence/roundRepository';
import { type PickedPhoto, toPickOutcome } from '../../services/pickedPhoto';

export type RecoveryDeps = {
  readonly readPending: () => Promise<PendingPhotoPick | null>;
  // The picker result Android kept after ending the app, or null when there is none.
  readonly takePendingResult: () => Promise<unknown>;
  readonly savePhoto: (pick: PendingPhotoPick, photo: PickedPhoto) => Promise<void>;
  readonly clearPending: () => Promise<void>;
  readonly reportError: (error: unknown) => void;
};

export type RecoveryOutcome =
  | { readonly kind: 'nothingPending' }
  | { readonly kind: 'saved'; readonly pick: PendingPhotoPick }
  | {
      readonly kind: 'notSaved';
      readonly pick: PendingPhotoPick;
      readonly reason: 'noPhoto' | 'roundClosed' | 'saveFailed';
    };

// Runs once after the database opens. A delivered photo is saved only to the round and role the
// app recorded before opening the picker; without that record it is ignored rather than guessed.
// The record is cleared in every case, so the same photo is never applied twice.
export async function recoverPendingPick(deps: RecoveryDeps): Promise<RecoveryOutcome> {
  const pick = await deps.readPending();
  if (pick === null) {
    return { kind: 'nothingPending' };
  }
  try {
    const result = await deps.takePendingResult();
    if (result === null || result === undefined) {
      // The record is cleared whenever the picker returns while the app runs, so a record left
      // over means the pick was interrupted and Android kept no result: say so, guess nothing.
      return { kind: 'notSaved', pick, reason: 'noPhoto' };
    }
    const outcome = toPickOutcome(result);
    if (outcome.kind !== 'picked') {
      return { kind: 'notSaved', pick, reason: 'noPhoto' };
    }
    try {
      await deps.savePhoto(pick, outcome.photo);
      return { kind: 'saved', pick };
    } catch (error) {
      if (error instanceof RoundNotEditableError || error instanceof RoundNotFoundError) {
        return { kind: 'notSaved', pick, reason: 'roundClosed' };
      }
      deps.reportError(error);
      return { kind: 'notSaved', pick, reason: 'saveFailed' };
    }
  } finally {
    await deps.clearPending();
  }
}
