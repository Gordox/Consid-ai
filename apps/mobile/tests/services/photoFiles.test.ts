import { isPhotoFileName, photoFileName } from '../../src/services/photoFiles';

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
