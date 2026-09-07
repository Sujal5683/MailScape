"""FastAPI router for the emails domain.

Mounts (all under ``/api/v1``):
- GET  /emails
- GET  /emails/{message_id}
- POST /emails/{message_id}/read
- POST /emails/{message_id}/star
- POST /emails/{message_id}/important
- POST /emails/{message_id}/snooze
- POST /emails/bulk

Routes are thin: they parse query/body params, call service functions, and
return the DTO. All account scoping happens in the service layer.
"""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Body, Depends, Query
from prisma import Prisma
from pydantic import BaseModel

from app.api.deps import get_account_id, get_db, get_session
from app.core.security.auth import Session
from app.domains.emails.schemas import BulkEmailResponse, EmailDetail, EmailListResponse
from app.domains.emails.service import (
    bulk_action, get_email, list_emails, mark_important, mark_read, snooze, star,
)

router = APIRouter(prefix="/emails", tags=["emails"])

Bucket = Literal["drafts", "sent", "spam", "starred"]
BulkActionName = Literal[
    "read", "unread", "star", "unstar",
    "important", "unimportant", "archive", "delete",
]


class BulkBody(BaseModel):
    """Body for POST /emails/bulk."""

    ids: list[str]
    action: BulkActionName


@router.get("", response_model=EmailListResponse)
async def get_emails(
    db: Prisma = Depends(get_db),
    account_id: str = Depends(get_account_id),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
    categoryId: str | None = Query(default=None),
    senderId: str | None = Query(default=None),
    unreadOnly: bool | None = Query(default=None),
    importantOnly: bool | None = Query(default=None),
    starredOnly: bool | None = Query(default=None),
    snoozedOnly: bool | None = Query(default=None),
    includeSnoozed: bool | None = Query(default=None),
    archivedOnly: bool | None = Query(default=None),
    filter: Bucket | None = Query(default=None),
) -> EmailListResponse:
    """Cursor-paginated email list with bucket / flag / snooze filters."""
    return await list_emails(db, account_id, filters={
        "cursor": cursor, "limit": limit, "categoryId": categoryId,
        "senderId": senderId, "unreadOnly": unreadOnly,
        "importantOnly": importantOnly, "starredOnly": starredOnly,
        "snoozedOnly": snoozedOnly, "includeSnoozed": includeSnoozed,
        "archivedOnly": archivedOnly, "filter": filter,
    })


@router.post("/bulk", response_model=BulkEmailResponse)
async def post_bulk(
    body: BulkBody,
    db: Prisma = Depends(get_db), session: Session = Depends(get_session),
) -> BulkEmailResponse:
    """Apply a bulk action to many owned emails."""
    return await bulk_action(db, session, body.ids, body.action)  # type: ignore[arg-type]


@router.get("/{message_id}", response_model=EmailDetail)
async def get_email_detail(
    message_id: str,
    db: Prisma = Depends(get_db),
    account_id: str = Depends(get_account_id),
) -> EmailDetail:
    """Fetch a single email with body, attachments, and memberships."""
    return await get_email(db, account_id, message_id)


@router.post("/{message_id}/read")
async def set_read(
    message_id: str,
    read: bool = Body(default=True, embed=True),
    db: Prisma = Depends(get_db), session: Session = Depends(get_session),
) -> dict[str, bool]:
    """Mark an email read (read=false → unread)."""
    await mark_read(db, session, message_id, read)
    return {"ok": True}


@router.post("/{message_id}/star")
async def set_starred(
    message_id: str,
    starred: bool = Body(default=True, embed=True),
    db: Prisma = Depends(get_db), session: Session = Depends(get_session),
) -> dict[str, bool]:
    """Star an email (starred=false → unstar)."""
    await star(db, session, message_id, starred)
    return {"ok": True}


@router.post("/{message_id}/important")
async def set_important(
    message_id: str,
    important: bool = Body(default=True, embed=True),
    db: Prisma = Depends(get_db), session: Session = Depends(get_session),
) -> dict[str, bool]:
    """Mark an email important (important=false → unimportant)."""
    await mark_important(db, session, message_id, important)
    return {"ok": True}


@router.post("/{message_id}/snooze")
async def set_snooze(
    message_id: str,
    until: str | None = Body(default=None, embed=True),
    db: Prisma = Depends(get_db), session: Session = Depends(get_session),
) -> dict[str, bool]:
    """Snooze until an ISO timestamp (until=null unsnoozes)."""
    await snooze(db, session, message_id, until)
    return {"ok": True}
