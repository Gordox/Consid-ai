import type { PhotoRole, RoundPhoto } from '../../domain/round/round';
import type { PickedPhoto } from '../../services/pickedPhoto';

export type SavePhotoDeps = {
  readonly copyIntoApp: (sourceUri: string, id: string) => Promise<string>;
  // Writes the row and returns the file it replaced, if any.
  readonly saveRow: (photo: RoundPhoto) => Promise<string | null>;
  readonly deleteFile: (fileName: string) => void;
  readonly newId: () => string;
  readonly now: () => string;
  readonly reportError: (error: unknown) => void;
};

function deleteQuietly(fileName: string, deps: SavePhotoDeps): void {
  try {
    deps.deleteFile(fileName);
  } catch (error) {
    // A leftover copy wastes space but loses nothing; the row is what counts.
    deps.reportError(error);
  }
}

// Copy first, then write the row. If the row cannot be written the new copy is removed; the
// replaced copy is removed only after the row points at the new one.
export async function savePickedPhoto(
  role: PhotoRole,
  picked: PickedPhoto,
  deps: SavePhotoDeps,
): Promise<RoundPhoto> {
  const fileName = await deps.copyIntoApp(picked.uri, deps.newId());
  const photo: RoundPhoto = {
    role,
    fileName,
    width: picked.width,
    height: picked.height,
    addedAtUtc: deps.now(),
  };
  let replaced: string | null;
  try {
    replaced = await deps.saveRow(photo);
  } catch (error) {
    deleteQuietly(fileName, deps);
    throw error;
  }
  if (replaced !== null && replaced !== fileName) {
    deleteQuietly(replaced, deps);
  }
  return photo;
}
