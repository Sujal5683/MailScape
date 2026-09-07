"""FastAPI router for the accounts domain.

Mounts:
- GET    /accounts
- POST   /accounts
- POST   /accounts/{account_id}/sync
- DELETE /accounts/{account_id}
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from prisma import Prisma

from app.api.deps import get_db, get_session
from app.core.security.auth import Session
from app.domains.accounts.schemas import (
    AccountConnectionDTO,
    DisconnectRequest,
    SyncResponse,
)
from app.domains.accounts.service import (
    disconnect_account,
    get_or_create_seed_account,
    list_accounts,
    sync_account,
)

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountConnectionDTO])
async def get_accounts(
    db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> list[AccountConnectionDTO]:
    """List every mailbox account owned by the caller."""
    return await list_accounts(db, session)


@router.post("", response_model=AccountConnectionDTO, status_code=status.HTTP_201_CREATED)
async def connect_account(
    db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> AccountConnectionDTO:
    """Return the demo seed account (no auto-seeding — defect D3)."""
    return await get_or_create_seed_account(db, session)


@router.post("/{account_id}/sync", response_model=SyncResponse)
async def trigger_sync(
    account_id: str,
    db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> SyncResponse:
    """Request a sync job for the account (demo: mark success)."""
    return await sync_account(db, session, account_id)


@router.delete("/{account_id}", status_code=status.HTTP_200_OK)
async def delete_account(
    account_id: str,
    body: DisconnectRequest,
    db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    """Disconnect the account (soft-delete + audit). Requires confirmation."""
    await disconnect_account(db, session, account_id, body.confirm)
    return {"ok": True}
