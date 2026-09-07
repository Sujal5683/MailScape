"""Shared Pydantic schemas.

- :class:`ApiError` — the standard error envelope returned by all error
  handlers (see :mod:`app.core.errors.handlers`).
- :class:`PaginationParams` — re-exported from :mod:`app.api.deps` for
  schema-only consumers.
- :class:`CursorPage` — generic cursor-paginated list response used by all
  list endpoints.
"""
from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

from app.api.deps import PaginationParams  # re-export

T = TypeVar("T")


class ApiError(BaseModel):
    """Standard error response body."""

    code: str = Field(..., examples=["NOT_FOUND"])
    message: str = Field(..., examples=["Email not found"])
    request_id: str | None = Field(
        default=None,
        alias="requestId",
        description="Correlates with the X-Request-ID response header.",
    )

    model_config = ConfigDict(populate_by_name=True)


class CursorPage(BaseModel, Generic[T]):
    """Generic cursor-paginated list response.

    Clients pass ``cursor`` on the next request to fetch the page after
    ``next_cursor``. ``has_more`` is false on the final page.
    """

    items: list[T]
    next_cursor: str | None = Field(
        default=None,
        alias="nextCursor",
        description="Opaque cursor for the next page; null when done.",
    )
    has_more: bool = Field(default=False, alias="hasMore")

    model_config = ConfigDict(populate_by_name=True)


__all__ = ["ApiError", "CursorPage", "PaginationParams"]
