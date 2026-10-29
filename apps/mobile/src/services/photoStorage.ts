import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { isDeletableCameraTemporary, isPhotoFileName } from './photoFiles';

// Copies picked photos into a folder in the app's document directory, which the system does
// not clear. This module only reads and writes files; which
// files may be deleted is decided from the database (roundPhotos.ts). The originals in the
// phone's library are never modified or deleted.

// Long side of the normalised photo. The S20's 12 MP photos (4032 px) keep their full size;
// larger ones are scaled down so the upload stays below the 15 MB analysis limit.
export const NORMALIZED_MAX_SIDE_PX = 4096;
// High JPEG quality keeps hole edges sharp; 1.0 would roughly double the size for no visible gain.
const NORMALIZED_JPEG_QUALITY = 0.95;

// The folder of the app's database. Earlier development builds also wrote 'photos-ui-check' for a
// test database; that folder is left as it is and never opened.
export const PHOTO_FOLDER = 'photos';

export type PhotoStore = {
  // Copies the picked file unchanged under the given generated name. The copy keeps the photo's
  // metadata, including any location, and is never uploaded.
  copyOriginal(sourceUri: string, fileName: string): Promise<void>;
  // Writes an upright JPEG without metadata (orientation applied, location removed) from a copy
  // in this store. Its size is the coordinate system for marks and analysis, and it is the only
  // copy that is ever sent to the analysis service.
  createNormalized(
    originalFileName: string,
    fileName: string,
  ): Promise<{ readonly width: number; readonly height: number }>;
  uri(fileName: string): string;
  exists(fileName: string): boolean;
  // Size in bytes, or null when the copy is missing or cannot be read.
  size(fileName: string): number | null;
  // Deletes a copy. Callers check first that no row refers to it. A missing file is already
  // gone.
  delete(fileName: string): void;
  // Reads the first bytes of a copy, for checking the normalised file before upload.
  readHead(fileName: string, length: number): Uint8Array;
  // A copy as a Blob for an upload; its bytes are read only when the request is sent.
  uploadFile(fileName: string): Blob;
  // Deletes the file the in-app camera wrote, once its copies are saved or the save definitely
  // failed. Only a file in the app's cache outside the photo folder is deleted; returns whether
  // it was.
  deleteCameraTemporary(uri: string): boolean;
};

export function createPhotoStore(folderName: string): PhotoStore {
  const folder = () => new Directory(Paths.document, folderName);
  const fileFor = (fileName: string): File => {
    if (!isPhotoFileName(fileName)) {
      throw new RangeError('Not an app photo file name');
    }
    return new File(folder(), fileName);
  };

  return {
    async copyOriginal(sourceUri, fileName) {
      folder().create({ intermediates: true, idempotent: true });
      await new File(sourceUri).copy(fileFor(fileName));
    },

    async createNormalized(originalFileName, fileName) {
      // The image loader (Glide on Android) applies the EXIF orientation while decoding, and the
      // saved JPEG carries no EXIF, so what every viewer shows is exactly what is stored.
      const context = ImageManipulator.manipulate(fileFor(originalFileName).uri, {
        maxWidth: NORMALIZED_MAX_SIDE_PX,
        maxHeight: NORMALIZED_MAX_SIDE_PX,
      });
      try {
        const image = await context.renderAsync();
        try {
          const saved = await image.saveAsync({
            compress: NORMALIZED_JPEG_QUALITY,
            format: SaveFormat.JPEG,
          });
          const temporary = new File(saved.uri);
          try {
            await temporary.copy(fileFor(fileName));
          } finally {
            if (temporary.exists) temporary.delete();
          }
          return { width: saved.width, height: saved.height };
        } finally {
          image.release();
        }
      } finally {
        context.release();
      }
    },

    uri: (fileName) => fileFor(fileName).uri,

    exists: (fileName) => isPhotoFileName(fileName) && fileFor(fileName).exists,

    size(fileName) {
      if (!isPhotoFileName(fileName)) return null;
      const file = fileFor(fileName);
      return file.exists ? file.size : null;
    },

    delete(fileName) {
      const file = fileFor(fileName);
      if (file.exists) {
        file.delete();
      }
    },

    deleteCameraTemporary(uri) {
      if (!isDeletableCameraTemporary(uri, Paths.cache.uri, [folder().uri])) return false;
      const file = new File(uri);
      if (file.exists) file.delete();
      return true;
    },

    readHead(fileName, length) {
      const handle = fileFor(fileName).open();
      try {
        return handle.readBytesSync(length);
      } finally {
        handle.close();
      }
    },

    uploadFile: (fileName) => fileFor(fileName),
  };
}
