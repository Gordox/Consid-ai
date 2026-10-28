import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { isPhotoFileName, photoFileName } from './photoFiles';

// Copies picked photos into a folder in the app's document directory, which the system does
// not clear. Each database has its own folder, so cleaning up one database's unused copies can
// never touch photos another database refers to. The originals in the phone's library are never
// modified or deleted.

// Long side of the normalised photo. The S20's 12 MP photos (4032 px) keep their full size;
// larger ones are scaled down so the upload stays below the 15 MB analysis limit.
export const NORMALIZED_MAX_SIDE_PX = 4096;
// High JPEG quality keeps hole edges sharp; 1.0 would roughly double the size for no visible gain.
const NORMALIZED_JPEG_QUALITY = 0.95;

export type NormalizedPhoto = {
  readonly fileName: string;
  readonly width: number;
  readonly height: number;
};

export type StoredPhotoFile = {
  readonly fileName: string;
  // Milliseconds since the epoch, or null when the system cannot tell.
  readonly modifiedAtMs: number | null;
};

export type PhotoStore = {
  // Copies the picked file unchanged and returns its generated name.
  copyOriginal(sourceUri: string, id: string): Promise<string>;
  // Writes an upright JPEG without metadata (orientation applied, location removed) from a copy
  // in this store. Its size is the coordinate system for marks and analysis.
  createNormalized(originalFileName: string, id: string): Promise<NormalizedPhoto>;
  uri(fileName: string): string;
  exists(fileName: string): boolean;
  // Size in bytes, or null when the copy is missing or cannot be read.
  size(fileName: string): number | null;
  // Deletes a copy that no row refers to any more. A missing file is already gone.
  delete(fileName: string): void;
  // Files in this store's folder with generated names; anything else is ignored.
  list(): StoredPhotoFile[];
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
    async copyOriginal(sourceUri, id) {
      const fileName = photoFileName(id, sourceUri);
      folder().create({ intermediates: true, idempotent: true });
      await new File(sourceUri).copy(fileFor(fileName));
      return fileName;
    },

    async createNormalized(originalFileName, id) {
      const fileName = photoFileName(id, 'normalized.jpg');
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
          return { fileName, width: saved.width, height: saved.height };
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

    list() {
      const directory = folder();
      if (!directory.exists) return [];
      const files: StoredPhotoFile[] = [];
      for (const entry of directory.list()) {
        if (entry instanceof File && isPhotoFileName(entry.name)) {
          files.push({ fileName: entry.name, modifiedAtMs: entry.modificationTime });
        }
      }
      return files;
    },
  };
}
