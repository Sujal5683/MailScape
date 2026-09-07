"""Pydantic schemas for the search domain.

Mirrors `SearchFilters` and `SearchResult` in `src/lib/types.ts`. Filters
are all optional; pagination uses a cursor (the last email id) + a limit
capped at 100.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class SearchFilters(BaseModel):
    """Structured filter set for `POST /search`."""

    query: str | None = None
    sender: str | None = None
    categoryIds: list[str] | None = None
    isRead: bool | None = None
    isStarred: bool | None = None
    isImportant: bool | None = None
    hasAttachment: bool | None = None
    attachmentType: str | None = None
    dateFrom: str | None = None
    dateTo: str | None = None
    timeFrom: str | None = None
    timeTo: str | None = None
    labels: list[str] | None = None
    includeSpam: bool = False
    includeDrafts: bool = False
    includeSent: bool = False
    includeArchived: bool = False
    cursor: str | None = None
    limit: int = 30

    model_config = ConfigDict(populate_by_name=True)


class EmailListItem(BaseModel):
    """Minimal email projection returned by search. Mirrors EmailListItem."""

    id: str
    subject: str | None = None
    fromEmail: str
    fromName: str | None = None
    receivedAt: str | None = None
    isRead: bool = False
    isStarred: bool = False
    isImportant: bool = False
    hasAttachment: bool = False
    snippet: str | None = None


class SearchResult(BaseModel):
    """Response for `POST /search`."""

    items: list[EmailListItem] = Field(default_factory=list)
    nextCursor: str | None = None
    total: int = 0
    parsedFilters: SearchFilters | None = None


class NaturalLanguageRequest(BaseModel):
    """Body for `POST /search/natural-language`."""

    query: str


class NaturalLanguageResponse(BaseModel):
    """Parsed filters + one-sentence human summary."""

    parsed: SearchFilters
    summary: str
