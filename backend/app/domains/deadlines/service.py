"""Business logic for the deadlines domain.

Account-scoped CRUD on deadlines and action items, with audit events for
every status change. Mirrors `src/app/api/deadlines/**/route.ts` and
`src/app/api/action-items/**/route.ts`. Status enums: deadlines use
``open | done | missed``; action items use ``open | done``.
"""
from __future__ import annotations

import json

from prisma import Prisma

from app.core.errors.types import NotFound
from app.core.security.auth import Session
from app.domains.deadlines.mappers import map_action_item, map_deadline
from app.domains.deadlines.schemas import ActionItem, Deadline


async def list_deadlines(db: Prisma, account_id: str, status: str = "all") -> list[Deadline]:
    """List deadlines (optionally filtered by status) ordered by dueAt asc."""
    where: dict = {"accountId": account_id}
    if status != "all":
        where["status"] = status
    rows = await db.deadline.find_many(
        where=where, order_by={"dueAt": "asc"},
        include={"email": {"select": {"subject": True}}, "category": True},
    )
    return [map_deadline(r) for r in rows]


async def _owned_deadline(db: Prisma, account_id: str, deadline_id: str):
    row = await db.deadline.find_first(where={"id": deadline_id, "accountId": account_id})
    if row is None:
        raise NotFound("Deadline not found")
    return row


async def update_deadline(
    db: Prisma, session: Session, deadline_id: str, new_status: str | None
) -> None:
    """Patch a deadline's status + audit event."""
    existing = await _owned_deadline(db, session.account_id, deadline_id)
    if new_status:
        await db.deadline.update(where={"id": deadline_id}, data={"status": new_status})
        await _audit(db, session, "DEADLINE_STATUS_CHANGED", "deadline", deadline_id,
                     {"from": existing.status, "to": new_status})


async def delete_deadline(db: Prisma, session: Session, deadline_id: str) -> None:
    """Delete a deadline + audit event."""
    existing = await _owned_deadline(db, session.account_id, deadline_id)
    await db.deadline.delete(where={"id": deadline_id})
    await _audit(db, session, "DEADLINE_DELETED", "deadline", deadline_id,
                 {"title": existing.title})


async def list_action_items(db: Prisma, account_id: str) -> list[ActionItem]:
    """List open action items for the account, newest first."""
    rows = await db.action_item.find_many(
        where={"accountId": account_id, "status": "open"},
        order_by={"createdAt": "desc"},
    )
    return [map_action_item(r) for r in rows]


async def update_action_item(
    db: Prisma, session: Session, action_item_id: str, new_status: str | None
) -> None:
    """Patch an action item's status + audit event."""
    row = await db.action_item.find_first(
        where={"id": action_item_id, "accountId": session.account_id}
    )
    if row is None:
        raise NotFound("Action item not found")
    if new_status:
        await db.action_item.update(where={"id": action_item_id}, data={"status": new_status})
        await _audit(db, session, "ACTION_ITEM_STATUS_CHANGED", "action_item",
                     action_item_id, {"from": row.status, "to": new_status})


async def delete_action_item(db: Prisma, session: Session, action_item_id: str) -> None:
    """Delete an action item (account-scoped, 404 otherwise). Mirrors Next.js."""
    row = await db.action_item.find_first(
        where={"id": action_item_id, "accountId": session.account_id}
    )
    if row is None:
        raise NotFound("Action item not found")
    await db.action_item.delete(where={"id": action_item_id})


async def _audit(db: Prisma, session: Session, event_type: str, target_type: str,
                 target_id: str, meta: dict) -> None:
    """Persist an audit event for a deadlines-domain write."""
    await db.audit_event.create(data={
        "userId": session.user_id, "accountId": session.account_id,
        "eventType": event_type, "targetType": target_type, "targetId": target_id,
        "sourceSurface": "ui", "metadata": json.dumps(meta)})
