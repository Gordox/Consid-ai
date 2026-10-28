import numpy as np
import pytest

from app.imaging.decode import (
    ImageFormat,
    UnsupportedFormatError,
    UnusableImageError,
    decode_photo,
    sniff_format,
)
from app.imaging.opencv import cv2
from tests.exif import jpeg_with_orientation


def landscape(width: int = 1200, height: int = 800) -> np.ndarray:
    pixels = np.zeros((height, width, 3), dtype=np.uint8)
    pixels[:, : width // 4] = 255  # bright band on the left edge
    return pixels


def test_format_comes_from_content_not_name() -> None:
    ok, png = cv2.imencode(".png", landscape())
    assert ok
    assert sniff_format(png.tobytes()) is ImageFormat.PNG
    with pytest.raises(UnsupportedFormatError):
        sniff_format(b"\x00\x00\x00\x18ftypheic" + b"\x00" * 100)  # HEIC
    with pytest.raises(UnsupportedFormatError):
        sniff_format(b"GIF89a")


def test_exif_orientation_is_applied() -> None:
    # Orientation 6: stored landscape, shown rotated 90 degrees clockwise (portrait).
    decoded = decode_photo(jpeg_with_orientation(landscape(), 6))
    assert (decoded.width, decoded.height) == (800, 1200)
    # The bright left band of the stored pixels is now the top rows.
    assert decoded.pixels[:100, :, 0].mean() > 200
    assert decoded.pixels[-100:, :, 0].mean() < 50


def test_upright_jpeg_keeps_its_size() -> None:
    decoded = decode_photo(jpeg_with_orientation(landscape(), 1))
    assert (decoded.width, decoded.height) == (1200, 800)


def test_too_small_and_corrupt_images_are_unusable() -> None:
    ok, small = cv2.imencode(".jpg", landscape(400, 300))
    assert ok
    with pytest.raises(UnusableImageError) as small_error:
        decode_photo(small.tobytes())
    assert small_error.value.reason == "tooSmall"
    with pytest.raises(UnusableImageError) as corrupt_error:
        decode_photo(b"\xff\xd8\xff\xe0" + b"\x00" * 64)
    assert corrupt_error.value.reason == "undecodable"


def test_png_with_huge_declared_size_is_rejected_before_decoding() -> None:
    header = b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\x0dIHDR" + (20000).to_bytes(4, "big") * 2
    with pytest.raises(UnusableImageError) as error:
        decode_photo(header + b"\x00" * 64)
    assert error.value.reason == "tooManyPixels"
