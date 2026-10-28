"""FastAPI entry point: python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

Photos are processed in memory and in temporary upload files only; nothing is stored, and
nothing is sent to any other service.
"""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.errors import ApiError, error_response
from app.api.limits import MULTIPART_OVERHEAD_BYTES, AnalysisRunner, BodyLimitMiddleware
from app.api.routes import router
from app.config.settings import (
    MAX_CONCURRENT_ANALYSES,
    MAX_UPLOAD_BYTES,
    PROCESSING_TIMEOUT_S,
    load_settings,
)

logger = logging.getLogger("analysis")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logging.basicConfig(level=load_settings().log_level, format="%(levelname)s %(message)s")
    app.state.runner = AnalysisRunner(MAX_CONCURRENT_ANALYSES, PROCESSING_TIMEOUT_S)
    try:
        yield
    finally:
        app.state.runner.shutdown()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Target Practice analysis",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.include_router(router)
    app.add_middleware(
        BodyLimitMiddleware, max_bytes=2 * MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES
    )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.exception_handler(ApiError)
    async def handle_api_error(request: Request, error: ApiError) -> JSONResponse:
        logger.info("rejected request=%s code=%s", request.state.request_id, error.code)
        return error_response(request, error)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http(request: Request, error: StarletteHTTPException) -> JSONResponse:
        # Malformed multipart bodies, unknown paths and wrong methods.
        code = {404: "notFound", 405: "methodNotAllowed"}.get(error.status_code, "invalidRequest")
        return error_response(
            request, ApiError(error.status_code, code, "The request could not be processed.")
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation(request: Request, _: RequestValidationError) -> JSONResponse:
        return error_response(
            request, ApiError(400, "invalidRequest", "The request is incomplete or invalid.")
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, error: Exception) -> JSONResponse:
        # Only the class name: messages can contain paths or values.
        logger.error(
            "unexpected request=%s error=%s", request.state.request_id, type(error).__name__
        )
        return error_response(
            request, ApiError(500, "internalError", "The analysis failed unexpectedly.")
        )

    return app


app = create_app()
