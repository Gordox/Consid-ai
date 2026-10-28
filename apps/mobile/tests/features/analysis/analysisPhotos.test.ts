import type { RoundPhoto } from '../../../src/domain/round/round';
import { uploadablePhoto } from '../../../src/features/analysis/analysisPhotos';

const PHOTO: RoundPhoto = {
  role: 'after',
  fileName: 'normalised.jpg',
  originalFileName: 'original-with-location.jpg',
  width: 3024,
  height: 4032,
  addedAtUtc: 't',
};

describe('uploadablePhoto', () => {
  it('uploads the normalised copy and never the original', () => {
    const upload = uploadablePhoto(PHOTO, (name) => `file:///photos/${name}`);
    expect(upload).toEqual({
      uri: 'file:///photos/normalised.jpg',
      fileName: 'normalised.jpg',
      width: 3024,
      height: 4032,
    });
    expect(JSON.stringify(upload)).not.toContain('original-with-location');
  });

  it('uploads nothing for a photo saved before normalisation', () => {
    expect(uploadablePhoto({ ...PHOTO, originalFileName: null }, (name) => name)).toBeNull();
  });
});
