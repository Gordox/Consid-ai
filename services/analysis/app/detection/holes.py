"""Finds candidate new holes. Heuristic image processing, not a trained detector: every result
is a suggestion the user checks, and the thresholds are tuned on synthetic images only.

Both modes build a response image in which hole-like pixels are bright, remove structures much
thinner than a hole (ring lines, digit strokes, sticker edges, residual misalignment), then keep
roughly round blobs of a plausible hole size.
"""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from app.imaging.opencv import cv2

Gray = NDArray[np.uint8]
FloatImage = NDArray[np.float32]
Mask = NDArray[np.uint8]

# Robust threshold: median plus this many scaled MADs of the response inside the region, but at
# least the absolute floor (grey levels), so a clean photo does not turn noise into holes.
THRESHOLD_MADS = 10.0
THRESHOLD_FLOOR = 28.0
# Blob shape limits, as the share of the smallest enclosing circle the blob fills. A disc fills
# about 0.8 after pixelisation; lines and crescents fill much less. (The perimeter-based
# circularity is too noisy for small, ragged holes.)
MIN_CIRCULARITY = 0.4
ROUND_CIRCULARITY = 0.6
# Blobs closer than this share of their summed radii are parts of one hole or of overlapping
# holes, and are merged into one uncertain suggestion.
MERGE_DISTANCE_SHARE = 0.75
# A blob this much larger than a typical single hole may be several overlapping holes.
OVERLAP_AREA_RATIO = 1.7
# Above this, the photo pair or photo is not usable for suggestions (lighting, misalignment).
MAX_CANDIDATES = 40
MAX_RESPONSE_SHARE = 0.03


@dataclass(frozen=True)
class HoleSize:
    """Expected hole diameter range in working pixels."""

    min_px: float
    max_px: float


@dataclass(frozen=True)
class Blob:
    x: float
    y: float
    diameter_px: float
    area: float
    circularity: float
    strength: float  # mean response divided by the threshold
    merged: bool = False


@dataclass(frozen=True)
class BlobSearch:
    blobs: list[Blob]
    threshold: float
    response_share: float


def disc(diameter: float) -> NDArray[np.uint8]:
    size = max(3, round(diameter) | 1)
    return np.asarray(cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (size, size)), np.uint8)


def find_blobs(response: FloatImage, region: Mask, size: HoleSize) -> BlobSearch:
    inside = region > 0
    values = response[inside]
    if values.size == 0:
        return BlobSearch(blobs=[], threshold=math.inf, response_share=0.0)
    # Remove structures thinner than about 0.7 of the smallest hole.
    opened = cv2.morphologyEx(response, cv2.MORPH_OPEN, disc(size.min_px * 0.7))
    opened[~inside] = 0
    median = float(np.median(values))
    mad = float(np.median(np.abs(values - median))) * 1.4826
    threshold = max(THRESHOLD_FLOOR, median + THRESHOLD_MADS * mad)
    binary = np.where(opened >= threshold, 255, 0).astype(np.uint8)
    response_share = float(np.mean(binary[inside] > 0))

    min_area = math.pi * (size.min_px / 2) ** 2 * 0.5
    max_area = math.pi * (size.max_px / 2) ** 2 * 3.0
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    blobs: list[Blob] = []
    for contour in contours:
        area = float(cv2.contourArea(contour))
        if area < min_area or area > max_area:
            continue
        _, enclosing_radius = cv2.minEnclosingCircle(contour)
        circularity = area / (math.pi * enclosing_radius**2) if enclosing_radius > 0 else 0.0
        if circularity < MIN_CIRCULARITY:
            continue
        moments = cv2.moments(contour)
        if moments["m00"] == 0:
            continue
        blob_mask = np.zeros(binary.shape, dtype=np.uint8)
        cv2.drawContours(blob_mask, [contour], -1, 255, thickness=-1)
        strength = float(cv2.mean(opened, mask=blob_mask)[0]) / threshold
        blobs.append(
            Blob(
                x=moments["m10"] / moments["m00"],
                y=moments["m01"] / moments["m00"],
                diameter_px=2 * math.sqrt(area / math.pi),
                area=area,
                circularity=circularity,
                strength=strength,
            )
        )
    return BlobSearch(blobs=merge_close(blobs), threshold=threshold, response_share=response_share)


def merge_close(blobs: list[Blob]) -> list[Blob]:
    merged = list(blobs)
    changed = True
    while changed:
        changed = False
        for i in range(len(merged)):
            for j in range(i + 1, len(merged)):
                a, b = merged[i], merged[j]
                limit = MERGE_DISTANCE_SHARE * (a.diameter_px + b.diameter_px) / 2
                if math.hypot(a.x - b.x, a.y - b.y) > limit:
                    continue
                area = a.area + b.area
                merged[i] = Blob(
                    x=(a.x * a.area + b.x * b.area) / area,
                    y=(a.y * a.area + b.y * b.area) / area,
                    diameter_px=2 * math.sqrt(area / math.pi),
                    area=area,
                    circularity=min(a.circularity, b.circularity),
                    strength=max(a.strength, b.strength),
                    merged=True,
                )
                del merged[j]
                changed = True
                break
            if changed:
                break
    return merged


def paired_response(after: Gray, before_aligned: Gray, valid: Mask, blur_px: float) -> FloatImage:
    """Absolute difference after matching local brightness, so a lighting change between the two
    photos does not look like a hole. New holes are dark on white paper and usually lighter on
    the black area; the absolute difference finds both."""
    after_f = after.astype(np.float32)
    before_f = before_aligned.astype(np.float32)
    sigma = max(3.0, blur_px)
    after_level = cv2.GaussianBlur(after_f, (0, 0), sigma)
    before_level = cv2.GaussianBlur(before_f, (0, 0), sigma)
    gain = (after_level + 8.0) / (before_level + 8.0)
    difference = np.abs(after_f - before_f * gain)
    difference[valid == 0] = 0
    return np.asarray(difference, dtype=np.float32)


def single_response(gray: Gray, region: Mask, size: HoleSize) -> FloatImage:
    """Small dark features on light paper (black-hat) and small light features on the black
    area (top-hat), each taken where it applies."""
    element = disc(size.max_px * 1.4)
    closed = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, element)
    opened = cv2.morphologyEx(gray, cv2.MORPH_OPEN, element)
    black_hat = (closed.astype(np.float32) - gray.astype(np.float32)).clip(0)
    top_hat = (gray.astype(np.float32) - opened.astype(np.float32)).clip(0)
    smooth = cv2.GaussianBlur(gray, (0, 0), max(2.0, size.max_px))
    inside = region > 0
    if not np.any(inside):
        return np.zeros(gray.shape, dtype=np.float32)
    level, _ = cv2.threshold(smooth[inside].reshape(-1, 1), 0, 255, cv2.THRESH_OTSU)
    dark_area = (smooth < level).astype(np.uint8)
    response = np.where(dark_area > 0, top_hat, black_hat).astype(np.float32)
    # The edge of the black area leaves a ring of response where the two filters meet.
    boundary = cv2.morphologyEx(dark_area, cv2.MORPH_GRADIENT, disc(size.min_px))
    response[boundary > 0] = 0
    response[~inside] = 0
    return response
