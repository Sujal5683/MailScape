"""FastAPI router for the categories domain.

Mounts (all under ``/api/v1``):
- GET    /categories
- POST   /categories
- PATCH  /categories/{category_id}
- DELETE /categories/{category_id}
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from prisma import Prisma

from app.api.deps import get_account_id, get_db, get_session
from app.core.security.auth import Session
from app.domains.categories.schemas import (
    CategoryCreate, CategorySummary, CategoryUpdate,
)
from app.domains.categories.service import (
    create_category, delete_category, list_categories, update_category,
)

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategorySummary])
async def get_categories(
    db: Prisma = Depends(get_db),
    account_id: str = Depends(get_account_id),
) -> list[CategorySummary]:
    """List every category for the active account with counts."""
    return await list_categories(db, account_id)


@router.post(
    "", response_model=CategorySummary,
    status_code=status.HTTP_201_CREATED,
)
async def post_category(
    body: CategoryCreate,
    db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> CategorySummary:
    """Create a new custom category."""
    return await create_category(db, session, body)


@router.patch("/{category_id}", response_model=CategorySummary)
async def patch_category(
    category_id: str,
    body: CategoryUpdate,
    db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> CategorySummary:
    """Update a category's name/description/color/icon."""
    return await update_category(db, session, category_id, body)


@router.delete("/{category_id}", status_code=status.HTTP_200_OK)
async def remove_category(
    category_id: str,
    db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    """Delete a category (memberships move to "Others"). Audit + return."""
    await delete_category(db, session, category_id)
    return {"ok": True}
