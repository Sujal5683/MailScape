"""Business logic for the accounts domain.

Account-scoped helpers wrapping Prisma reads + audit-side-effect writes
that mirror `src/app/api/accounts/**/route.ts`. The FastAPI process does
**not** auto-seed (defect D3 in BACKEND_MIGRATION.md); POST /accounts
returns the existing demo seed account instead of running ``ensureSeedData``.
"""
from __future__ import annotations

from datetime import datetime, timezone

from prisma import Prisma

from app.core.errors.types import NotFound, ValidationFailed
from app.core.security.auth import Session
from app.domains.accounts.schemas import (
    AccountConnectionDTO, SyncResponse, SyncStateDTO,
)


def map_account(row) -> AccountConnectionDTO:
    """Convert a Prisma ``AccountConnection`` row (with sync_state) to DTO."""
    sync = None
    if row.sync_state is not None:
        s = row.sync_state
        sync = SyncStateDTO(
            syncStatus=s.syncStatus,
            lastSyncedAt=s.lastSyncedAt.isoformat() if s.lastSyncedAt else None,
            errorMessage=s.errorMessage, retryCount=s.retryCount,
        )
    return AccountConnectionDTO(
        id=row.id, userId=row.userId, provider=row.provider,
        providerAccountId=row.providerAccountId, emailAddress=row.emailAddress,
        displayName=row.displayName, status=row.status, syncState=sync,
        createdAt=row.createdAt.isoformat(),
    )


async def list_accounts(db: Prisma, session: Session) -> list[AccountConnectionDTO]:
    """Return every account owned by the session user, with sync state."""
    rows = await db.account_connection.find_many(
        where={"userId": session.user_id}, include={"sync_state": True},
    )
    return [map_account(r) for r in rows]


async def get_or_create_seed_account(
    db: Prisma, session: Session
) -> AccountConnectionDTO:
    """Return the demo seed account (no auto-seeding — defect D3)."""
    row = await db.account_connection.find_unique(
        where={"id": session.account_id}, include={"sync_state": True},
    )
    if row is None:
        raise NotFound("Account creation failed")
    return map_account(row)


async def sync_account(db: Prisma, session: Session, account_id: str) -> SyncResponse:
    """Mark the account's sync state as success (mirrors the Next.js demo)."""
    await _ensure_owned(db, session, account_id)
    await db.sync_state.update(
        where={"accountId": account_id},
        data={
            "syncStatus": "success",
            "lastSyncedAt": datetime.now(timezone.utc),
            "errorMessage": None, "retryCount": 0,
        },
    )
    return SyncResponse()


async def disconnect_account(
    db: Prisma, session: Session, account_id: str, confirm: bool
) -> None:
    """Soft-delete (mark disconnected) + audit event. Requires confirmation."""
    if not confirm:
        raise ValidationFailed(
            "Confirmation required", details={"needsConfirmation": True}
        )
    await _ensure_owned(db, session, account_id)
    await db.account_connection.update(
        where={"id": account_id}, data={"status": "disconnected"}
    )
    await db.audit_event.create(data={
        "userId": session.user_id, "accountId": account_id,
        "eventType": "ACCOUNT_DISCONNECTED", "targetType": "account",
        "targetId": account_id, "sourceSurface": "ui", "metadata": "{}",
    })


async def _ensure_owned(db: Prisma, session: Session, account_id: str) -> None:
    """Raise NotFound if the account doesn't exist or isn't owned."""
    account = await db.account_connection.find_unique(where={"id": account_id})
    if account is None or account.userId != session.user_id:
        raise NotFound("Account not found")
