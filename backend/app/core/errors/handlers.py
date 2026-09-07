"""FastAPI exception handlers and the standard error response shape.

All error responses share a single envelope::

    {"code": "ERROR_CODE", "message": "...", "requestId": "..."}

The exception classes themselves live in :mod:`app.core.errors.types`.
"""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.errors.types import AppError
from app.core.logging.setup import get_logger

_log = get_logger(__name__)


def _error_body(code: str, message: str, request: Request) -> dict[str, Any]:
    """Build the standard error envelope, attaching the request id."""
    return {
        "code": code,
        "message": message,
        "requestId": getattr(request.state, "request_id", None),
    }


async def _app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    _log.warning(
        "request_failed",
        code=exc.code,
        status=exc.status_code,
        message=exc.message,
        details=exc.details,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=jsonable_encoder(_error_body(exc.code, exc.message, request)),
    )


_HTTP_CODE_MAP = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "PERMISSION_DENIED",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    429: "RATE_LIMITED",
}


async def _http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    code = _HTTP_CODE_MAP.get(exc.status_code, "HTTP_ERROR")
    return JSONResponse(
        status_code=exc.status_code,
        content=jsonable_encoder(_error_body(code, str(exc.detail), request)),
    )


async def _validation_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder(
            {
                **_error_body(
                    "VALIDATION_ERROR", "Request validation failed", request
                ),
                "details": exc.errors(),
            }
        ),
    )


async def _unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
    _log.exception("unhandled_exception", error_type=type(exc).__name__)
    return JSONResponse(
        status_code=500,
        content=jsonable_encoder(
            _error_body("INTERNAL_ERROR", "Internal server error", request)
        ),
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Wire all exception handlers into the FastAPI app."""
    app.add_exception_handler(AppError, _app_error_handler)
    app.add_exception_handler(StarletteHTTPException, _http_exception_handler)
    app.add_exception_handler(RequestValidationError, _validation_handler)
    app.add_exception_handler(Exception, _unhandled_handler)
