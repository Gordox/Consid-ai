import type { PhotoRole } from '../../domain/round/round';
import type { PendingPhotoPick } from '../../persistence/pendingPhotoPick';
import {
  DraftChangedError,
  RoundNotEditableError,
  RoundNotFoundError,
} from '../../persistence/roundRepository';
import type { PickedPhoto, PickOutcome } from '../../services/pickedPhoto';

// Choosing a round photo from the library, the same way from the round screen and the camera
// screen. Before the picker opens, the round, role and draft revision are recorded, so a photo
// Android delivers after ending the app is saved to that round only (PhotoRecovery). The record
// is cleared whatever the picker answers while the app runs.

export type LibraryPickOutcome =
  | { readonly kind: 'saved' }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'permissionDenied'; readonly canAskAgain: boolean }
  // The picker answered with something unusable.
  | { readonly kind: 'failed' }
  // The pending record could not be written; the picker was not opened.
  | { readonly kind: 'notPrepared' }
  // The round changed while the photo was being saved; the photo was not added.
  | { readonly kind: 'changed' }
  // The round was confirmed or discarded meanwhile; the photo was not added.
  | { readonly kind: 'roundClosed' }
  | { readonly kind: 'saveFailed' };

export type LibraryPickDeps = {
  readonly recordPending: (pick: PendingPhotoPick) => Promise<void>;
  readonly clearPending: () => Promise<void>;
  readonly choose: () => Promise<PickOutcome>;
  // savePickedPhoto at the given revision; deletes its own copies if it fails.
  readonly save: (photo: PickedPhoto) => Promise<void>;
  // Called once the user has picked, before the copy is saved.
  readonly onSaving?: () => void;
  readonly now: () => string;
  readonly reportError: (error: unknown) => void;
};

export async function pickLibraryPhoto(
  deps: LibraryPickDeps,
  input: { readonly roundId: string; readonly role: PhotoRole; readonly draftRevision: number },
): Promise<LibraryPickOutcome> {
  try {
    await deps.recordPending({
      roundId: input.roundId,
      role: input.role,
      startedAtUtc: deps.now(),
      draftRevision: input.draftRevision,
    });
  } catch (error) {
    deps.reportError(error);
    return { kind: 'notPrepared' };
  }
  try {
    const picked = await deps.choose();
    if (picked.kind !== 'picked') {
      return picked;
    }
    deps.onSaving?.();
    try {
      await deps.save(picked.photo);
      return { kind: 'saved' };
    } catch (error) {
      if (error instanceof DraftChangedError) return { kind: 'changed' };
      if (error instanceof RoundNotEditableError || error instanceof RoundNotFoundError) {
        return { kind: 'roundClosed' };
      }
      deps.reportError(error);
      return { kind: 'saveFailed' };
    }
  } finally {
    await deps.clearPending().catch(deps.reportError);
  }
}

// What the screen says for each outcome; null when there is nothing to say.
export function libraryPickMessage(outcome: LibraryPickOutcome): string | null {
  switch (outcome.kind) {
    case 'saved':
    case 'cancelled':
      return null;
    case 'permissionDenied':
      return outcome.canAskAgain
        ? 'The app may not open your photo library. Allow access when asked, or take a photo with the camera.'
        : 'Photo library access is off for this app. Allow it in Settings, or take a photo with the camera.';
    case 'failed':
      return "Couldn't use that photo. Try again or choose another one.";
    case 'notPrepared':
      return "Couldn't prepare the photo. Nothing was changed. Try again.";
    case 'changed':
      return "The round changed while the photo was being saved, so it wasn't added. Check the round and choose the photo again.";
    case 'roundClosed':
      return "This round is no longer in progress, so the photo wasn't added.";
    case 'saveFailed':
      return "Couldn't save the photo. Nothing was changed. Try again.";
  }
}
