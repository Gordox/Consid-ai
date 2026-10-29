"""Aligns the before photo to the after photo before they are compared.

Features (SIFT) give a first homography with a robust estimator (MAGSAC); ECC then refines it on
the image intensities so residual misalignment at ring lines stays around a pixel. The repeating
rings produce many false matches, so the inlier share is not a useful test; instead the aligned
photos must correlate well. Photos are never compared until this succeeds, and a failure is
reported instead of comparing unaligned pixels.
"""

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from app.imaging.opencv import cv2

Gray = NDArray[np.uint8]
Matrix = NDArray[np.float64]

SIFT_FEATURES = 4000
RATIO_TEST = 0.75
RANSAC_REPROJECTION_PX = 4.0
MIN_INLIERS = 25
# Normalised cross-correlation of the aligned, blurred photos where both exist.
MIN_ALIGNED_CORRELATION = 0.8
ECC_ITERATIONS = 60
ECC_EPSILON = 1e-5


class RegistrationFailedError(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class Registration:
    # Maps before-photo pixels to after-photo pixels, both at the working scale.
    before_to_after: Matrix
    inliers: int
    refined: bool


def _feature_homography(before: Gray, after: Gray) -> tuple[Matrix, int]:
    sift = cv2.SIFT_create(nfeatures=SIFT_FEATURES)  # type: ignore[attr-defined]
    keypoints_before, descriptors_before = sift.detectAndCompute(before, None)
    keypoints_after, descriptors_after = sift.detectAndCompute(after, None)
    if descriptors_before is None or descriptors_after is None:
        raise RegistrationFailedError("noFeatures")
    matcher = cv2.BFMatcher(cv2.NORM_L2)
    good = []
    for pair in matcher.knnMatch(descriptors_before, descriptors_after, k=2):
        if len(pair) == 2 and pair[0].distance < RATIO_TEST * pair[1].distance:
            good.append(pair[0])
    if len(good) < MIN_INLIERS:
        raise RegistrationFailedError("tooFewMatches")
    source = np.array([keypoints_before[m.queryIdx].pt for m in good], dtype=np.float32)
    destination = np.array([keypoints_after[m.trainIdx].pt for m in good], dtype=np.float32)
    homography, inlier_mask = cv2.findHomography(
        source, destination, cv2.USAC_MAGSAC, RANSAC_REPROJECTION_PX, maxIters=5000
    )
    if homography is None or inlier_mask is None:
        raise RegistrationFailedError("noHomography")
    inliers = int(inlier_mask.sum())
    if inliers < MIN_INLIERS:
        raise RegistrationFailedError("tooFewInliers")
    return homography.astype(np.float64), inliers


def _refine_with_ecc(before: Gray, after: Gray, initial: Matrix) -> Matrix | None:
    """Refines on half-size, blurred images. Returns None when ECC does not converge."""
    scale = 0.5
    small_before = cv2.GaussianBlur(cv2.resize(before, None, fx=scale, fy=scale), (5, 5), 0)
    small_after = cv2.GaussianBlur(cv2.resize(after, None, fx=scale, fy=scale), (5, 5), 0)
    to_small = np.diag([scale, scale, 1.0])
    # ECC estimates the warp that maps template (after) coordinates into the input (before).
    warp = (to_small @ np.linalg.inv(initial) @ np.linalg.inv(to_small)).astype(np.float32)
    warp /= warp[2, 2]
    criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, ECC_ITERATIONS, ECC_EPSILON)
    try:
        _, warp = cv2.findTransformECC(
            small_after.astype(np.float32),
            small_before.astype(np.float32),
            warp,
            cv2.MOTION_HOMOGRAPHY,
            criteria,
            np.full(small_after.shape, 255, dtype=np.uint8),
            5,
        )
    except cv2.error:
        return None
    after_to_before = np.linalg.inv(to_small) @ warp.astype(np.float64) @ to_small
    return np.asarray(np.linalg.inv(after_to_before), dtype=np.float64)


def aligned_correlation(before: Gray, after: Gray, before_to_after: Matrix) -> float:
    """Correlation of the two photos after alignment, on blurred images where both exist."""
    height, width = after.shape
    warped = cv2.warpPerspective(before, before_to_after, (width, height))
    coverage = cv2.warpPerspective(
        np.full(before.shape, 255, np.uint8), before_to_after, (width, height)
    )
    inside = cv2.erode(coverage, np.ones((9, 9), np.uint8)) > 0
    if np.count_nonzero(inside) < 0.2 * inside.size:
        return 0.0
    a = cv2.GaussianBlur(after, (0, 0), 2.0)[inside].astype(np.float64)
    b = cv2.GaussianBlur(warped, (0, 0), 2.0)[inside].astype(np.float64)
    a -= a.mean()
    b -= b.mean()
    denominator = float(np.sqrt((a * a).sum() * (b * b).sum()))
    return float((a * b).sum() / denominator) if denominator > 0 else 0.0


def register(before: Gray, after: Gray) -> Registration:
    homography, inliers = _feature_homography(before, after)
    best = homography
    refined = _refine_with_ecc(before, after, homography)
    if refined is not None and np.all(np.isfinite(refined)):
        # Accept the refinement only when it stays close to the feature estimate; a large jump
        # means ECC locked onto the repeating rings.
        corners = np.array([[0, 0], [after.shape[1], 0], [0, after.shape[0]]], dtype=np.float64)
        moved = _project(refined, corners) - _project(homography, corners)
        if float(np.max(np.linalg.norm(moved, axis=1))) < 0.02 * max(after.shape):
            best = refined
    if aligned_correlation(before, after, best) < MIN_ALIGNED_CORRELATION:
        raise RegistrationFailedError("poorAlignment")
    return Registration(before_to_after=best, inliers=inliers, refined=best is refined)


def _project(matrix: Matrix, points: NDArray[np.float64]) -> NDArray[np.float64]:
    homogeneous = np.hstack([points, np.ones((len(points), 1))]) @ matrix.T
    return homogeneous[:, :2] / homogeneous[:, 2:3]
