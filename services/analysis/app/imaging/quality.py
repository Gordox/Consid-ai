"""Photo quality checks that become warnings in the result. Thresholds are first guesses tuned
on synthetic images only; real photos must set them (docs/evaluation.md)."""

import numpy as np
from numpy.typing import NDArray

from app.imaging.opencv import cv2

Gray = NDArray[np.uint8]

# Variance of the Laplacian on the working-size image below which a photo counts as blurred.
BLUR_VARIANCE_MIN = 25.0
# Share of near-white pixels in the analysed region that indicates glare.
GLARE_SHARE_MAX = 0.02
GLARE_LEVEL = 250


def quality_warnings(gray: Gray, region: NDArray[np.uint8]) -> list[str]:
    warnings: list[str] = []
    inside = region > 0
    if not np.any(inside):
        return warnings
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    if float(laplacian[inside].var()) < BLUR_VARIANCE_MIN:
        warnings.append("blur")
    if float(np.mean(gray[inside] >= GLARE_LEVEL)) > GLARE_SHARE_MAX:
        warnings.append("glare")
    return warnings
