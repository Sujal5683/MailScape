"""Structlog configuration.

JSON structured logs in production, pretty (colored) logs in dev. Secret
redaction is enforced — email bodies, tokens, and other sensitive values
are scrubbed before any renderer sees them.
"""
from __future__ import annotations

import logging
import sys
from typing import Any

import structlog

from app.config.settings import settings

# Keys that must never appear in log output (case-insensitive match).
_REDACTED_KEYS = frozenset(
    {
        "password",
        "token",
        "authorization",
        "api_key",
        "apikey",
        "secret",
        "bodytext",
        "bodyhtml",
        "body_html_sanitized",
        "html",
        "body",
        "content",
        "gemini_api_key",
        "google_client_secret",
        "nextauth_secret",
        "vapid_private_key",
        "access_token",
        "refresh_token",
    }
)
_REDACTED_VALUE = "[REDACTED]"


def _redact_processor(
    _logger: Any, _method: Any, event_dict: dict[str, Any]
) -> dict[str, Any]:
    """Recursively redact sensitive keys from a structlog event dict."""

    def _scrub(value: Any) -> Any:
        if isinstance(value, dict):
            return {
                k: (
                    _REDACTED_VALUE
                    if k.lower() in _REDACTED_KEYS
                    else _scrub(v)
                )
                for k, v in value.items()
            }
        if isinstance(value, (list, tuple)):
            return type(value)(_scrub(v) for v in value)
        return value

    return _scrub(event_dict)


def configure_logging() -> None:
    """Configure structlog + stdlib logging once at startup."""
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=level,
    )

    processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        _redact_processor,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]
    if settings.is_prod:
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer(colors=True))

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(level),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Return a bound structlog logger."""
    return structlog.get_logger(name)  # type: ignore[return-value]
