"""FastAPI router for the deadlines domain.

Thin handlers delegating to :mod:`app.domains.deadlines.service`. Mounts:
- ``GET    /deadlines``           — list deadlines (optional status filter)
- ``PATCH  /deadlines/{id}``      — update deadline status
- ``DELETE /deadlines/{id}``      — delete a deadline
- ``GET    /action-items``        — list open action items
- ``PATCH  /action-items/{id}``   — update action item status
- ``DELETE /action-items/{id}``   — delete an action item
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from prisma import Prisma

from app.api.deps import get_db, get_session
from app.core.security.auth import Session
from app.domains.deadlines.schemas import ActionItem, ActionItemUpdate, Deadline, DeadlineUpdate
from app.domains.deadlines.service import (
    delete_action_item, delete_deadline, list_action_items, list_deadlines,
    update_action_item, update_deadline,
)

router = APIRouter(tags=["deadlines"])


@router.get("/deadlines", response_model=list[Deadline])
async def list_deadlines_route(
    status: str = Query(default="all", pattern="^(all|open|done|missed)$"),
    db: Prisma = Depends(get_db), session: Session = Depends(get_session),
) -> list[Deadline]:
    """List deadlines for the active account."""
    return await list_deadlines(db, session.account_id, status)


@router.patch("/deadlines/{deadline_id}")
async def update_deadline_route(
    deadline_id: str, body: DeadlineUpdate,
    db: Prisma = Depends(get_db), session: Session = Depends(get_session),
) -> dict[str, bool]:
    """Update a deadline's status."""
    await update_deadline(db, session, deadline_id, body.status)
    return {"ok": True}


@router.delete("/deadlines/{deadline_id}")
async def delete_deadline_route(
    deadline_id: str, db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    """Delete a deadline."""
    await delete_deadline(db, session, deadline_id)
    return {"ok": True}


@router.get("/action-items", response_model=list[ActionItem])
async def list_action_items_route(
    db: Prisma = Depends(get_db), session: Session = Depends(get_session),
) -> list[ActionItem]:
    """List open action items for the active account."""
    return await list_action_items(db, session.account_id)


@router.patch("/action-items/{action_item_id}")
async def update_action_item_route(
    action_item_id: str, body: ActionItemUpdate,
    db: Prisma = Depends(get_db), session: Session = Depends(get_session),
) -> dict[str, bool]:
    """Update an action item's status."""
    await update_action_item(db, session, action_item_id, body.status)
    return {"ok": True}


@router.delete("/action-items/{action_item_id}")
async def delete_action_item_route(
    action_item_id: str, db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    """Delete an action item (account-scoped, 404 otherwise)."""
    await delete_action_item(db, session, action_item_id)
    return {"ok": True}
