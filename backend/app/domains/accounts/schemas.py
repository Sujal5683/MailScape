"""Pydantic schemas for the accounts domain.

Mirrors `AccountConnectionDTO` in `src/lib/types.ts`. The Prisma row's
``syncState`` relation is optional, so ``sync_state`` is nullable.
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SyncStateDTO(BaseModel):
    """Projection of a ``SyncState`` row."""

    sync_status: str = Field(alias="syncStatus")
    last_synced_at: str | None = Field(default=None, alias="lastSyncedAt")
    error_message: str | None = Field(default=None, alias="errorMessage")
    retry_count: int = Field(default=0, alias="retryCount")

    model_config = ConfigDict(populate_by_name=True)


class AccountConnectionDTO(BaseModel):
    """Public account shape returned by every account route."""

    id: str
    user_id: str = Field(alias="userId")
    provider: str
    provider_account_id: str = Field(alias="providerAccountId")
    email_address: str = Field(alias="emailAddress")
    display_name: str | None = Field(default=None, alias="displayName")
    status: str
    sync_state: SyncStateDTO | None = Field(default=None, alias="syncState")
    created_at: str = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


class SyncResponse(BaseModel):
    """Response for POST /accounts/{id}/sync."""

    ok: bool = True
    status: str = "success"


class DisconnectRequest(BaseModel):
    """Confirmation body for DELETE /accounts/{id}."""

    confirm: bool = False
