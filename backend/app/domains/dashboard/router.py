"""FastAPI router for the dashboard domain.

Mounts (under ``/api/v1``):
- GET /dashboard
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from prisma import Prisma

from app.api.deps import get_account_id, get_db
from app.domains.dashboard.schemas import DashboardData
from app.domains.dashboard.service import get_dashboard

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardData)
async def get_dashboard_route(
    db: Prisma = Depends(get_db),
    account_id: str = Depends(get_account_id),
) -> DashboardData:
    """Return the aggregated operational dashboard view."""
    return await get_dashboard(db, account_id)
