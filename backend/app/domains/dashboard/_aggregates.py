"""Aggregate queries for the dashboard domain.

Extracted from ``service.py`` to keep that file under 100 lines. Each
function performs one logical slice of the dashboard payload and is
account-scoped via the ``account_id`` parameter.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

from prisma import Prisma


async def _gather(*coros: Any) -> tuple[Any, ...]:
    """Await all coroutines concurrently (mirrors ``Promise.all``)."""
    return await asyncio.gather(*coros)


async def kpi_totals(db: Prisma, account_id: str) -> dict[str, int]:
    """Return the 7 KPI counts run in parallel by the caller."""
    total, unread, important, attachments, senders, deadlines, notifs = await _gather(
        db.email.count(where={"accountId": account_id}),
        db.email.count(where={"accountId": account_id, "isRead": False}),
        db.email.count(where={"accountId": account_id, "isImportant": True}),
        db.email.count(where={"accountId": account_id, "hasAttachment": True}),
        db.sender.count(where={"accountId": account_id}),
        db.deadline.count(where={"accountId": account_id, "status": "open"}),
        db.notification.count(where={"accountId": account_id, "isRead": False}),
    )
    return {
        "emails": total, "unread": unread, "important": important,
        "attachments": attachments, "senders": senders,
        "deadlinesOpen": deadlines, "notificationsUnread": notifs,
    }


async def category_counts(db: Prisma, account_id: str) -> tuple[list[dict[str, Any]], int]:
    """Return (rows, total_category_count) for the breakdown widget."""
    cats = await db.category.find_many(
        where={"accountId": account_id},
        include={
            "memberships": {
                "include": {"email": {"select": {"isRead": True, "receivedAt": True}}},
            },
            "_count": {"select": {"memberships": True}},
        },
        order={"sortOrder": "asc"},
    )
    rows = [
        {
            "id": c.id, "name": c.name, "color": c.color, "icon": c.icon,
            "count": c._count.memberships,
            "unread": sum(1 for m in c.memberships if not m.email.isRead),
        }
        for c in cats
    ]
    return rows, len(cats)


async def top_senders(db: Prisma, account_id: str) -> list[dict[str, Any]]:
    """Return top 6 senders by message count."""
    rows = await db.sender.find_many(
        where={"accountId": account_id},
        order={"messageCount": "desc"}, take=6,
        select={
            "id": True, "senderName": True, "senderEmail": True,
            "messageCount": True, "domain": True,
        },
    )
    return [
        {"id": r.id, "name": r.senderName, "email": r.senderEmail,
         "count": r.messageCount, "domain": r.domain}
        for r in rows
    ]


async def trend_14d(db: Prisma, account_id: str) -> list[dict[str, Any]]:
    """Return the 14-day email-volume trend (date + count per day)."""
    since = datetime.now(timezone.utc) - timedelta(days=13)
    since = since.replace(hour=0, minute=0, second=0, microsecond=0)
    emails = await db.email.find_many(
        where={"accountId": account_id, "receivedAt": {"gte": since}},
        select={"receivedAt": True},
    )
    trend: dict[str, int] = {}
    for i in range(14):
        trend[(since + timedelta(days=i)).date().isoformat()] = 0
    for e in emails:
        if e.receivedAt:
            key = e.receivedAt.date().isoformat()
            if key in trend:
                trend[key] += 1
    return [{"date": k, "count": v} for k, v in trend.items()]


async def deadlines(db: Prisma, account_id: str) -> list[dict[str, Any]]:
    """Return top 8 open deadlines ordered by dueAt asc."""
    rows = await db.deadline.find_many(
        where={"accountId": account_id, "status": "open"},
        order={"dueAt": "asc"}, take=8,
        include={"email": {"select": {"subject": True}}, "category": True},
    )
    return [
        {"id": d.id, "title": d.title,
         "dueAt": d.dueAt.isoformat() if d.dueAt else None,
         "status": d.status, "emailSubject": d.email.subject if d.email else None,
         "categoryName": d.category.name if d.category else None,
         "categoryColor": d.category.color if d.category else None}
        for d in rows
    ]


async def action_items(db: Prisma, account_id: str) -> list[dict[str, Any]]:
    """Return top 6 open action items ordered by createdAt desc."""
    rows = await db.action_item.find_many(
        where={"accountId": account_id, "status": "open"},
        order={"createdAt": "desc"}, take=6,
    )
    return [
        {"id": a.id, "title": a.title, "status": a.status,
         "dueAt": a.dueAt.isoformat() if a.dueAt else None}
        for a in rows
    ]


async def recent_activity(db: Prisma, account_id: str) -> list[dict[str, Any]]:
    """Return top 8 recent emails with primary category info."""
    rows = await db.email.find_many(
        where={"accountId": account_id},
        order={"receivedAt": "desc"}, take=8,
        include={"memberships": {"include": {"category": True}}},
    )
    out: list[dict[str, Any]] = []
    for e in rows:
        cat = e.memberships[0].category if e.memberships else None
        out.append({
            "id": e.id, "subject": e.subject, "fromEmail": e.fromEmail,
            "receivedAt": e.receivedAt.isoformat() if e.receivedAt else None,
            "categoryName": cat.name if cat else None,
            "categoryColor": cat.color if cat else None,
        })
    return out
