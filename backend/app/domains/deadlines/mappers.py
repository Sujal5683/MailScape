"""Mappers for the deadlines domain.

Project Prisma `Deadline` and `ActionItem` rows (with optional
`email`/`category` relations populated) to the public DTOs.
"""
from __future__ import annotations

from app.domains.deadlines.schemas import ActionItem, Deadline


def map_deadline(row) -> Deadline:
    """Project a Prisma Deadline row → Deadline DTO."""
    return Deadline(
        id=row.id, accountId=row.accountId, emailId=row.emailId, categoryId=row.categoryId,
        title=row.title, dueAt=row.dueAt.isoformat() if row.dueAt else None,
        confidence=row.confidence, status=row.status,
        emailSubject=row.email.subject if getattr(row, "email", None) else None,
        categoryName=row.category.name if getattr(row, "category", None) else None,
        categoryColor=row.category.color if getattr(row, "category", None) else None,
    )


def map_action_item(row) -> ActionItem:
    """Project a Prisma ActionItem row → ActionItem DTO."""
    return ActionItem(
        id=row.id, accountId=row.accountId, emailId=row.emailId, title=row.title,
        status=row.status,
        dueAt=row.dueAt.isoformat() if row.dueAt else None,
    )
