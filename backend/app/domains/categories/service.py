"""Business logic for the categories domain.

Account-scoped helpers wrapping Prisma reads + the audit-side-effect writes
that mirror `src/app/api/categories/**/route.ts`. Deleting a category moves
its memberships to the "Others" category first (mirrors the Next.js route).
"""
from __future__ import annotations

import json

from prisma import Prisma

from app.core.errors.types import NotFound, ValidationFailed
from app.core.security.auth import Session
from app.domains.categories.mappers import map_category
from app.domains.categories.schemas import (
    CategoryCreate, CategorySummary, CategoryUpdate,
)

_INCLUDE = {
    "memberships": {
        "include": {"email": {"select": {"isRead": True, "isImportant": True, "receivedAt": True}}},
    },
    "_count": {"select": {"memberships": True}},
}


async def list_categories(db: Prisma, account_id: str) -> list[CategorySummary]:
    """List every category for the account with counts + activity."""
    rows = await db.category.find_many(
        where={"accountId": account_id}, include=_INCLUDE,
        order={"sortOrder": "asc"},
    )
    return [map_category(r) for r in rows]


async def create_category(
    db: Prisma, session: Session, body: CategoryCreate,
) -> CategorySummary:
    """Create a custom category (rejects duplicate names)."""
    name = body.name.strip()
    if not name:
        raise ValidationFailed("Name is required")
    existing = await db.category.find_first(
        where={"accountId": session.account_id, "name": name},
    )
    if existing is not None:
        raise ValidationFailed("Category already exists")
    agg = await db.category.aggregate(
        where={"accountId": session.account_id}, _max={"sortOrder": True},
    )
    next_order = (agg._max.sortOrder or 0) + 1 if agg._max else 1
    cat = await db.category.create(
        data={
            "accountId": session.account_id, "name": name,
            "description": body.description, "color": body.color,
            "icon": body.icon, "sortOrder": next_order, "systemDefault": False,
        },
        include=_INCLUDE,
    )
    await db.auditevent.create(data={
        "userId": session.user_id, "accountId": session.account_id,
        "eventType": "CATEGORY_CREATED", "targetType": "category",
        "targetId": cat.id, "sourceSurface": "ui",
        "metadata": json.dumps({"name": cat.name}),
    })
    return map_category(cat)


async def _get_owned(db: Prisma, account_id: str, category_id: str):
    """Return the owned category or raise NotFound."""
    cat = await db.category.find_first(
        where={"id": category_id, "accountId": account_id}
    )
    if cat is None:
        raise NotFound("Category not found")
    return cat


async def update_category(
    db: Prisma, session: Session, category_id: str, body: CategoryUpdate,
) -> CategorySummary:
    """Update name/description/color/icon on an owned category."""
    await _get_owned(db, session.account_id, category_id)
    data = body.model_dump(exclude_unset=True)
    cat = await db.category.update(
        where={"id": category_id}, data=data, include=_INCLUDE,
    )
    await db.auditevent.create(data={
        "userId": session.user_id, "accountId": session.account_id,
        "eventType": "CATEGORY_UPDATED", "targetType": "category",
        "targetId": category_id, "sourceSurface": "ui",
        "metadata": json.dumps(data),
    })
    return map_category(cat)


async def delete_category(db: Prisma, session: Session, category_id: str) -> None:
    """Delete a category; move memberships to "Others" first. Audit + return."""
    cat = await _get_owned(db, session.account_id, category_id)
    if cat.systemDefault:
        raise ValidationFailed("System categories cannot be deleted")
    others = await db.category.find_first(
        where={"accountId": session.account_id, "name": "Others"},
    )
    if others is not None:
        await db.categorymembership.update_many(
            where={"categoryId": category_id},
            data={"categoryId": others.id, "source": "system_default"},
        )
    await db.category.delete(where={"id": category_id})
    await db.auditevent.create(data={
        "userId": session.user_id, "accountId": session.account_id,
        "eventType": "CATEGORY_DELETED", "targetType": "category",
        "targetId": category_id, "sourceSurface": "ui",
        "metadata": json.dumps({"name": cat.name}),
    })
