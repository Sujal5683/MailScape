"""Mappers for the notifications domain.

Project a Prisma `Notification` row (with the optional `category` relation
populated) to the public `Notification` DTO. Used by both the list-grouping
route and any future single-read route.
"""
from __future__ import annotations

from app.domains.notifications.schemas import Notification


def map_notification(row) -> Notification:
    """Project a Prisma Notification row → Notification DTO."""
    return Notification(
        id=row.id,
        accountId=row.accountId,
        emailId=row.emailId,
        categoryId=row.categoryId,
        title=row.title,
        body=row.body,
        importance=row.importance,
        isRead=row.isRead,
        createdAt=row.createdAt.isoformat(),
        categoryName=row.category.name if getattr(row, "category", None) else None,
        categoryColor=row.category.color if getattr(row, "category", None) else None,
    )
