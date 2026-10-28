"""Structured errors: a stable code, a safe message, optional field errors and the request id.
Never a stack trace, file content or path."""

from fastapi import Request
from fastapi.responses import JSONResponse

from app.schemas.analysis import ErrorOut


class ApiError(Exception):
    def __init__(
        self, status: int, code: str, message: str, field_errors: dict[str, str] | None = None
    ) -> None:
        super().__init__(code)
        self.status = status
        self.code = code
        self.message = message
        self.field_errors = field_errors


def request_id_of(request: Request) -> str:
    value = getattr(request.state, "request_id", None)
    return value if isinstance(value, str) else "unknown"


def error_response(request: Request, error: ApiError) -> JSONResponse:
    body = ErrorOut(
        code=error.code,
        message=error.message,
        requestId=request_id_of(request),
        fieldErrors=error.field_errors,
    )
    return JSONResponse(status_code=error.status, content=body.model_dump(exclude_none=True))
