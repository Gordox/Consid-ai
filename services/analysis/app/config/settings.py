"""Limits and versions of the analysis service. Kept in one place and mirrored in
contracts/analysis.openapi.yaml and the app (MAX_PHOTO_BYTES)."""

import os
from collections.abc import Mapping
from dataclasses import dataclass

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
# Upper bound on decoded pixels; protects memory against small files that decode huge.
MAX_IMAGE_PIXELS = 50_000_000
# A photo smaller than this cannot show bullet holes reliably.
MIN_IMAGE_SIDE_PX = 640
# Whole request processing, decode to result.
PROCESSING_TIMEOUT_S = 45.0
# Requests processed at the same time; further requests get 429.
MAX_CONCURRENT_ANALYSES = 2
# Known target definition ids. The service does not use their millimetre geometry: the
# calibration points mark the outer scoring ring, which is all the detector needs.
KNOWN_TARGET_IDS = frozenset({"demo-synthetic-v1"})

PAIRED_ALGORITHM_VERSION = "opencv-paired-diff-v1"
SINGLE_ALGORITHM_VERSION = "opencv-single-morph-v1"


LOG_LEVELS = ("DEBUG", "INFO", "WARNING", "ERROR")


@dataclass(frozen=True)
class ServerSettings:
    log_level: str


def load_settings(environ: Mapping[str, str] = os.environ) -> ServerSettings:
    """Reads the optional settings. An unknown value stops the start with a message naming the
    variable, instead of a logging error from deep inside the start-up."""
    level = environ.get("ANALYSIS_LOG_LEVEL", "").strip().upper() or "INFO"
    if level not in LOG_LEVELS:
        raise ValueError(f"ANALYSIS_LOG_LEVEL must be one of {', '.join(LOG_LEVELS)}")
    return ServerSettings(log_level=level)
