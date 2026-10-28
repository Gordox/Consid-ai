import type { PhotoRole, RoundPhoto } from '../../domain/round/round';
import type { PickedPhoto } from '../../services/pickedPhoto';
import type { NormalizedPhoto, StoredPhotoFile } from '../../services/photoStorage';

export type SavePhotoDeps = {
  readonly copyOriginal: (sourceUri: string, id: string) => Promise<string>;
  readonly createNormalized: (originalFileName: string, id: string) => Promise<NormalizedPhoto>;
  // Writes the row and returns the files it replaced, if any.
  readonly saveRow: (photo: RoundPhoto) => Promise<readonly string[]>;
  readonly deleteFile: (fileName: string) => void;
  readonly newId: () => string;
  readonly now: () => string;
  readonly reportError: (error: unknown) => void;
};

function deleteQuietly(fileName: string, deps: Pick<SavePhotoDeps, 'deleteFile' | 'reportError'>) {
  try {
    deps.deleteFile(fileName);
  } catch (error) {
    // A leftover copy wastes space but loses nothing; the row is what counts. The startup
    // cleanup removes it later.
    deps.reportError(error);
  }
}

// Copy, normalise, then write the row. If a later step fails the new copies are removed; the
// replaced copies are removed only after the row points at the new ones. The size stored is the
// normalised photo's, never the picker's, because marks and analysis use its pixels.
export async function savePickedPhoto(
  role: PhotoRole,
  picked: PickedPhoto,
  deps: SavePhotoDeps,
): Promise<RoundPhoto> {
  const originalFileName = await deps.copyOriginal(picked.uri, deps.newId());
  let normalized: NormalizedPhoto;
  try {
    normalized = await deps.createNormalized(originalFileName, deps.newId());
  } catch (error) {
    deleteQuietly(originalFileName, deps);
    throw error;
  }
  const photo: RoundPhoto = {
    role,
    fileName: normalized.fileName,
    originalFileName,
    width: normalized.width,
    height: normalized.height,
    addedAtUtc: deps.now(),
  };
  let replaced: readonly string[];
  try {
    replaced = await deps.saveRow(photo);
  } catch (error) {
    deleteQuietly(normalized.fileName, deps);
    deleteQuietly(originalFileName, deps);
    throw error;
  }
  for (const fileName of replaced) {
    if (fileName !== normalized.fileName && fileName !== originalFileName) {
      deleteQuietly(fileName, deps);
    }
  }
  return photo;
}

// A copy is written before its row, so a fresh unreferenced file may belong to a save that is
// still running. Only copies older than this are treated as abandoned.
export const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

// Files in the database's own photo folder that no row refers to and that are old enough to
// be abandoned. A file without a known modification time is kept.
export function findOrphanPhotos(
  files: readonly StoredPhotoFile[],
  referenced: ReadonlySet<string>,
  nowMs: number,
): string[] {
  return files
    .filter(
      (file) =>
        !referenced.has(file.fileName) &&
        file.modifiedAtMs !== null &&
        nowMs - file.modifiedAtMs >= ORPHAN_MIN_AGE_MS,
    )
    .map((file) => file.fileName);
}
