"""FastAPI router for the audit domain.

Thin handler delegating to :mod:`app.domains.audit.service`. Mounts:
- ``GET /audit-events`` — paginated account-scoped audit log

Query params:
- ``type``    — partial ``eventType`` match (e.g. ``EMAIL_``)
- ``surface`` — one of ``ui | ai | api | system``
- ``limit``   — page size (1-200, default 50)
- ``cursor``  — opaque id cursor for the next page
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from prisma import Prisma

from app.api.deps import get_db, get_session
from app.core.security.auth import Session
from app.domains.audit.schemas import AuditEventPage
from app.domains.audit.service import list_audit_events

router = APIRouter(tags=["audit"])


@router.get("/audit-events", response_model=AuditEventPage)
async def list_audit_events_route(
    type: str | None = Query(default=None, description="Partial eventType match"),
    surface: str | None = Query(
        default=None, description="Source surface: ui|ai|api|system"
    ),
    limit: int = Query(default=50, ge=1, le=200, description="Page size (1-200)"),
    cursor: str | None = Query(default=None, description="Opaque cursor for next page"),
    db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> AuditEventPage:
    """List audit events for the active account, newest first."""
    return await list_audit_events(
        db, session.account_id,
        type_prefix=type, surface=surface, limit=limit, cursor=cursor,
    )
