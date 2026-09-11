"""Shared FastAPI dependencies.

Provides:
- ``get_db``         — async Prisma client.
- ``get_session``    — resolved caller identity + account (JWT-aware).
- ``get_account_id`` — convenience: just the active account id.
- ``pagination``     — common cursor + limit pagination query params.
"""
from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, Header, Query
from prisma import Prisma

from app.core.security.auth import Session
from app.core.security.auth import get_session as _get_session
from app.db import get_client


async def get_db() -> Prisma:
    """Yield the singleton Prisma client.

    The client is opened on app startup and closed on shutdown; per-request
    code just borrows the shared connection.
    """
    return get_client()


async def get_session(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> Session:
    """Resolve the current session.

    Reads the ``Authorization: Bearer <token>`` header (if present) and
    validates it against the Supabase JWT secret. Falls back to the seed
    demo account when the header is absent or validation fails.
    """
    return await _get_session(authorization=authorization)


async def get_account_id(session: Session = Depends(get_session)) -> str:
    """Return the active account id derived from the session."""
    return session.account_id


@dataclass(frozen=True)
class PaginationParams:
    """Cursor pagination params shared by all list endpoints."""

    cursor: str | None
    limit: int


def pagination(
    cursor: str | None = Query(
        default=None, description="Opaque cursor for the next page"
    ),
    limit: int = Query(
        default=50, ge=1, le=200, description="Page size (1-200)"
    ),
) -> PaginationParams:
    """FastAPI dependency producing :class:`PaginationParams`."""
    return PaginationParams(cursor=cursor, limit=limit)
