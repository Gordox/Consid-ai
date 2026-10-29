import type { PhotoRole, RoundPhoto } from '../../domain/round/round';
import type { PickedPhoto } from '../../services/pickedPhoto';
import { photoFileName } from '../../services/photoFiles';

// Deletes photo copies only after checking, for each file just before deleting it, that no row
// refers to it. The journal record is removed after the file, so a failed delete is retried by
// the next cleanup instead of being forgotten.
export type DeletePhotoDeps = {
  readonly isReferenced: (fileName: string) => Promise<boolean>;
  readonly deleteFile: (fileName: string) => void;
  readonly forget: (fileName: string) => Promise<void>;
  readonly reportError: (error: unknown) => void;
};

export type DeleteOutcome = { readonly deleted: string[]; readonly kept: string[] };

export async function deleteUnreferencedPhotos(
  fileNames: readonly string[],
  deps: DeletePhotoDeps,
): Promise<DeleteOutcome> {
  const deleted: string[] = [];
  const kept: string[] = [];
  for (const fileName of new Set(fileNames)) {
    try {
      if (await deps.isReferenced(fileName)) {
        kept.push(fileName);
        continue;
      }
      deps.deleteFile(fileName);
      await deps.forget(fileName);
      deleted.push(fileName);
    } catch (error) {
      // A leftover copy wastes space but loses nothing; the journal keeps it for later.
      deps.reportError(error);
      kept.push(fileName);
    }
  }
  return { deleted, kept };
}

// A recorded file younger than this may belong to a save that is still running, so cleanup
// leaves it. The age comes from the journal, never from the file system, whose times can be
// copied from the original photo.
export const ABANDONED_MIN_AGE_MS = 10 * 60 * 1000;

export function abandonedCutoffUtc(nowMs: number): string {
  return new Date(nowMs - ABANDONED_MIN_AGE_MS).toISOString();
}

export type SavePhotoDeps = {
  // Records a file name in the journal before the file is written.
  readonly recordFile: (fileName: string) => Promise<void>;
  readonly copyOriginal: (sourceUri: string, fileName: string) => Promise<void>;
  readonly createNormalized: (
    originalFileName: string,
    fileName: string,
  ) => Promise<{ readonly width: number; readonly height: number }>;
  // Writes the row and returns the files it replaced, if any.
  readonly saveRow: (photo: RoundPhoto) => Promise<readonly string[]>;
  // Deletes files no row refers to (deleteUnreferencedPhotos); never throws.
  readonly discardFiles: (fileNames: readonly string[]) => Promise<void>;
  readonly newId: () => string;
  readonly now: () => string;
};

// Record, copy, normalise, then write the row. If a later step fails the new copies are
// discarded; the replaced copies are discarded only after the row points at the new ones. The
// size stored is the normalised photo's, never the picker's, because marks and analysis use
// its pixels.
export async function savePickedPhoto(
  role: PhotoRole,
  picked: PickedPhoto,
  deps: SavePhotoDeps,
): Promise<RoundPhoto> {
  const originalFileName = photoFileName(deps.newId(), picked.uri);
  const normalizedFileName = photoFileName(deps.newId(), 'normalized.jpg');
  const created: string[] = [];
  let photo: RoundPhoto;
  try {
    await deps.recordFile(originalFileName);
    created.push(originalFileName);
    await deps.copyOriginal(picked.uri, originalFileName);
    await deps.recordFile(normalizedFileName);
    created.push(normalizedFileName);
    const size = await deps.createNormalized(originalFileName, normalizedFileName);
    photo = {
      role,
      fileName: normalizedFileName,
      originalFileName,
      width: size.width,
      height: size.height,
      addedAtUtc: deps.now(),
    };
  } catch (error) {
    await deps.discardFiles(created);
    throw error;
  }
  let replaced: readonly string[];
  try {
    replaced = await deps.saveRow(photo);
  } catch (error) {
    await deps.discardFiles(created);
    throw error;
  }
  await deps.discardFiles(replaced.filter((fileName) => !created.includes(fileName)));
  return photo;
}
