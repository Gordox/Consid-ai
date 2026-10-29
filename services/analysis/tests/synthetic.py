"""Synthetic target photos for tests. They show that the pipeline behaves as designed on
controlled images; they do not show that it works on real photos (docs/evaluation.md).

The sheet resembles the owner's ten-ring target (rings 1-10, black area for 7-10, numbers on the
axes) with arbitrary pixel dimensions. Old holes are covered by stickers matching the background,
with visible edges. Each photo is the sheet seen through its own perspective, lighting, noise and
JPEG compression.
"""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from app.imaging.opencv import cv2

SHEET_PX = 2000
OUTER_RADIUS_PX = 900.0
BLACK_RADIUS_PX = OUTER_RADIUS_PX * 0.4
PAPER = 232.0
BLACK = 22.0
PHOTO_SIZE = (3024, 4032)  # width, height: an upright S20 photo

Point = tuple[float, float]


@dataclass(frozen=True)
class Hole:
    x: float  # sheet pixels, origin top left
    y: float
    radius: float


@dataclass(frozen=True)
class SyntheticPhoto:
    jpeg: bytes
    sheet_to_photo: NDArray[np.float64]
    width: int
    height: int

    def to_photo(self, points: list[Point]) -> list[Point]:
        if not points:
            return []
        array = np.array(points, dtype=np.float64).reshape(-1, 1, 2)
        projected = cv2.perspectiveTransform(array, self.sheet_to_photo).reshape(-1, 2)
        return [(float(x), float(y)) for x, y in projected]

    def calibration_taps(self, rng: np.random.Generator, jitter_px: float = 3.0) -> list[Point]:
        centre = SHEET_PX / 2
        r = OUTER_RADIUS_PX
        taps = self.to_photo(
            [(centre, centre - r), (centre + r, centre), (centre, centre + r), (centre - r, centre)]
        )
        return [(x + rng.normal(0, jitter_px), y + rng.normal(0, jitter_px)) for x, y in taps]


def _on_black(x: float, y: float) -> bool:
    return math.hypot(x - SHEET_PX / 2, y - SHEET_PX / 2) < BLACK_RADIUS_PX


def draw_sheet() -> NDArray[np.float32]:
    # Drawn in 8 bits because OpenCV draws text only on 8-bit images.
    sheet = np.full((SHEET_PX, SHEET_PX), round(PAPER), dtype=np.uint8)
    centre = (SHEET_PX // 2, SHEET_PX // 2)
    cv2.circle(sheet, centre, int(BLACK_RADIUS_PX), round(BLACK), -1, lineType=cv2.LINE_AA)
    for value in range(1, 11):
        radius = int(OUTER_RADIUS_PX * (11 - value) / 10)
        colour = 200 if radius < BLACK_RADIUS_PX else 40
        cv2.circle(sheet, centre, radius, colour, 2, lineType=cv2.LINE_AA)
    for value in range(1, 10):
        middle = OUTER_RADIUS_PX * (11 - value - 0.5) / 10
        colour = 220 if middle < BLACK_RADIUS_PX else 30
        for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
            x = int(centre[0] + dx * middle - 12)
            y = int(centre[1] + dy * middle + 14)
            cv2.putText(sheet, str(value), (x, y), cv2.FONT_HERSHEY_SIMPLEX, 1.2, colour, 3)
    return sheet.astype(np.float32)


def punch(sheet: NDArray[np.float32], hole: Hole, rng: np.random.Generator) -> None:
    """A torn hole: dark backing on paper, lighter backing on the black area, ragged edge."""
    colour = 150.0 if _on_black(hole.x, hole.y) else 55.0
    cv2.circle(sheet, (round(hole.x), round(hole.y)), round(hole.radius), colour, -1, cv2.LINE_AA)
    for _ in range(6):
        angle = rng.uniform(0, 2 * math.pi)
        x = hole.x + math.cos(angle) * hole.radius
        y = hole.y + math.sin(angle) * hole.radius
        cv2.circle(sheet, (round(x), round(y)), max(1, round(hole.radius * 0.25)), colour, -1)


def cover(sheet: NDArray[np.float32], hole: Hole) -> None:
    """A sticker matching the background, slightly off in tone and with a visible edge."""
    on_black = _on_black(hole.x, hole.y)
    fill = BLACK + 10.0 if on_black else PAPER + 10.0
    edge = BLACK + 25.0 if on_black else PAPER - 25.0
    radius = round(hole.radius * 1.8)
    centre = (round(hole.x), round(hole.y))
    cv2.circle(sheet, centre, radius, fill, -1, cv2.LINE_AA)
    cv2.circle(sheet, centre, radius, edge, 1, cv2.LINE_AA)


def random_holes(
    rng: np.random.Generator, count: int, radius: float, avoid: list[Hole] | None = None
) -> list[Hole]:
    holes: list[Hole] = []
    others = list(avoid or [])
    while len(holes) < count:
        distance = OUTER_RADIUS_PX * math.sqrt(rng.uniform(0.0, 0.9))
        angle = rng.uniform(0, 2 * math.pi)
        x = SHEET_PX / 2 + distance * math.cos(angle)
        y = SHEET_PX / 2 + distance * math.sin(angle)
        # Keep test holes off the number columns and away from each other; overlap is tested
        # explicitly elsewhere.
        if min(abs(x - SHEET_PX / 2), abs(y - SHEET_PX / 2)) < 30:
            continue
        if any(math.hypot(x - o.x, y - o.y) < radius * 5 for o in [*others, *holes]):
            continue
        holes.append(Hole(x=x, y=y, radius=radius))
    return holes


def photograph(
    sheet: NDArray[np.float32],
    rng: np.random.Generator,
    tilt: float = 0.06,
    lighting: float = 0.25,
    blur_sigma: float = 0.8,
) -> SyntheticPhoto:
    width, height = PHOTO_SIZE
    margin_x, margin_y = 0.12 * width, 0.5 * (height - (width - 0.24 * width))
    target = np.array(
        [
            [margin_x, margin_y],
            [width - margin_x, margin_y],
            [width - margin_x, height - margin_y],
            [margin_x, height - margin_y],
        ],
        dtype=np.float64,
    )
    target += rng.normal(0, tilt * width * 0.5, size=(4, 2))
    source = np.array([[0, 0], [SHEET_PX, 0], [SHEET_PX, SHEET_PX], [0, SHEET_PX]], np.float64)
    matrix = cv2.getPerspectiveTransform(source.astype(np.float32), target.astype(np.float32))
    wall = np.full((height, width), 110.0, dtype=np.float32)
    warped = cv2.warpPerspective(
        sheet, matrix, (width, height), flags=cv2.INTER_LINEAR, borderValue=-1.0
    )
    image = np.where(warped >= 0, warped, wall)
    ys, xs = np.mgrid[0:height, 0:width].astype(np.float32)
    direction = rng.uniform(0, 2 * math.pi)
    ramp = (np.cos(direction) * xs / width + np.sin(direction) * ys / height).astype(np.float32)
    image = image * (1.0 - lighting / 2 + lighting * (ramp - ramp.min()) / np.ptp(ramp))
    image = cv2.GaussianBlur(image, (0, 0), blur_sigma)
    image = image + rng.normal(0, 3.0, size=image.shape).astype(np.float32)
    bgr = cv2.cvtColor(np.clip(image, 0, 255).astype(np.uint8), cv2.COLOR_GRAY2BGR)
    ok, encoded = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, 92])
    assert ok
    return SyntheticPhoto(
        jpeg=encoded.tobytes(),
        sheet_to_photo=matrix.astype(np.float64),
        width=width,
        height=height,
    )


@dataclass(frozen=True)
class SyntheticRound:
    before: SyntheticPhoto
    after: SyntheticPhoto
    new_holes_in_after: list[Point]
    hole_radius_in_after: float


def make_round(
    seed: int,
    new_holes: int = 5,
    old_holes: int = 6,
    hole_radius: float = 16.0,
    extra_new: list[Hole] | None = None,
) -> SyntheticRound:
    rng = np.random.default_rng(seed)
    sheet = draw_sheet()
    old = random_holes(rng, old_holes, hole_radius)
    for hole in old:
        punch(sheet, hole, rng)
        cover(sheet, hole)
    new = random_holes(rng, new_holes, hole_radius, avoid=old)
    new.extend(extra_new or [])
    before = photograph(sheet, rng)
    for hole in new:
        punch(sheet, hole, rng)
    after = photograph(sheet, rng)
    scale = float(np.sqrt(abs(np.linalg.det(after.sheet_to_photo[:2, :2]))))
    return SyntheticRound(
        before=before,
        after=after,
        new_holes_in_after=after.to_photo([(h.x, h.y) for h in new]),
        hole_radius_in_after=hole_radius * scale,
    )


def match(found: list[Point], truth: list[Point], tolerance: float) -> tuple[int, int, int]:
    """Greedy one-to-one matching: (true positives, false positives, false negatives)."""
    remaining = list(truth)
    true_positives = 0
    for x, y in found:
        nearest = min(remaining, key=lambda t: math.hypot(t[0] - x, t[1] - y), default=None)
        if nearest is not None and math.hypot(nearest[0] - x, nearest[1] - y) <= tolerance:
            remaining.remove(nearest)
            true_positives += 1
    return true_positives, len(found) - true_positives, len(remaining)
