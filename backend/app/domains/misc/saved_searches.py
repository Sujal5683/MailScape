"""Business logic for saved searches (filter presets).

Account-scoped list/create/delete. Mirrors
`src/app/api/saved-searches/route.ts` and
`src/app/api/saved-searches/[id]/route.ts`. The filters payload is
persisted as a JSON string; the service sanitizes the payload (drops
unknown keys) before persisting so a malformed client can't inject
arbitrary state.
"""
from __future__ import annotations

import json

from prisma import Prisma

from app.core.errors.types import NotFound, ValidationFailed
from app.core.security.auth import Session
from app.domains.misc.schemas import ALLOWED_FILTER_KEYS, SavedSearch, SavedSearchCreate
from app.domains.search.schemas import SearchFilters


def _sanitize_filters(raw: dict) -> SearchFilters:
    """Keep only whitelisted SearchFilters keys; reject non-dict payloads."""
    if not isinstance(raw, dict):
        raise ValidationFailed("filters must be an object")
    clean = {k: v for k, v in raw.items() if k in ALLOWED_FILTER_KEYS}
    return SearchFilters.model_validate(clean)


def _map(row) -> SavedSearch:
    """Project a Prisma SavedSearch row → SavedSearch DTO."""
    try:
        filters = SearchFilters.model_validate(json.loads(row.filters))
    except Exception:
        filters = SearchFilters()
    return SavedSearch(
        id=row.id, accountId=row.accountId, name=row.name, filters=filters,
        createdAt=row.createdAt.isoformat(), updatedAt=row.updatedAt.isoformat(),
    )


async def list_saved_searches(db: Prisma, account_id: str) -> list[SavedSearch]:
    """Return all saved searches for the account, newest first."""
    rows = await db.savedsearch.find_many(
        where={"accountId": account_id}, order_by={"createdAt": "desc"}
    )
    return [_map(r) for r in rows]


async def create_saved_search(
    db: Prisma, session: Session, body: SavedSearchCreate
) -> SavedSearch:
    """Persist a new saved search + SAVED_SEARCH_CREATED audit event."""
    name = body.name.strip()
    if not name:
        raise ValidationFailed("Name is required")
    if len(name) > 120:
        raise ValidationFailed("Name must be 120 characters or fewer")
    filters = _sanitize_filters(body.filters.model_dump(exclude_none=True))
    row = await db.savedsearch.create(
        data={
            "accountId": session.account_id, "name": name,
            "filters": filters.model_dump_json(exclude_none=True),
        }
    )
    await db.auditevent.create(
        data={"userId": session.user_id, "accountId": session.account_id,
              "eventType": "SAVED_SEARCH_CREATED", "targetType": "saved_search",
              "targetId": row.id, "sourceSurface": "ui",
              "metadata": json.dumps({"name": name})}
    )
    return _map(row)


async def delete_saved_search(
    db: Prisma, session: Session, saved_search_id: str
) -> None:
    """Delete a saved search + SAVED_SEARCH_DELETED audit event (404 if missing)."""
    row = await db.savedsearch.find_first(
        where={"id": saved_search_id, "accountId": session.account_id}
    )
    if row is None:
        raise NotFound("Saved search not found")
    await db.savedsearch.delete(where={"id": row.id})
    await db.auditevent.create(
        data={"userId": session.user_id, "accountId": session.account_id,
              "eventType": "SAVED_SEARCH_DELETED", "targetType": "saved_search",
              "targetId": row.id, "sourceSurface": "ui",
              "metadata": json.dumps({"name": row.name})}
    )
