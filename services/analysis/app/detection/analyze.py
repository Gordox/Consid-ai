"""Runs one analysis attempt: quality checks, registration, detection and the mapping back to
after-photo pixels. No HTTP here; the API layer validates input and shapes the response."""

import statistics
from dataclasses import dataclass, field
from enum import StrEnum

import numpy as np
from numpy.typing import NDArray

from app.config.settings import PAIRED_ALGORITHM_VERSION, SINGLE_ALGORITHM_VERSION
from app.detection.holes import (
    MAX_CANDIDATES,
    MAX_RESPONSE_SHARE,
    OVERLAP_AREA_RATIO,
    ROUND_CIRCULARITY,
    Blob,
    HoleSize,
    find_blobs,
    paired_response,
    single_response,
)
from app.imaging.decode import DecodedImage
from app.imaging.geometry import Calibration, project, target_mask
from app.imaging.opencv import cv2
from app.imaging.quality import quality_warnings
from app.imaging.registration import RegistrationFailedError, register

# Detection runs on a copy whose long side is at most this; results are scaled back.
WORK_MAX_SIDE_PX = 2000
# Hole diameter range relative to the outer ring radius. Wide on purpose: it must cover .22 to
# large calibres at any plausible target size.
HOLE_PER_OUTER_RADIUS = (0.015, 0.12)
# The analysed region reaches slightly beyond the outer ring, where misses can still be seen.
REGION_RADIUS = 1.06
# Printed numbers sit on the axes. Without a before photo they look like holes, so single-photo
# analysis does not search this band (half-width in outer radii); holes there are marked by hand.
AXIS_BAND = 0.06


class Mode(StrEnum):
    PAIRED = "paired"
    SINGLE = "single"


class Status(StrEnum):
    SUCCEEDED = "succeeded"
    UNUSABLE_IMAGE = "unusableImage"
    REGISTRATION_FAILED = "registrationFailed"


@dataclass(frozen=True)
class Candidate:
    id: str
    x: float
    y: float
    diameter_px: float
    confidence: float
    uncertain: bool


@dataclass(frozen=True)
class RegistrationInfo:
    method: str  # "features+ecc", "features" or "none"
    inliers: int | None


@dataclass(frozen=True)
class AnalysisOutcome:
    status: Status
    algorithm_version: str
    candidates: list[Candidate] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    registration: RegistrationInfo = RegistrationInfo(method="none", inliers=None)


def _to_gray(image: DecodedImage, scale: float) -> NDArray[np.uint8]:
    gray = cv2.cvtColor(image.pixels, cv2.COLOR_BGR2GRAY)
    if scale < 1.0:
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    return np.asarray(gray, dtype=np.uint8)


def _work_scale(image: DecodedImage) -> float:
    return min(1.0, WORK_MAX_SIDE_PX / max(image.width, image.height))


def _hole_size(calibration: Calibration, scale: float) -> HoleSize:
    radius = calibration.outer_radius_px * scale
    low, high = HOLE_PER_OUTER_RADIUS
    return HoleSize(min_px=max(4.0, low * radius), max_px=max(8.0, high * radius))


def _region(calibration: Calibration, scale: float, shape: tuple[int, int]) -> NDArray[np.uint8]:
    """The calibrated target plus a margin, at the working scale. Analysis looks nowhere else,
    so the wall, clips and the paper's edge never become suggestions."""
    height, width = shape
    to_work = np.diag([scale, scale, 1.0])
    scaled = Calibration(
        photo_to_unit=calibration.photo_to_unit @ np.linalg.inv(to_work),
        unit_to_photo=to_work @ calibration.unit_to_photo,
        outer_radius_px=calibration.outer_radius_px * scale,
    )
    return target_mask(scaled, width, height, REGION_RADIUS)


def _axis_bands(
    calibration: Calibration, scale: float, shape: tuple[int, int]
) -> NDArray[np.bool_]:
    """Working pixels within AXIS_BAND of the target's vertical or horizontal axis."""
    height, width = shape
    ys, xs = np.mgrid[0:height, 0:width]
    points = np.stack([xs.ravel() / scale, ys.ravel() / scale], axis=1).astype(np.float64)
    unit = project(calibration.photo_to_unit, points)
    near = np.minimum(np.abs(unit[:, 0]), np.abs(unit[:, 1])) < AXIS_BAND
    return near.reshape(height, width)


def _near_edge(blob: Blob, distance_to_edge: NDArray[np.float32], size: HoleSize) -> bool:
    row = min(distance_to_edge.shape[0] - 1, max(0, round(blob.y)))
    column = min(distance_to_edge.shape[1] - 1, max(0, round(blob.x)))
    return bool(distance_to_edge[row, column] < size.max_px)


def _to_candidates(
    blobs: list[Blob],
    scale: float,
    image: DecodedImage,
    region: NDArray[np.uint8],
    size: HoleSize,
) -> list[Candidate]:
    single_areas = [blob.area for blob in blobs if blob.circularity >= ROUND_CIRCULARITY]
    typical_area = statistics.median(single_areas) if len(single_areas) >= 2 else None
    distance_to_edge = np.asarray(cv2.distanceTransform(region, cv2.DIST_L2, 5), np.float32)
    candidates = []
    for index, blob in enumerate(sorted(blobs, key=lambda b: (b.y, b.x))):
        strength_score = min(1.0, max(0.0, (blob.strength - 1.0) / 2.0))
        shape_score = min(1.0, max(0.0, (blob.circularity - 0.4) / 0.45))
        confidence = round(0.3 + 0.4 * strength_score + 0.3 * shape_score, 3)
        large = (
            blob.merged
            or blob.diameter_px > size.max_px
            or (typical_area is not None and blob.area > OVERLAP_AREA_RATIO * typical_area)
        )
        uncertain = (
            large
            or blob.circularity < ROUND_CIRCULARITY
            or blob.strength < 1.3
            or _near_edge(blob, distance_to_edge, size)
        )
        candidates.append(
            Candidate(
                id=f"c{index + 1}",
                x=float(np.clip(blob.x / scale, 0, image.width)),
                y=float(np.clip(blob.y / scale, 0, image.height)),
                diameter_px=round(blob.diameter_px / scale, 1),
                confidence=confidence,
                uncertain=uncertain,
            )
        )
    return candidates


def analyze_paired(
    after: DecodedImage, before: DecodedImage, calibration: Calibration
) -> AnalysisOutcome:
    scale = _work_scale(after)
    after_gray = _to_gray(after, scale)
    before_scale = _work_scale(before)
    before_gray = _to_gray(before, before_scale)
    region = _region(calibration, scale, after_gray.shape)
    size = _hole_size(calibration, scale)
    warnings = quality_warnings(after_gray, region)
    try:
        registration = register(before_gray, after_gray)
    except RegistrationFailedError:
        return AnalysisOutcome(
            status=Status.REGISTRATION_FAILED,
            algorithm_version=PAIRED_ALGORITHM_VERSION,
            warnings=warnings,
        )
    height, width = after_gray.shape
    aligned = np.asarray(
        cv2.warpPerspective(before_gray, registration.before_to_after, (width, height)),
        dtype=np.uint8,
    )
    coverage = cv2.warpPerspective(
        np.full(before_gray.shape, 255, dtype=np.uint8),
        registration.before_to_after,
        (width, height),
        flags=cv2.INTER_NEAREST,
    )
    valid = cv2.erode(coverage, np.ones((7, 7), np.uint8))
    analysed = np.asarray(cv2.bitwise_and(region, valid), dtype=np.uint8)
    info = RegistrationInfo(
        method="features+ecc" if registration.refined else "features",
        inliers=registration.inliers,
    )
    if np.count_nonzero(analysed) < 0.5 * np.count_nonzero(region):
        warnings.append("partialTarget")
    response = paired_response(after_gray, aligned, analysed, blur_px=size.max_px * 2)
    search = find_blobs(response, analysed, size)
    if len(search.blobs) > MAX_CANDIDATES or search.response_share > MAX_RESPONSE_SHARE:
        # Too much changed between the photos for the differences to be holes.
        return AnalysisOutcome(
            status=Status.REGISTRATION_FAILED,
            algorithm_version=PAIRED_ALGORITHM_VERSION,
            warnings=warnings,
            registration=info,
        )
    return AnalysisOutcome(
        status=Status.SUCCEEDED,
        algorithm_version=PAIRED_ALGORITHM_VERSION,
        candidates=_to_candidates(search.blobs, scale, after, analysed, size),
        warnings=warnings,
        registration=info,
    )


def analyze_single(after: DecodedImage, calibration: Calibration) -> AnalysisOutcome:
    scale = _work_scale(after)
    gray = _to_gray(after, scale)
    region = _region(calibration, scale, gray.shape)
    size = _hole_size(calibration, scale)
    warnings = quality_warnings(gray, region)
    searched = region.copy()
    searched[_axis_bands(calibration, scale, gray.shape)] = 0
    response = single_response(gray, searched, size)
    search = find_blobs(response, searched, size)
    if len(search.blobs) > MAX_CANDIDATES or search.response_share > MAX_RESPONSE_SHARE:
        return AnalysisOutcome(
            status=Status.UNUSABLE_IMAGE,
            algorithm_version=SINGLE_ALGORITHM_VERSION,
            warnings=[*warnings, "other"],
        )
    # Without a before photo old holes under stickers and sticker edges cannot be told apart
    # from new holes with certainty, so sticker edges are always a stated risk. The number
    # columns were not searched at all, which the result must say: a hole there is not found,
    # and the app must not treat it as a miss.
    return AnalysisOutcome(
        status=Status.SUCCEEDED,
        algorithm_version=SINGLE_ALGORITHM_VERSION,
        candidates=_to_candidates(search.blobs, scale, after, region, size),
        warnings=[*warnings, "stickerEdges", "numberColumnsSkipped"],
    )
