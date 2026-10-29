import pytest

from app.config.settings import load_settings


def test_log_level_defaults_to_info_when_unset_or_blank() -> None:
    assert load_settings({}).log_level == "INFO"
    assert load_settings({"ANALYSIS_LOG_LEVEL": "  "}).log_level == "INFO"


def test_log_level_is_case_insensitive() -> None:
    assert load_settings({"ANALYSIS_LOG_LEVEL": " debug "}).log_level == "DEBUG"


def test_unknown_log_level_names_the_variable() -> None:
    with pytest.raises(ValueError, match="ANALYSIS_LOG_LEVEL must be one of"):
        load_settings({"ANALYSIS_LOG_LEVEL": "verbose"})
