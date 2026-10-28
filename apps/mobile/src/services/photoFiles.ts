// Names for photo copies in the app's own folder. Only names made here are ever opened or
// deleted, so a stored value can never point outside that folder.

const EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'webp'] as const;
const PHOTO_FILE_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|heic|webp)$/;

// Keeps a known image extension from the picker's file, otherwise jpg.
export function photoFileName(id: string, sourceUri: string): string {
  const match = /\.([A-Za-z0-9]{1,5})(?:[?#].*)?$/.exec(sourceUri);
  const extension = match?.[1]?.toLowerCase();
  const known = EXTENSIONS.find((candidate) => candidate === extension) ?? 'jpg';
  const name = `${id.toLowerCase()}.${known}`;
  if (!isPhotoFileName(name)) {
    throw new RangeError('Photo id must be a UUID');
  }
  return name;
}

export function isPhotoFileName(name: string): boolean {
  return PHOTO_FILE_NAME.test(name);
}
