"""Builds JPEGs with an EXIF orientation tag, as phone cameras write them."""

import struct

import numpy as np
from numpy.typing import NDArray

from app.imaging.opencv import cv2


def jpeg_with_orientation(pixels: NDArray[np.uint8], orientation: int) -> bytes:
    ok, encoded = cv2.imencode(".jpg", pixels)
    assert ok
    data = encoded.tobytes()
    ifd = struct.pack(">H", 1) + struct.pack(">HHIHH", 0x0112, 3, 1, orientation, 0)
    tiff = b"MM\x00\x2a\x00\x00\x00\x08" + ifd + struct.pack(">I", 0)
    app1 = b"Exif\x00\x00" + tiff
    segment = b"\xff\xe1" + struct.pack(">H", len(app1) + 2) + app1
    return data[:2] + segment + data[2:]
