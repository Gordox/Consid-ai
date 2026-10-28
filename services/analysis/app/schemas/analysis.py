"""Response models of contracts/analysis.openapi.yaml. Coordinates are after-photo pixels after
orientation: origin top left, x to the right, y downwards."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ImageSize(BaseModel):
    width: int = Field(ge=1)
    height: int = Field(ge=1)


class CandidateOut(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    x: float
    y: float
    diameterPx: float | None
    confidence: float = Field(ge=0, le=1)
    uncertain: bool


class WarningOut(BaseModel):
    code: Literal["blur", "glare", "shadow", "clipping", "partialTarget", "stickerEdges", "other"]


class RegistrationOut(BaseModel):
    method: Literal["features+ecc", "features", "none"]
    inliers: int | None


class AnalysisResultOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    roundId: str
    attemptId: str
    status: Literal["succeeded", "unusableImage", "registrationFailed"]
    algorithmVersion: str = Field(min_length=1, max_length=100)
    # Null only when the after photo could not be decoded.
    image: ImageSize | None
    candidates: list[CandidateOut] = Field(max_length=100)
    warnings: list[WarningOut] = Field(max_length=20)
    registration: RegistrationOut


class ErrorOut(BaseModel):
    code: str
    message: str
    requestId: str
    fieldErrors: dict[str, str] | None = None
