"""FastAPI router for the threads domain.

Mounts (under ``/api/v1``):
- GET /threads/{thread_id}
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from prisma import Prisma

from app.api.deps import get_account_id, get_db
from app.domains.threads.schemas import ThreadSummary
from app.domains.threads.service import get_thread

router = APIRouter(prefix="/threads", tags=["threads"])


@router.get("/{thread_id}", response_model=ThreadSummary)
async def get_thread_route(
    thread_id: str,
    db: Prisma = Depends(get_db),
    account_id: str = Depends(get_account_id),
) -> ThreadSummary:
    """Fetch a thread with all its member emails."""
    return await get_thread(db, account_id, thread_id)
