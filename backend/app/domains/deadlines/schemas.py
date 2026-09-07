"""Pydantic schemas for the deadlines domain.

Mirrors `Deadline` and `ActionItem` in `src/lib/types.ts`. Status enums
are surfaced as plain strings (the Prisma schema stores them as
strings with a CHECK constraint in the SQL port).
"""
from __future__ import annotations

from pydantic import BaseModel


class Deadline(BaseModel):
    """A deadline row with optional email/category context."""

    id: str
    accountId: str
    emailId: str | None = None
    categoryId: str | None = None
    title: str
    dueAt: str | None = None
    confidence: float | None = None
    status: str = "open"
    emailSubject: str | None = None
    categoryName: str | None = None
    categoryColor: str | None = None


class DeadlineUpdate(BaseModel):
    """Body for PATCH /deadlines/{id}."""

    status: str | None = None


class ActionItem(BaseModel):
    """An action item row."""

    id: str
    accountId: str
    emailId: str | None = None
    title: str
    status: str = "open"
    dueAt: str | None = None


class ActionItemUpdate(BaseModel):
    """Body for PATCH /action-items/{id}."""

    status: str | None = None
