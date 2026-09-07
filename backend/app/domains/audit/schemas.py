"""Pydantic schemas for the audit domain.

Mirrors `AuditEventDTO` and `AuditEventPage` in `src/lib/types.ts`. The
metadata column is parsed defensively — a corrupt JSON string becomes an
empty dict so a single bad row never breaks the listing endpoint.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class AuditEventDTO(BaseModel):
    """One audit event row (sanitized metadata only — no PII)."""

    id: str
    eventType: str
    targetType: str | None = None
    targetId: str | None = None
    sourceSurface: str | None = None
    actionId: str | None = None
    metadata: dict = Field(default_factory=dict)
    createdAt: str


class AuditEventPage(BaseModel):
    """Paginated audit-event response."""

    items: list[AuditEventDTO] = Field(default_factory=list)
    nextCursor: str | None = None
    total: int = 0
