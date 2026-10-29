import type { SessionDatabase } from '../../persistence/database';
import {
  forgetPhotoFile,
  isPhotoFileReferenced,
  listAbandonedPhotoFiles,
  recordPhotoFile,
} from '../../persistence/photoFileJournal';
import { setDraftPhoto } from '../../persistence/roundRepository';
import { newId, nowUtcIso } from '../../services/deviceContext';
import type { PhotoStore } from '../../services/photoStorage';
import {
  abandonedCutoffUtc,
  type DeleteOutcome,
  deleteUnreferencedPhotos,
  type SavePhotoDeps,
} from './roundPhotos';

// The one place that connects the photo workflow to this database and its own photo folder.
// Screens use these instead of deleting files themselves.

export function discardPhotos(
  db: SessionDatabase,
  photos: PhotoStore,
  fileNames: readonly string[],
  reportError: (error: unknown) => void,
): Promise<DeleteOutcome> {
  return deleteUnreferencedPhotos(fileNames, {
    isReferenced: (fileName) => isPhotoFileReferenced(db, fileName),
    deleteFile: photos.delete,
    forget: (fileName) => forgetPhotoFile(db, fileName),
    reportError,
  });
}

// expectedRevision: the draft revision the user's choice was based on (see setDraftPhoto).
export function photoSaveDeps(
  db: SessionDatabase,
  photos: PhotoStore,
  roundId: string,
  expectedRevision: number | null,
  reportError: (error: unknown) => void,
): SavePhotoDeps {
  return {
    recordFile: (fileName) => recordPhotoFile(db, fileName, nowUtcIso()),
    copyOriginal: photos.copyOriginal,
    createNormalized: photos.createNormalized,
    saveRow: (photo) => setDraftPhoto(db, roundId, photo, expectedRevision),
    discardFiles: async (fileNames) => {
      await discardPhotos(db, photos, fileNames, reportError);
    },
    newId,
    now: nowUtcIso,
  };
}

// Removes recorded copies that no row refers to and that are old enough not to belong to a
// save in progress. Files the journal does not list are never touched.
export async function cleanAbandonedPhotos(
  db: SessionDatabase,
  photos: PhotoStore,
  nowMs: number,
  reportError: (error: unknown) => void,
): Promise<DeleteOutcome> {
  const candidates = await listAbandonedPhotoFiles(db, abandonedCutoffUtc(nowMs));
  return discardPhotos(db, photos, candidates, reportError);
}
