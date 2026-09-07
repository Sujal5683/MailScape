"""FastAPI router for the senders domain.

Thin handlers delegating to :mod:`app.domains.senders.service`. Mounts:
- ``GET /senders`` — list + search senders.
- ``GET /senders/{sender_id}`` — single sender detail.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from prisma import Prisma

from app.api.deps import get_account_id, get_db
from app.domains.senders.schemas import SenderSummary
from app.domains.senders.service import get_sender, list_senders

router = APIRouter(tags=["senders"])


@router.get("/senders", response_model=list[SenderSummary])
async def list_senders_route(
    q: str = Query(default="", description="Optional substring filter"),
    db: Prisma = Depends(get_db),
    account_id: str = Depends(get_account_id),
) -> list[SenderSummary]:
    """List senders for the active account, newest by message count."""
    return await list_senders(db, account_id, q)


@router.get("/senders/{sender_id}", response_model=SenderSummary)
async def get_sender_route(
    sender_id: str,
    db: Prisma = Depends(get_db),
    account_id: str = Depends(get_account_id),
) -> SenderSummary:
    """Return one sender (404 if not found in the active account)."""
    return await get_sender(db, account_id, sender_id)
