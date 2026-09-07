"""Business logic for notifications.

Account-scoped list/group + read/delete + test-notification. Mirrors
`src/app/api/notifications/**/route.ts`. The grouping route returns
notifications bucketed by category (sorted by unread desc, count desc).
"""
from __future__ import annotations

import json
from collections import OrderedDict

from prisma import Prisma

from app.core.errors.types import NotFound
from app.core.security.auth import Session
from app.domains.notifications.mappers import map_notification
from app.domains.notifications.schemas import NotificationGroup


async def list_notifications(
    db: Prisma, account_id: str, filter_: str = "all"
) -> list[NotificationGroup]:
    """Return up to 100 notifications grouped by category."""
    where: dict = {"accountId": account_id}
    if filter_ == "unread":
        where["isRead"] = False
    elif filter_ == "important":
        where["importance"] = {"in": ["important", "urgent"]}
    rows = await db.notification.find_many(
        where=where, order_by={"createdAt": "desc"}, take=100, include={"category": True},
    )
    groups: "OrderedDict[str, NotificationGroup]" = OrderedDict()
    for n in rows:
        key = n.categoryId or "uncategorized"
        if key not in groups:
            cat = n.category
            groups[key] = NotificationGroup(
                key=key, label=cat.name if cat else "Uncategorized",
                color=cat.color if cat else "slate", icon=cat.icon if cat else "inbox",
            )
        g = groups[key]
        g.count += 1
        if not n.isRead:
            g.unreadCount += 1
        g.items.append(map_notification(n))
    return sorted(groups.values(), key=lambda g: (g.unreadCount, g.count), reverse=True)


async def _owned(db: Prisma, account_id: str, notification_id: str):
    """Return the notification if account-scoped, else raise NotFound."""
    row = await db.notification.find_first(
        where={"id": notification_id, "accountId": account_id}
    )
    if row is None:
        raise NotFound("Notification not found")
    return row


async def mark_read(db: Prisma, account_id: str, notification_id: str) -> None:
    """Mark a single notification as read (account-scoped)."""
    await _owned(db, account_id, notification_id)
    await db.notification.update(where={"id": notification_id}, data={"isRead": True})


async def mark_all_read(db: Prisma, account_id: str) -> None:
    """Mark every unread notification for the account as read."""
    await db.notification.update_many(
        where={"accountId": account_id, "isRead": False}, data={"isRead": True},
    )


async def delete_notification(db: Prisma, account_id: str, notification_id: str) -> None:
    """Delete a single notification (account-scoped, 404 otherwise)."""
    await _owned(db, account_id, notification_id)
    await db.notification.delete(where={"id": notification_id})


async def test_notification(db: Prisma, session: Session) -> str:
    """Create a normal-importance test notification + audit event. Returns id."""
    n = await db.notification.create(
        data={"accountId": session.account_id, "title": "Test notification",
              "body": "This is a test", "importance": "normal"}
    )
    await db.auditevent.create(
        data={"userId": session.user_id, "accountId": session.account_id,
              "eventType": "NOTIFICATION_TEST", "targetType": "notification",
              "targetId": n.id, "sourceSurface": "ui",
              "metadata": json.dumps({"title": n.title, "importance": n.importance})}
    )
    return n.id
