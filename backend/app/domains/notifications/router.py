"""FastAPI router for the notifications domain.

Thin handlers delegating to :mod:`app.domains.notifications.service` and
:mod:`app.domains.notifications.preferences`. Mounts:
- ``GET    /notifications``             — list + group
- ``POST   /notifications/{id}/read``   — mark one read
- ``POST   /notifications/read-all``    — mark all read
- ``DELETE /notifications/{id}``        — delete one
- ``POST   /notifications/test``        — create test notification
- ``GET    /notification-preferences``  — list preferences
- ``PUT    /notification-preferences``  — upsert a preference
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from prisma import Prisma

from app.api.deps import get_db, get_session
from app.core.security.auth import Session
from app.domains.notifications.preferences import get_preferences, update_preference
from app.domains.notifications.schemas import (
    NotificationGroup, NotificationPreferences, NotificationPrefUpdate,
)
from app.domains.notifications.service import (
    delete_notification, list_notifications, mark_all_read, mark_read, test_notification,
)

router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=list[NotificationGroup])
async def list_notifications_route(
    filter: str = Query(default="all", pattern="^(all|unread|important)$"),
    db: Prisma = Depends(get_db), session: Session = Depends(get_session),
) -> list[NotificationGroup]:
    """List notifications grouped by category for the active account."""
    return await list_notifications(db, session.account_id, filter)


@router.post("/notifications/{notification_id}/read")
async def mark_read_route(
    notification_id: str, db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    """Mark a single notification as read."""
    await mark_read(db, session.account_id, notification_id)
    return {"ok": True}


@router.post("/notifications/read-all")
async def mark_all_read_route(
    db: Prisma = Depends(get_db), session: Session = Depends(get_session),
) -> dict[str, bool]:
    """Mark every unread notification as read."""
    await mark_all_read(db, session.account_id)
    return {"ok": True}


@router.delete("/notifications/{notification_id}")
async def delete_notification_route(
    notification_id: str, db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    """Delete a single notification."""
    await delete_notification(db, session.account_id, notification_id)
    return {"ok": True}


@router.post("/notifications/test")
async def test_notification_route(
    db: Prisma = Depends(get_db), session: Session = Depends(get_session),
) -> dict[str, object]:
    """Create a test in-app notification; returns its id."""
    return {"ok": True, "id": await test_notification(db, session)}


@router.get("/notification-preferences", response_model=NotificationPreferences)
async def get_preferences_route(
    db: Prisma = Depends(get_db), session: Session = Depends(get_session),
) -> NotificationPreferences:
    """Return effective per-channel preferences for the active account."""
    return await get_preferences(db, session.account_id)


@router.put("/notification-preferences")
async def update_preference_route(
    body: NotificationPrefUpdate, db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    """Upsert a single (channel, categoryId) preference."""
    await update_preference(db, session, body)
    return {"ok": True}
