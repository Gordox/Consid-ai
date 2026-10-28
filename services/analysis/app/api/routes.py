"""POST /v1/analyses: validates the request, runs the analysis off the event loop and shapes the
response. Image work lives in app.imaging and app.detection."""

import json
import logging
import time
import uuid

from fastapi import APIRouter, Request
from starlette.datastructures import FormData, UploadFile

from app.api.errors import ApiError, request_id_of
from app.api.limits import AnalysisRunner, BusyError, ProcessingTimeoutError
from app.config.settings import (
    KNOWN_TARGET_IDS,
    MAX_UPLOAD_BYTES,
    PAIRED_ALGORITHM_VERSION,
    SINGLE_ALGORITHM_VERSION,
)
from app.detection.analyze import (
    AnalysisOutcome,
    Mode,
    RegistrationInfo,
    Status,
    analyze_paired,
    analyze_single,
)
from app.imaging.decode import (
    DecodedImage,
    UnsupportedFormatError,
    UnusableImageError,
    decode_photo,
    sniff_format,
)
from app.imaging.geometry import InvalidCalibrationError, build_calibration
from app.schemas.analysis import (
    AnalysisResultOut,
    CandidateOut,
    ImageSize,
    RegistrationOut,
    WarningOut,
)

logger = logging.getLogger("analysis")
router = APIRouter()

TEXT_FIELDS = ("roundId", "attemptId", "mode", "targetId", "calibration")
FILE_FIELDS = ("after", "before")
MAX_FIELD_LENGTH = 2000


def _text(form: FormData, name: str, errors: dict[str, str]) -> str:
    value = form.get(name)
    if value is None:
        errors[name] = "required"
        return ""
    if not isinstance(value, str) or len(value) > MAX_FIELD_LENGTH:
        errors[name] = "must be a short text field"
        return ""
    return value.strip()


def _uuid(value: str, name: str, errors: dict[str, str]) -> None:
    if name in errors:
        return
    try:
        uuid.UUID(value)
    except ValueError:
        errors[name] = "must be a UUID"


def _calibration_points(raw: str, errors: dict[str, str]) -> list[tuple[float, float]]:
    """{"points": [{"x": .., "y": ..} x 4]} in after-photo pixels: top, right, bottom, left."""
    if "calibration" in errors:
        return []
    try:
        data = json.loads(raw)
        points = data["points"]
        if not isinstance(points, list) or len(points) != 4:
            raise ValueError
        parsed = []
        for point in points:
            x, y = point["x"], point["y"]
            if not all(isinstance(v, int | float) and not isinstance(v, bool) for v in (x, y)):
                raise ValueError
            parsed.append((float(x), float(y)))
        return parsed
    except ValueError, KeyError, TypeError:
        errors["calibration"] = "must be JSON with four points {x, y}: top, right, bottom, left"
        return []


async def _read_file(upload: UploadFile) -> bytes:
    data = await upload.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise ApiError(413, "fileTooLarge", "A photo is larger than 15 MB.")
    return data


def _outcome_to_response(
    round_id: str, attempt_id: str, outcome: AnalysisOutcome, image: DecodedImage | None
) -> AnalysisResultOut:
    return AnalysisResultOut(
        roundId=round_id,
        attemptId=attempt_id,
        status=outcome.status.value,
        algorithmVersion=outcome.algorithm_version,
        image=None if image is None else ImageSize(width=image.width, height=image.height),
        candidates=[
            CandidateOut(
                id=candidate.id,
                x=round(candidate.x, 2),
                y=round(candidate.y, 2),
                diameterPx=candidate.diameter_px,
                confidence=candidate.confidence,
                uncertain=candidate.uncertain,
            )
            for candidate in outcome.candidates
        ],
        warnings=[WarningOut(code=code) for code in dict.fromkeys(outcome.warnings)],  # type: ignore[arg-type]
        registration=RegistrationOut(
            method=outcome.registration.method,  # type: ignore[arg-type]
            inliers=outcome.registration.inliers,
        ),
    )


def _run(
    mode: Mode,
    after_bytes: bytes,
    before_bytes: bytes | None,
    points: list[tuple[float, float]],
) -> tuple[AnalysisOutcome, DecodedImage | None]:
    version = PAIRED_ALGORITHM_VERSION if mode is Mode.PAIRED else SINGLE_ALGORITHM_VERSION
    try:
        after = decode_photo(after_bytes)
    except UnusableImageError:
        return AnalysisOutcome(status=Status.UNUSABLE_IMAGE, algorithm_version=version), None
    try:
        calibration = build_calibration(points, after.width, after.height)
    except InvalidCalibrationError as error:
        raise ApiError(
            422,
            "invalidCalibration",
            "The calibration points don't fit this photo. Calibrate again.",
            {"calibration": str(error)},
        ) from error
    if mode is Mode.SINGLE:
        return analyze_single(after, calibration), after
    assert before_bytes is not None
    try:
        before = decode_photo(before_bytes)
    except UnusableImageError:
        return (
            AnalysisOutcome(
                status=Status.UNUSABLE_IMAGE,
                algorithm_version=version,
                registration=RegistrationInfo(method="none", inliers=None),
            ),
            after,
        )
    return analyze_paired(after, before, calibration), after


@router.post("/v1/analyses", response_model=AnalysisResultOut)
async def analyze_round(request: Request) -> AnalysisResultOut:
    started = time.monotonic()
    form = await request.form(max_files=len(FILE_FIELDS), max_fields=len(TEXT_FIELDS))
    try:
        unknown = [key for key in form if key not in TEXT_FIELDS + FILE_FIELDS]
        errors: dict[str, str] = {key: "unknown field" for key in unknown}
        round_id = _text(form, "roundId", errors)
        attempt_id = _text(form, "attemptId", errors)
        _uuid(round_id, "roundId", errors)
        _uuid(attempt_id, "attemptId", errors)
        mode_text = _text(form, "mode", errors)
        target_id = _text(form, "targetId", errors)
        raw_calibration = _text(form, "calibration", errors)
        points = _calibration_points(raw_calibration, errors)
        mode = Mode(mode_text) if mode_text in {m.value for m in Mode} else None
        if mode is None and "mode" not in errors:
            errors["mode"] = "must be paired or single"
        after = form.get("after")
        before = form.get("before")
        if not isinstance(after, UploadFile):
            errors["after"] = "required photo"
        if mode is Mode.PAIRED and not isinstance(before, UploadFile):
            errors["before"] = "required in paired mode"
        if mode is Mode.SINGLE and before is not None:
            errors["before"] = "not allowed in single mode"
        if errors:
            raise ApiError(400, "invalidRequest", "The request is incomplete or invalid.", errors)
        if target_id not in KNOWN_TARGET_IDS:
            raise ApiError(
                422,
                "unknownTarget",
                "The service doesn't know this target.",
                {"targetId": "unknown"},
            )
        assert isinstance(after, UploadFile) and mode is not None
        after_bytes = await _read_file(after)
        before_bytes = await _read_file(before) if isinstance(before, UploadFile) else None
        for name, data in (("after", after_bytes), ("before", before_bytes)):
            if data is None:
                continue
            try:
                sniff_format(data)
            except UnsupportedFormatError as error:
                raise ApiError(
                    415,
                    "unsupportedFormat",
                    "Photos must be JPEG, PNG or WebP.",
                    {name: "unsupported format"},
                ) from error
        runner: AnalysisRunner = request.app.state.runner
        try:
            outcome, image = await runner.run(lambda: _run(mode, after_bytes, before_bytes, points))
        except BusyError as error:
            raise ApiError(429, "busy", "The service is busy. Try again shortly.") from error
        except ProcessingTimeoutError as error:
            raise ApiError(504, "timeout", "The analysis took too long.") from error
    finally:
        await form.close()
    logger.info(
        "analysis request=%s mode=%s status=%s candidates=%d ms=%d",
        request_id_of(request),
        mode.value,
        outcome.status.value,
        len(outcome.candidates),
        (time.monotonic() - started) * 1000,
    )
    return _outcome_to_response(round_id, attempt_id, outcome, image)
