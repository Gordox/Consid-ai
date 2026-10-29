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

// The decoded path segments of a file:// URI, or null for anything else or for a path that
// could leave its directory ('.', '..', encoded separators). Compared segment by segment, so
// '/cache-old/x' is never taken to be inside '/cache'.
function fileSegments(uri: string): string[] | null {
  const prefix = 'file://';
  if (!uri.startsWith(prefix) || uri.includes('?') || uri.includes('#')) return null;
  const segments: string[] = [];
  for (const raw of uri.slice(prefix.length).split('/')) {
    if (raw === '') continue;
    let segment: string;
    try {
      segment = decodeURIComponent(raw);
    } catch {
      return null;
    }
    if (segment === '.' || segment === '..' || /[/\\\0]/.test(segment)) return null;
    segments.push(segment);
  }
  return segments;
}

export function isInsideDirectory(fileUri: string, directoryUri: string): boolean {
  const file = fileSegments(fileUri);
  const directory = fileSegments(directoryUri);
  if (file === null || directory === null || file.length <= directory.length) return false;
  return directory.every((segment, index) => file[index] === segment);
}

// Whether a camera result may be deleted after it was copied: it must be in the app's cache and
// in none of the folders whose files the app keeps (its photo folder). Library photos are never
// passed here, so the user's originals can never be deleted.
export function isDeletableCameraTemporary(
  uri: string,
  cacheDirectoryUri: string,
  keptDirectoryUris: readonly string[],
): boolean {
  return (
    isInsideDirectory(uri, cacheDirectoryUri) &&
    keptDirectoryUris.every((kept) => !isInsideDirectory(uri, kept))
  );
}
