"""Request ID middleware.

Assigns a unique ID to every request, stores it on
``request.state.request_id``, binds it to the structlog contextvars (so
every log line emitted during the request includes it), and echoes it back
in the ``X-Request-ID`` response header so upstream callers can correlate
logs.
"""
from __future__ import annotations

import uuid
from typing import Awaitable, Callable

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

_HEADER = "X-Request-ID"


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Attach a request id to each request + response."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        # Honour an inbound id if the caller supplied one, else mint a new one.
        request_id = request.headers.get(_HEADER) or uuid.uuid4().hex
        request.state.request_id = request_id

        # Bind into structlog contextvars so every log line includes the id.
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        response = await call_next(request)
        response.headers[_HEADER] = request_id
        return response
