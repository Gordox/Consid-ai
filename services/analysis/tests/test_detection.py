"""Detection on synthetic photos. These show the pipeline behaves as designed on controlled
images (registration, sticker edges, lighting, perspective); they are not evidence of accuracy on
real photos. See docs/evaluation.md."""

import numpy as np
import pytest

from app.detection.analyze import Status, analyze_paired, analyze_single
from app.imaging.decode import decode_photo
from app.imaging.geometry import Calibration, build_calibration
from app.imaging.opencv import cv2
from tests.synthetic import Hole, SyntheticRound, make_round, match

SEEDS = range(6)


def calibrate(round_: SyntheticRound, seed: int) -> Calibration:
    taps = round_.after.calibration_taps(np.random.default_rng(seed))
    return build_calibration(taps, round_.after.width, round_.after.height)


def totals(mode: str) -> tuple[int, int, int]:
    tp = fp = fn = 0
    for seed in SEEDS:
        round_ = make_round(seed)
        after = decode_photo(round_.after.jpeg)
        calibration = calibrate(round_, seed)
        if mode == "paired":
            outcome = analyze_paired(after, decode_photo(round_.before.jpeg), calibration)
        else:
            outcome = analyze_single(after, calibration)
        assert outcome.status is Status.SUCCEEDED
        found = [(c.x, c.y) for c in outcome.candidates]
        result = match(found, round_.new_holes_in_after, round_.hole_radius_in_after * 1.5)
        tp, fp, fn = tp + result[0], fp + result[1], fn + result[2]
    return tp, fp, fn


def test_paired_mode_finds_new_holes_and_ignores_covered_ones() -> None:
    tp, fp, fn = totals("paired")
    assert tp / (tp + fn) >= 0.9
    assert tp / (tp + fp) >= 0.9


def test_single_mode_finds_most_new_holes_off_the_number_columns() -> None:
    tp, fp, fn = totals("single")
    assert tp / (tp + fn) >= 0.85
    assert tp / (tp + fp) >= 0.8


def test_paired_mode_reports_nothing_when_nothing_changed() -> None:
    round_ = make_round(11, new_holes=0)
    outcome = analyze_paired(
        decode_photo(round_.after.jpeg), decode_photo(round_.before.jpeg), calibrate(round_, 11)
    )
    assert outcome.status is Status.SUCCEEDED
    assert outcome.candidates == []


def test_overlapping_holes_become_one_uncertain_suggestion() -> None:
    pair = [Hole(x=1300, y=1000, radius=16), Hole(x=1318, y=1004, radius=16)]
    round_ = make_round(12, new_holes=0, extra_new=pair)
    outcome = analyze_paired(
        decode_photo(round_.after.jpeg), decode_photo(round_.before.jpeg), calibrate(round_, 12)
    )
    assert outcome.status is Status.SUCCEEDED
    assert len(outcome.candidates) == 1
    assert outcome.candidates[0].uncertain


def test_a_before_photo_without_the_target_fails_registration_instead_of_guessing() -> None:
    round_ = make_round(13)
    rng = np.random.default_rng(13)
    unrelated = rng.integers(90, 160, size=(3000, 2400, 3), dtype=np.uint8)
    ok, encoded = cv2.imencode(".jpg", cv2.GaussianBlur(unrelated, (0, 0), 3))
    assert ok
    outcome = analyze_paired(
        decode_photo(round_.after.jpeg), decode_photo(encoded.tobytes()), calibrate(round_, 13)
    )
    assert outcome.status is Status.REGISTRATION_FAILED
    assert outcome.candidates == []


@pytest.mark.parametrize("mode", ["paired", "single"])
def test_candidates_are_in_after_photo_pixels(mode: str) -> None:
    round_ = make_round(15)
    after = decode_photo(round_.after.jpeg)
    calibration = calibrate(round_, 15)
    outcome = (
        analyze_paired(after, decode_photo(round_.before.jpeg), calibration)
        if mode == "paired"
        else analyze_single(after, calibration)
    )
    for candidate in outcome.candidates:
        assert 0 <= candidate.x <= after.width
        assert 0 <= candidate.y <= after.height
        assert 0 <= candidate.confidence <= 1
