import { checkJpegForUpload } from '../../../src/services/analysis/uploadSafety';

const SOI = [0xff, 0xd8];
const SOS = [0xff, 0xda, 0x00, 0x08];

function segment(marker: number, body: number[]): number[] {
  const length = body.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...body];
}

const ascii = (text: string) => Array.from(text, (character) => character.charCodeAt(0));
const JFIF = segment(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const QUANT = segment(0xdb, new Array(65).fill(1));

// A big-endian EXIF block whose first directory holds the given (tag, short value) entries.
function exif(entries: [number, number][]): number[] {
  const tiff = [...ascii('MM'), 0, 42, 0, 0, 0, 8, 0, entries.length];
  for (const [tag, value] of entries) {
    tiff.push(tag >> 8, tag & 0xff, 0, 3, 0, 0, 0, 1, value >> 8, value & 0xff, 0, 0);
  }
  tiff.push(0, 0, 0, 0);
  return segment(0xe1, [...ascii('Exif'), 0, 0, ...tiff]);
}

const jpeg = (...segments: number[][]) => new Uint8Array([...SOI, ...segments.flat(), ...SOS]);

describe('checkJpegForUpload', () => {
  it('accepts a JPEG without metadata, as Android writes the normalised copy', () => {
    expect(checkJpegForUpload(jpeg(JFIF, QUANT))).toBe('ok');
  });

  it('accepts EXIF without location and with upright orientation, as iOS may write it', () => {
    expect(
      checkJpegForUpload(
        jpeg(
          JFIF,
          exif([
            [0x0112, 1],
            [0xa001, 1],
          ]),
        ),
      ),
    ).toBe('ok');
  });

  it('refuses EXIF with a GPS directory', () => {
    expect(
      checkJpegForUpload(
        jpeg(
          exif([
            [0x0112, 1],
            [0x8825, 26],
          ]),
        ),
      ),
    ).toBe('location');
  });

  it('refuses an orientation that would still have to be applied', () => {
    expect(checkJpegForUpload(jpeg(exif([[0x0112, 6]])))).toBe('rotated');
  });

  it('refuses XMP with GPS fields', () => {
    const xmp = segment(0xe1, [
      ...ascii('http://ns.adobe.com/xap/1.0/'),
      0,
      ...ascii('<exif:GPSLatitude>'),
    ]);
    expect(checkJpegForUpload(jpeg(xmp))).toBe('location');
  });

  it('refuses other formats and heads that end before the image data', () => {
    expect(checkJpegForUpload(new Uint8Array(ascii('\x89PNG')))).toBe('notJpeg');
    expect(checkJpegForUpload(new Uint8Array([...SOI, ...QUANT]))).toBe('unreadable');
    expect(checkJpegForUpload(new Uint8Array([...SOI, 0x12, 0x34, 0, 0]))).toBe('unreadable');
  });
});
