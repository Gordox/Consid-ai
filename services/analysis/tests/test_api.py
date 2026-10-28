"""HTTP contract of POST /v1/analyses (contracts/analysis.openapi.yaml), through the ASGI app."""

import json
import uuid
from typing import Any

import numpy as np
from fastapi.testclient import TestClient

from app.config.settings import MAX_UPLOAD_BYTES
from tests.synthetic import make_round

ROUND = make_round(21)
TAPS = ROUND.after.calibration_taps(np.random.default_rng(21))
CALIBRATION = json.dumps({"points": [{"x": x, "y": y} for x, y in TAPS]})


def fields(**overrides: str) -> dict[str, str]:
    base = {
        "roundId": str(uuid.uuid4()),
        "attemptId": str(uuid.uuid4()),
        "mode": "paired",
        "targetId": "demo-synthetic-v1",
        "calibration": CALIBRATION,
    }
    base.update(overrides)
    return base


def photos(before: bool = True) -> dict[str, Any]:
    files: dict[str, Any] = {"after": ("after.jpg", ROUND.after.jpeg, "image/jpeg")}
    if before:
        files["before"] = ("before.jpg", ROUND.before.jpeg, "image/jpeg")
    return files


def assert_error(response: Any, status: int, code: str) -> dict[str, Any]:
    assert response.status_code == status, response.text
    body: dict[str, Any] = response.json()
    assert body["code"] == code
    assert body["requestId"] == response.headers["x-request-id"]
    assert "Traceback" not in response.text
    return body


def test_paired_analysis_returns_suggestions_in_after_photo_pixels(client: TestClient) -> None:
    data = fields()
    response = client.post("/v1/analyses", data=data, files=photos())
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["roundId"] == data["roundId"]
    assert body["attemptId"] == data["attemptId"]
    assert body["status"] == "succeeded"
    assert body["algorithmVersion"] == "opencv-paired-diff-v1"
    assert body["image"] == {"width": ROUND.after.width, "height": ROUND.after.height}
    # Detection quality is covered in test_detection.py; here only the shape of the answer.
    assert body["candidates"]
    assert set(body["candidates"][0]) == {"id", "x", "y", "diameterPx", "confidence", "uncertain"}
    assert body["registration"]["method"] in {"features+ecc", "features"}


def test_single_analysis_takes_only_the_after_photo(client: TestClient) -> None:
    response = client.post("/v1/analyses", data=fields(mode="single"), files=photos(before=False))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["algorithmVersion"] == "opencv-single-morph-v1"
    assert {"code": "stickerEdges"} in body["warnings"]
    assert body["registration"] == {"method": "none", "inliers": None}


def test_mode_and_photos_must_agree(client: TestClient) -> None:
    body = assert_error(
        client.post("/v1/analyses", data=fields(), files=photos(before=False)),
        400,
        "invalidRequest",
    )
    assert body["fieldErrors"] == {"before": "required in paired mode"}
    body = assert_error(
        client.post("/v1/analyses", data=fields(mode="single"), files=photos()),
        400,
        "invalidRequest",
    )
    assert body["fieldErrors"] == {"before": "not allowed in single mode"}


def test_ids_mode_and_calibration_are_validated(client: TestClient) -> None:
    response = client.post(
        "/v1/analyses",
        data=fields(roundId="1", mode="both", calibration='{"points": []}'),
        files=photos(),
    )
    body = assert_error(response, 400, "invalidRequest")
    assert set(body["fieldErrors"]) == {"roundId", "mode", "calibration"}


def test_calibration_is_required(client: TestClient) -> None:
    data = fields()
    del data["calibration"]
    body = assert_error(
        client.post("/v1/analyses", data=data, files=photos()), 400, "invalidRequest"
    )
    assert body["fieldErrors"] == {"calibration": "required"}


def test_calibration_outside_the_photo_is_rejected(client: TestClient) -> None:
    outside = json.dumps(
        {"points": [{"x": 0, "y": -5}, {"x": 9, "y": 0}, {"x": 0, "y": 9}, {"x": -9, "y": 0}]}
    )
    assert_error(
        client.post("/v1/analyses", data=fields(calibration=outside), files=photos()),
        422,
        "invalidCalibration",
    )


def test_unknown_target_is_rejected(client: TestClient) -> None:
    assert_error(
        client.post("/v1/analyses", data=fields(targetId="other"), files=photos()),
        422,
        "unknownTarget",
    )


def test_heic_and_other_formats_are_rejected_by_content(client: TestClient) -> None:
    heic = b"\x00\x00\x00\x18ftypheic" + b"\x00" * 2000
    files = {"after": ("after.jpg", heic, "image/jpeg")}
    body = assert_error(
        client.post("/v1/analyses", data=fields(mode="single"), files=files),
        415,
        "unsupportedFormat",
    )
    assert body["fieldErrors"] == {"after": "unsupported format"}


def test_a_photo_over_the_limit_is_rejected(client: TestClient) -> None:
    big = b"\xff\xd8\xff" + b"\x00" * MAX_UPLOAD_BYTES
    files = {"after": ("after.jpg", big, "image/jpeg")}
    assert_error(
        client.post("/v1/analyses", data=fields(mode="single"), files=files), 413, "fileTooLarge"
    )


def test_a_body_over_the_total_limit_is_cut_off(client: TestClient) -> None:
    huge = b"\x00" * (2 * MAX_UPLOAD_BYTES + 512 * 1024)
    files = {"after": ("a.jpg", huge, "image/jpeg")}
    assert_error(client.post("/v1/analyses", data=fields(), files=files), 413, "payloadTooLarge")


def test_an_undecodable_photo_is_a_result_not_a_success(client: TestClient) -> None:
    files = {"after": ("after.jpg", b"\xff\xd8\xff\xe0" + b"\x00" * 3000, "image/jpeg")}
    response = client.post("/v1/analyses", data=fields(mode="single"), files=files)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "unusableImage"
    assert body["image"] is None
    assert body["candidates"] == []


def test_unknown_routes_use_the_error_format(client: TestClient) -> None:
    assert_error(client.get("/v1/nothing"), 404, "notFound")
    assert client.get("/health").json() == {"status": "ok"}
