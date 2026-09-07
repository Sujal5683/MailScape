"""FastAPI router for the compose domain.

Thin handlers delegating to :mod:`app.domains.compose.service`. Mounts:
- ``POST /compose/drafts``     — save a draft (reversible)
- ``POST /compose/send``       — send an email (confirmation-gated)
- ``GET  /recipients/search``  — recipient autocomplete from stored senders

The send endpoint enforces ``confirm == True`` *before* delegating to the
service; a missing/false flag returns 409 with the same body shape as
the Next.js route so the client can prompt the user.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from prisma import Prisma

from app.api.deps import get_db, get_session
from app.core.security.auth import Session
from app.domains.compose.schemas import (
    Draft, DraftCreate, RecipientSearchResult, SendRequest, SendResponse,
)
from app.domains.compose.service import save_draft, search_recipients, send_email

router = APIRouter(tags=["compose"])

_CONFIRM_BODY = {"ok": False, "confirmation": True, "error": "Sending email requires confirmation"}


@router.post("/compose/drafts", response_model=Draft, status_code=201)
async def save_draft_route(
    body: DraftCreate,
    db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> Draft:
    """Save a draft. Emits a DRAFT_SAVED audit event."""
    return await save_draft(db, session, body)


@router.post("/compose/send", response_model=SendResponse)
async def send_email_route(
    body: SendRequest,
    db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
):
    """Send an email. Requires ``confirm: True``; otherwise returns 409."""
    if not body.confirm:
        return JSONResponse(status_code=409, content=_CONFIRM_BODY)
    return await send_email(db, session, body)


@router.get("/recipients/search", response_model=list[RecipientSearchResult])
async def search_recipients_route(
    q: str = Query(default="", description="Substring to match against senders"),
    db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> list[RecipientSearchResult]:
    """Autocomplete recipients from the account's stored senders."""
    return await search_recipients(db, session.account_id, q)
