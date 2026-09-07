"""Pydantic schemas for the misc domain (saved searches + templates).

Mirrors `SavedSearch`, `EmailTemplate`, `EmailTemplateCategory`, and
`SearchFilters` in `src/lib/types.ts`.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.domains.search.schemas import SearchFilters

# Whitelisted SearchFilters keys — anything else in the payload is dropped
# so we never persist unexpected fields. Mirrors the SearchFilters contract.
ALLOWED_FILTER_KEYS = (
    "query", "sender", "categoryIds", "isRead", "isStarred", "isImportant",
    "hasAttachment", "attachmentType", "dateFrom", "dateTo", "timeFrom",
    "timeTo", "labels", "includeSpam", "includeDrafts", "includeSent",
    "includeArchived", "cursor", "limit",
)

ALLOWED_TEMPLATE_CATEGORIES = (
    "general", "followup", "request", "announcement", "custom",
)


class SavedSearch(BaseModel):
    """A persisted filter preset."""

    id: str
    accountId: str = Field(alias="accountId")
    name: str
    filters: SearchFilters
    createdAt: str
    updatedAt: str

    model_config = ConfigDict(populate_by_name=True)


class SavedSearchCreate(BaseModel):
    """Body for POST /saved-searches."""

    name: str
    filters: SearchFilters


class EmailTemplate(BaseModel):
    """A persisted email compose template."""

    id: str
    accountId: str = Field(alias="accountId")
    name: str
    subject: str
    body: str
    category: str = "general"
    createdAt: str
    updatedAt: str

    model_config = ConfigDict(populate_by_name=True)


class EmailTemplateCreate(BaseModel):
    """Body for POST /templates."""

    name: str
    subject: str = ""
    body: str = ""
    category: str | None = None


class EmailTemplateUpdate(BaseModel):
    """Body for PUT /templates/{id} — all fields optional."""

    name: str | None = None
    subject: str | None = None
    body: str | None = None
    category: str | None = None
