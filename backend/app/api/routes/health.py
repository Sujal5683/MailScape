"""Health endpoints.

- ``GET /health`` — process is alive (liveness probe).
- ``GET /ready`` — dependencies are ready (readiness probe, checks DB).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from prisma import Prisma

from app.api.deps import get_db

router = APIRouter(tags=["health"])


@router.get("/health", summary="Liveness probe")
async def health() -> dict[str, str]:
    """Return 200 if the process is alive."""
    return {"status": "ok"}


@router.get("/ready", summary="Readiness probe")
async def ready(db: Prisma = Depends(get_db)) -> dict[str, str]:
    """Return 200 only when the DB connection is usable."""
    try:
        await db.user.count()
    except Exception as exc:  # noqa: BLE001 — best-effort readiness signal
        return {"status": "degraded", "db": str(exc)}
    return {"status": "ok", "db": "connected"}
