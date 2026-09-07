"""Prisma row → Pydantic DTO mapper for the categories domain.

Mirrors `mapCategory` in `src/lib/mappers.ts`. The Prisma row's
``memberships`` relation is included so we can compute unread / important
counts and the most recent activity timestamp client-side.
"""
from __future__ import annotations

from app.domains.categories.schemas import CategorySummary


def map_category(row) -> CategorySummary:
    """Project a Prisma ``Category`` row (with memberships + _count)."""
    memberships = getattr(row, "memberships", None) or []
    unread = sum(1 for m in memberships if not m.email.isRead)
    important = sum(1 for m in memberships if m.email.isImportant)
    last = max(
        (m.email.receivedAt for m in memberships if m.email.receivedAt),
        default=None,
    )
    count = getattr(getattr(row, "_count", None), "memberships", None)
    return CategorySummary(
        id=row.id, accountId=row.accountId, name=row.name,
        description=row.description, systemDefault=row.systemDefault,
        sortOrder=row.sortOrder, color=row.color, icon=row.icon,
        totalCount=count if count is not None else len(memberships),
        unreadCount=unread, importantCount=important,
        lastActivityAt=last.isoformat() if last else None,
    )
