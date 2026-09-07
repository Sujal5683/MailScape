"""Email mutation logic for the emails domain.

Extracted from ``service.py`` to keep that file under 100 lines. Mirrors
the read / star / important / snooze / bulk routes in
``src/app/api/emails/**/route.ts``. Every mutation writes one audit row
with the previous state in ``metadata``.
"""
from __future__ import annotations

import json
from datetime import datetime

from prisma import Prisma

from app.core.errors.types import NotFound, ValidationFailed
from app.core.security.auth import Session
from app.domains.emails.mappers import map_email_to_detail
from app.domains.emails.schemas import BulkAction, BulkEmailResponse, EmailDetail

_AUDIT_BASE = {"targetType": "email", "sourceSurface": "ui"}
_PATCH_FOR: dict[BulkAction, dict[str, bool]] = {
    "read": {"isRead": True}, "unread": {"isRead": False},
    "star": {"isStarred": True}, "unstar": {"isStarred": False},
    "important": {"isImportant": True}, "unimportant": {"isImportant": False},
    "archive": {"isArchived": True}, "delete": {"isArchived": True},
}
_EVENT_FOR: dict[BulkAction, str] = {
    "read": "EMAIL_MARKED_READ", "unread": "EMAIL_MARKED_UNREAD",
    "star": "EMAIL_STARRED", "unstar": "EMAIL_UNSTARRED",
    "important": "EMAIL_MARKED_IMPORTANT", "unimportant": "EMAIL_UNMARKED_IMPORTANT",
    "archive": "EMAIL_ARCHIVED", "delete": "EMAIL_ARCHIVED",
}


async def get_email(db: Prisma, account_id: str, message_id: str) -> EmailDetail:
    """Fetch a single email (404 if not found or not owned)."""
    row = await db.email.find_first(
        where={"id": message_id, "accountId": account_id},
        include={"attachments": True,
                 "memberships": {"include": {"category": True}}},
    )
    if row is None:
        raise NotFound("Email not found")
    return map_email_to_detail(row)


async def _flag_toggle(
    db: Prisma, s: Session, mid: str, *, field: str, target: bool,
    event_on: str, event_off: str,
) -> None:
    """Shared helper for read / star / important toggles + audit."""
    email = await db.email.find_first(
        where={"id": mid, "accountId": s.account_id}
    )
    if email is None:
        raise NotFound("Email not found")
    await db.email.update(where={"id": mid}, data={field: target})
    await db.auditevent.create(data={
        **_AUDIT_BASE, "userId": s.user_id, "accountId": s.account_id,
        "targetId": mid, "eventType": event_on if target else event_off,
        "metadata": json.dumps({"previousState": getattr(email, field)}),
    })


async def mark_read(db: Prisma, s: Session, mid: str, read: bool) -> None:
    """Mark an email read/unread with audit event."""
    await _flag_toggle(db, s, mid, field="isRead", target=read,
                      event_on="EMAIL_MARKED_READ", event_off="EMAIL_MARKED_UNREAD")


async def star(db: Prisma, s: Session, mid: str, starred: bool) -> None:
    """Star/unstar an email with audit event."""
    await _flag_toggle(db, s, mid, field="isStarred", target=starred,
                      event_on="EMAIL_STARRED", event_off="EMAIL_UNSTARRED")


async def mark_important(db: Prisma, s: Session, mid: str, important: bool) -> None:
    """Mark an email important/unimportant with audit event."""
    await _flag_toggle(db, s, mid, field="isImportant", target=important,
                      event_on="EMAIL_MARKED_IMPORTANT",
                      event_off="EMAIL_UNMARKED_IMPORTANT")


async def snooze(db: Prisma, s: Session, mid: str, until: str | None) -> None:
    """Snooze (until=ISO) or unsnooze (until=null) with audit event."""
    resolved = _parse_snooze(until)
    email = await db.email.find_first(where={"id": mid, "accountId": s.account_id})
    if email is None:
        raise NotFound("Email not found")
    await db.email.update(where={"id": mid}, data={"snoozedUntil": resolved})
    await db.auditevent.create(data={
        **_AUDIT_BASE, "userId": s.user_id, "accountId": s.account_id,
        "targetId": mid,
        "eventType": "EMAIL_SNOOZED" if resolved else "EMAIL_UNSNOOZED",
        "metadata": json.dumps({
            "previousSnoozedUntil": email.snoozedUntil.isoformat()
            if email.snoozedUntil else None,
            "newSnoozedUntil": resolved.isoformat() if resolved else None,
        }),
    })


def _parse_snooze(until: str | None) -> datetime | None:
    """Parse the snooze body — None unsnoozes, ISO string snoozes."""
    if until is None:
        return None
    try:
        return datetime.fromisoformat(until.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValidationFailed("until must be a valid ISO string") from exc


async def bulk_action(
    db: Prisma, s: Session, ids: list[str], action: BulkAction,
) -> BulkEmailResponse:
    """Apply a flag toggle / archive to many owned emails (one audit row)."""
    if not ids:
        raise ValidationFailed("`ids` is required and must be a non-empty array")
    owned = await db.email.find_many(
        where={"id": {"in": ids}, "accountId": s.account_id},
    )
    owned_ids = [e.id for e in owned]
    if not owned_ids:
        return BulkEmailResponse(affected=0)
    result = await db.email.update_many(
        where={"id": {"in": owned_ids}, "accountId": s.account_id},
        data=_PATCH_FOR[action],
    )
    await db.auditevent.create(data={
        **_AUDIT_BASE, "userId": s.user_id, "accountId": s.account_id,
        "targetId": owned_ids[0], "eventType": f"BULK_{_EVENT_FOR[action]}",
        "metadata": json.dumps({
            "action": action, "affected": result.count,
            "requestedCount": len(ids), "ids": owned_ids,
        }),
    })
    return BulkEmailResponse(affected=result.count)
