"""Pydantic schemas for the categories domain.

Mirrors `CategorySummary` in `src/lib/types.ts`. The Prisma row's
``memberships`` relation is included in queries so the mapper can compute
counts and last-activity timestamps.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class CategorySummary(BaseModel):
    """Public category shape with aggregate counts."""

    id: str
    account_id: str = Field(alias="accountId")
    name: str
    description: str | None = None
    system_default: bool = Field(alias="systemDefault")
    sort_order: int = Field(alias="sortOrder")
    color: str
    icon: str
    total_count: int = Field(alias="totalCount")
    unread_count: int = Field(alias="unreadCount")
    important_count: int = Field(alias="importantCount")
    last_activity_at: str | None = Field(default=None, alias="lastActivityAt")
    model_config = ConfigDict(populate_by_name=True)


class CategoryCreate(BaseModel):
    """Body for POST /categories."""

    name: str
    description: str | None = None
    color: str = "slate"
    icon: str = "folder"


class CategoryUpdate(BaseModel):
    """Body for PATCH /categories/{id} — all fields optional."""

    name: str | None = None
    description: str | None = None
    color: str | None = None
    icon: str | None = None
