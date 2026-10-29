"""Validates and decodes uploaded photos. The file content decides the format, never the name
or the declared content type."""

import struct
from dataclasses import dataclass
from enum import StrEnum

import numpy as np
from numpy.typing import NDArray

from app.config.settings import MAX_IMAGE_PIXELS, MIN_IMAGE_SIDE_PX
from app.imaging.opencv import cv2

BgrImage = NDArray[np.uint8]


class ImageFormat(StrEnum):
    JPEG = "jpeg"
    PNG = "png"
    WEBP = "webp"


class UnsupportedFormatError(Exception):
    """The bytes are not JPEG, PNG or WebP (HEIC included: OpenCV cannot decode it)."""


class UnusableImageError(Exception):
    """A supported format that cannot be used: corrupt, too large in pixels, or too small."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class DecodedImage:
    # Orientation already applied: rows and columns are the upright photo, the same pixels the
    # app shows and stores marks in.
    pixels: BgrImage

    @property
    def width(self) -> int:
        return int(self.pixels.shape[1])

    @property
    def height(self) -> int:
        return int(self.pixels.shape[0])


def sniff_format(data: bytes) -> ImageFormat:
    if data.startswith(b"\xff\xd8\xff"):
        return ImageFormat.JPEG
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ImageFormat.PNG
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ImageFormat.WEBP
    raise UnsupportedFormatError


def _png_size(data: bytes) -> tuple[int, int] | None:
    if len(data) < 24 or data[12:16] != b"IHDR":
        return None
    width, height = struct.unpack(">II", data[16:24])
    return int(width), int(height)


_JPEG_SOF_MARKERS = frozenset({0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD})


def _jpeg_size(data: bytes) -> tuple[int, int] | None:
    index = 2
    while index + 9 < len(data):
        if data[index] != 0xFF:
            return None
        marker = data[index + 1]
        if marker == 0xFF:
            index += 1
            continue
        length = struct.unpack(">H", data[index + 2 : index + 4])[0]
        if marker in _JPEG_SOF_MARKERS:
            height, width = struct.unpack(">HH", data[index + 5 : index + 9])
            return int(width), int(height)
        index += 2 + length
    return None


def _check_header_size(data: bytes, image_format: ImageFormat) -> None:
    """Rejects decompression bombs before decoding. WebP relies on OpenCV's own pixel limit."""
    size = None
    if image_format is ImageFormat.PNG:
        size = _png_size(data)
    elif image_format is ImageFormat.JPEG:
        size = _jpeg_size(data)
    if size is not None and size[0] * size[1] > MAX_IMAGE_PIXELS:
        raise UnusableImageError("tooManyPixels")


def decode_photo(data: bytes) -> DecodedImage:
    image_format = sniff_format(data)
    _check_header_size(data, image_format)
    # IMREAD_COLOR applies the EXIF orientation, so a sideways-stored JPEG comes out upright.
    pixels = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if pixels is None:
        raise UnusableImageError("undecodable")
    decoded = DecodedImage(pixels=np.asarray(pixels, dtype=np.uint8))
    if min(decoded.width, decoded.height) < MIN_IMAGE_SIDE_PX:
        raise UnusableImageError("tooSmall")
    if decoded.width * decoded.height > MAX_IMAGE_PIXELS:
        raise UnusableImageError("tooManyPixels")
    return decoded
