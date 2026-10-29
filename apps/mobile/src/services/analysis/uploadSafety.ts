// Checks the bytes of a photo before it is uploaded. It must be a JPEG without location data and
// without an orientation still to apply. The normalised copy is written that way (Android writes
// no EXIF at all; iOS may write a small EXIF block without location), so a failure means the
// wrong file or a changed manipulator, and nothing is sent.

export type UploadCheck = 'ok' | 'notJpeg' | 'location' | 'rotated' | 'unreadable';

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
const XMP_HEADER = 'http://ns.adobe.com/xap/1.0/';
const TAG_ORIENTATION = 0x0112;
const TAG_GPS_INFO = 0x8825;

function startsWith(bytes: Uint8Array, offset: number, expected: readonly number[]): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

// Reads the first image directory of an EXIF (TIFF) block.
function checkExif(tiff: Uint8Array): UploadCheck {
  if (tiff.length < 8) return 'unreadable';
  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  const big = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!little && !big) return 'unreadable';
  const u16 = (at: number) =>
    little
      ? (tiff[at] ?? 0) | ((tiff[at + 1] ?? 0) << 8)
      : ((tiff[at] ?? 0) << 8) | (tiff[at + 1] ?? 0);
  const u32 = (at: number) =>
    little ? u16(at) + u16(at + 2) * 0x10000 : u16(at) * 0x10000 + u16(at + 2);
  const directory = u32(4);
  if (directory + 2 > tiff.length) return 'unreadable';
  const entries = u16(directory);
  if (directory + 2 + entries * 12 > tiff.length) return 'unreadable';
  for (let index = 0; index < entries; index += 1) {
    const entry = directory + 2 + index * 12;
    const tag = u16(entry);
    if (tag === TAG_GPS_INFO) return 'location';
    if (tag === TAG_ORIENTATION && u16(entry + 8) !== 1) return 'rotated';
  }
  return 'ok';
}

// Scans the segments before the image data. Only the head of the file is needed: metadata
// segments always come before the start of scan (0xFFDA).
export function checkJpegForUpload(head: Uint8Array): UploadCheck {
  if (head.length < 4 || head[0] !== 0xff || head[1] !== 0xd8) {
    return 'notJpeg';
  }
  const xmp = Array.from(XMP_HEADER, (character) => character.charCodeAt(0));
  let offset = 2;
  while (offset + 4 <= head.length) {
    if (head[offset] !== 0xff) {
      return 'unreadable';
    }
    const marker = head[offset + 1] ?? 0;
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0xda) {
      return 'ok';
    }
    const length = ((head[offset + 2] ?? 0) << 8) | (head[offset + 3] ?? 0);
    const body = offset + 4;
    const end = offset + 2 + length;
    if (length < 2 || end > head.length) {
      return 'unreadable';
    }
    if (marker === 0xe1 && startsWith(head, body, EXIF_HEADER)) {
      const result = checkExif(head.subarray(body + EXIF_HEADER.length, end));
      if (result !== 'ok') return result;
    }
    if (marker === 0xe1 && startsWith(head, body, xmp)) {
      const text = String.fromCharCode(...head.subarray(body, end));
      if (text.includes('GPS')) return 'location';
    }
    offset = end;
  }
  // The start of scan was not within the head that was read.
  return 'unreadable';
}
