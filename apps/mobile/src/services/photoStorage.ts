import { Directory, File, Paths } from 'expo-file-system';

import { isPhotoFileName, photoFileName } from './photoFiles';

// Copies picked photos into the app's document folder, which the system does not clear.
// The originals in the phone's library are never modified or deleted.

function photosDirectory(): Directory {
  return new Directory(Paths.document, 'photos');
}

function photoFile(fileName: string): File {
  if (!isPhotoFileName(fileName)) {
    throw new RangeError('Not an app photo file name');
  }
  return new File(photosDirectory(), fileName);
}

export async function copyPhotoIntoApp(sourceUri: string, id: string): Promise<string> {
  const fileName = photoFileName(id, sourceUri);
  photosDirectory().create({ intermediates: true, idempotent: true });
  await new File(sourceUri).copy(photoFile(fileName));
  return fileName;
}

export function photoUri(fileName: string): string {
  return photoFile(fileName).uri;
}

export function photoExists(fileName: string): boolean {
  return isPhotoFileName(fileName) && photoFile(fileName).exists;
}

// Deletes an app copy that no row refers to any more. A missing file is already gone.
export function deleteAppPhoto(fileName: string): void {
  const file = photoFile(fileName);
  if (file.exists) {
    file.delete();
  }
}
