import {
  isDeletableCameraTemporary,
  isInsideDirectory,
  isPhotoFileName,
  photoFileName,
} from '../../src/services/photoFiles';

const ID = 'ABCDEF12-3456-4789-8abc-def012345678';

describe('photoFileName', () => {
  it('keeps a known extension and lowercases the id', () => {
    expect(photoFileName(ID, 'file:///cache/ImagePicker/x.PNG')).toBe(`${ID.toLowerCase()}.png`);
    expect(photoFileName(ID, 'file:///cache/a.jpeg?size=2')).toBe(`${ID.toLowerCase()}.jpeg`);
  });

  it('falls back to jpg for unknown or missing extensions', () => {
    expect(photoFileName(ID, 'content://media/external/images/media/42')).toBe(
      `${ID.toLowerCase()}.jpg`,
    );
    expect(photoFileName(ID, 'file:///a/b.exe')).toBe(`${ID.toLowerCase()}.jpg`);
  });

  it('refuses ids that could form a path', () => {
    expect(() => photoFileName('../../etc/passwd', 'x.jpg')).toThrow(RangeError);
  });
});

describe('isPhotoFileName', () => {
  it('accepts only generated names', () => {
    expect(isPhotoFileName(`${ID.toLowerCase()}.jpg`)).toBe(true);
    expect(isPhotoFileName('photo.jpg')).toBe(false);
    expect(isPhotoFileName(`../${ID.toLowerCase()}.jpg`)).toBe(false);
    expect(isPhotoFileName(`${ID.toLowerCase()}.jpg/..`)).toBe(false);
  });
});

describe('isInsideDirectory', () => {
  const cache = 'file:///data/user/0/app/cache';
  it('accepts a file below the directory and compares whole segments', () => {
    expect(isInsideDirectory(`${cache}/Camera/a.jpg`, cache)).toBe(true);
    expect(isInsideDirectory(`${cache}/a.jpg`, `${cache}/`)).toBe(true);
    expect(isInsideDirectory('file:///data/user/0/app/cache-old/a.jpg', cache)).toBe(false);
    expect(isInsideDirectory(cache, cache)).toBe(false);
  });

  it('refuses paths that could leave the directory or are not file URIs', () => {
    expect(isInsideDirectory(`${cache}/../files/photos/a.jpg`, cache)).toBe(false);
    expect(isInsideDirectory(`${cache}/%2e%2e/files/a.jpg`, cache)).toBe(false);
    expect(isInsideDirectory(`${cache}/a%2Fb.jpg`, cache)).toBe(false);
    expect(isInsideDirectory(`${cache}/a.jpg?x=1`, cache)).toBe(false);
    expect(isInsideDirectory('content://media/external/images/1', cache)).toBe(false);
    expect(isInsideDirectory(`${cache}/%E0%A4%A.jpg`, cache)).toBe(false);
  });
});

describe('isDeletableCameraTemporary', () => {
  const cache = 'file:///data/user/0/app/cache';
  const photos = 'file:///data/user/0/app/files/photos';
  it('allows only the cache, never the photo folder or anything else', () => {
    expect(isDeletableCameraTemporary(`${cache}/Camera/x.jpg`, cache, [photos])).toBe(true);
    expect(isDeletableCameraTemporary(`${photos}/x.jpg`, cache, [photos])).toBe(false);
    expect(isDeletableCameraTemporary(`${cache}/photos/x.jpg`, cache, [`${cache}/photos`])).toBe(
      false,
    );
    expect(isDeletableCameraTemporary('file:///storage/DCIM/x.jpg', cache, [photos])).toBe(false);
  });
});
