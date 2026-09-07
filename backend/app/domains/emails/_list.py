"""Email list query logic for the emails domain.

Extracted from ``service.py`` to keep that file under 100 lines. Mirrors
the multi-filter shape of ``src/app/api/emails/route.ts`` (snooze,
archive, bucket filters).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from prisma import Prisma

from app.domains.emails.mappers import map_email_to_list
from app.domains.emails.schemas import EmailListResponse


async def list_emails(
    db: Prisma, account_id: str, *, filters: dict[str, Any],
) -> EmailListResponse:
    """Cursor-paginated list with filters (mirrors GET /api/emails)."""
    where = _build_where(account_id, filters)
    order = _order_for(filters)
    cursor = filters.get("cursor")
    limit = filters.get("limit", 30)
    rows = await db.email.find_many(
        where=where,
        include={
            "attachments": True,
            "memberships": {"include": {"category": True}},
        },
        order=order, take=limit + 1,
        **({"cursor": {"id": cursor}, "skip": 1} if cursor else {}),
    )
    total = await db.email.count(where=where)
    page = rows[:limit]
    next_cursor = rows[limit].id if len(rows) > limit else None
    return EmailListResponse(
        items=[map_email_to_list(r) for r in page],
        nextCursor=next_cursor, total=total,
    )


def _build_where(account_id: str, f: dict[str, Any]) -> dict[str, Any]:
    """Build the Prisma ``where`` clause from filter params."""
    where: dict[str, Any] = {"accountId": account_id}
    archived_only = f.get("archivedOnly")
    bucket = f.get("filter")
    if archived_only:
        where["isArchived"] = True
    elif bucket == "drafts":
        where.update(isDraft=True, isArchived=False)
    elif bucket == "sent":
        where.update(isSent=True, isArchived=False)
    elif bucket == "spam":
        where.update(isSpam=True, isArchived=False)
    elif bucket == "starred":
        where.update(isStarred=True, isArchived=False, isDraft=False,
                     isSent=False, isSpam=False)
    else:
        where.update(isArchived=False, isDraft=False, isSent=False, isSpam=False)
    if f.get("unreadOnly"):
        where["isRead"] = False
    if f.get("importantOnly"):
        where["isImportant"] = True
    if f.get("starredOnly"):
        where["isStarred"] = True
    if f.get("senderId"):
        where["senderId"] = f["senderId"]
    if f.get("categoryId"):
        where["memberships"] = {"some": {"categoryId": f["categoryId"]}}
    now = datetime.now(timezone.utc)
    if not archived_only and f.get("snoozedOnly"):
        where["snoozedUntil"] = {"not": None, "gt": now}
    elif not archived_only and bucket != "drafts" and not f.get("includeSnoozed"):
        where["OR"] = [{"snoozedUntil": None}, {"snoozedUntil": {"lte": now}}]
    return where


def _order_for(f: dict[str, Any]) -> dict[str, str]:
    """Pick the ``order_by`` clause for the active view."""
    if f.get("archivedOnly"):
        return {"updatedAt": "desc"}
    if f.get("snoozedOnly"):
        return {"snoozedUntil": "asc"}
    if f.get("filter") == "drafts":
        return {"updatedAt": "desc"}
    return {"receivedAt": "desc"}
