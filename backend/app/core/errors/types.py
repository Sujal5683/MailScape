"""Application exception hierarchy.

Subclasses of :class:`AppError` set a ``status_code`` and ``code``;
:meth:`app.core.errors.handlers.register_exception_handlers` maps them to
the standard error envelope.

    NotFound          -> 404
    ValidationFailed  -> 400
    PermissionDenied  -> 403
    RateLimited       -> 429
"""
from __future__ import annotations

from typing import Any


class AppError(Exception):
    """Base error. Subclasses set ``status_code`` and ``code``."""

    status_code: int = 500
    code: str = "INTERNAL_ERROR"

    def __init__(
        self, message: str, *, details: dict[str, Any] | None = None
    ) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFound(AppError):
    status_code = 404
    code = "NOT_FOUND"


class ValidationFailed(AppError):
    status_code = 400
    code = "VALIDATION_ERROR"


class PermissionDenied(AppError):
    status_code = 403
    code = "PERMISSION_DENIED"


class RateLimited(AppError):
    status_code = 429
    code = "RATE_LIMITED"


__all__ = [
    "AppError",
    "NotFound",
    "ValidationFailed",
    "PermissionDenied",
    "RateLimited",
]
