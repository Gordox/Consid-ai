"""Calibration geometry in after-photo pixels.

The app's calibration taps are where the outer scoring ring crosses the vertical and horizontal
axes, in the order top, right, bottom, left. They map to the unit circle, so the service needs no
millimetre dimensions: positions are expressed in multiples of the outer ring radius.
"""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from app.imaging.opencv import cv2

Matrix = NDArray[np.float64]
Mask = NDArray[np.uint8]

UNIT_CALIBRATION = np.array([[0.0, -1.0], [1.0, 0.0], [0.0, 1.0], [-1.0, 0.0]], dtype=np.float64)


class InvalidCalibrationError(Exception):
    pass


@dataclass(frozen=True)
class Calibration:
    # Photo pixels to the unit-circle target frame, and back.
    photo_to_unit: Matrix
    unit_to_photo: Matrix
    # Mean distance from the projected centre to the four taps: the outer ring radius in pixels.
    outer_radius_px: float


def _is_convex(points: NDArray[np.float64]) -> bool:
    signs = []
    for index in range(4):
        a, b, c = points[index], points[(index + 1) % 4], points[(index + 2) % 4]
        cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
        signs.append(cross)
    return all(value > 0 for value in signs) or all(value < 0 for value in signs)


def _determinant(m: Matrix) -> float:
    # Written out for 3x3: numpy's LAPACK path raised spurious overflow warnings on macOS.
    return float(
        m[0, 0] * (m[1, 1] * m[2, 2] - m[1, 2] * m[2, 1])
        - m[0, 1] * (m[1, 0] * m[2, 2] - m[1, 2] * m[2, 0])
        + m[0, 2] * (m[1, 0] * m[2, 1] - m[1, 1] * m[2, 0])
    )


def build_calibration(points: list[tuple[float, float]], width: int, height: int) -> Calibration:
    taps = np.array(points, dtype=np.float64)
    if taps.shape != (4, 2) or not np.all(np.isfinite(taps)):
        raise InvalidCalibrationError("needs four finite points")
    if np.any(taps[:, 0] < 0) or np.any(taps[:, 0] > width):
        raise InvalidCalibrationError("point outside the photo")
    if np.any(taps[:, 1] < 0) or np.any(taps[:, 1] > height):
        raise InvalidCalibrationError("point outside the photo")
    if not _is_convex(taps):
        raise InvalidCalibrationError("points do not form a convex outline")
    estimated = cv2.getPerspectiveTransform(
        taps.astype(np.float32), UNIT_CALIBRATION.astype(np.float32)
    )
    forward = np.asarray(estimated, dtype=np.float64)
    if not np.all(np.isfinite(forward)) or abs(_determinant(forward)) < 1e-12:
        raise InvalidCalibrationError("degenerate outline")
    inverse = np.linalg.inv(forward)
    centre = project(inverse, np.array([[0.0, 0.0]]))[0]
    radius = float(np.mean(np.linalg.norm(taps - centre, axis=1)))
    if radius < 20:
        raise InvalidCalibrationError("outline too small")
    return Calibration(photo_to_unit=forward, unit_to_photo=inverse, outer_radius_px=radius)


def project(matrix: Matrix, points: NDArray[np.float64]) -> NDArray[np.float64]:
    homogeneous = np.hstack([points, np.ones((len(points), 1))]) @ matrix.T
    return homogeneous[:, :2] / homogeneous[:, 2:3]


def target_mask(calibration: Calibration, width: int, height: int, radius: float) -> Mask:
    """Pixels inside the circle of the given radius (1.0 = outer ring) in photo space."""
    angles = np.linspace(0, 2 * math.pi, 144, endpoint=False)
    circle = np.stack([radius * np.cos(angles), radius * np.sin(angles)], axis=1)
    polygon = project(calibration.unit_to_photo, circle)
    mask = np.zeros((height, width), dtype=np.uint8)
    cv2.fillPoly(mask, [np.round(polygon).astype(np.int32)], 255)
    return mask
