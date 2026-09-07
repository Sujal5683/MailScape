"""Business logic for the audit domain.

Account-scoped paginated listing of audit events. Mirrors
`src/app/api/audit-events/route.ts` — including the metadata-JSON parse
fallback (a corrupt row gets an empty dict, never 500s the request).

Pagination: ordered by ``createdAt desc, id desc``; cursor is the last
item's id (with skip=1). The total count is computed in parallel with
the page fetch.
"""
from __future__ import annotations

import json

from prisma import Prisma

from app.domains.audit.schemas import AuditEventDTO, AuditEventPage

_VALID_SURFACES = {"ui", "ai", "api", "system"}


def _map(row) -> AuditEventDTO:
    """Project a Prisma AuditEvent row → AuditEventDTO (parses metadata JSON)."""
    metadata: dict = {}
    try:
        parsed = json.loads(row.metadata or "{}")
        if isinstance(parsed, dict) and not isinstance(parsed, list):
            metadata = parsed
    except Exception:
        metadata = {}
    surface = row.sourceSurface if row.sourceSurface in _VALID_SURFACES else None
    return AuditEventDTO(
        id=row.id, eventType=row.eventType, targetType=row.targetType,
        targetId=row.targetId, sourceSurface=surface, actionId=row.actionId,
        metadata=metadata, createdAt=row.createdAt.isoformat(),
    )


async def list_audit_events(
    db: Prisma, account_id: str, *,
    type_prefix: str | None = None, surface: str | None = None,
    limit: int = 50, cursor: str | None = None,
) -> AuditEventPage:
    """Return one page of audit events for the account."""
    where: dict = {"accountId": account_id}
    if type_prefix:
        where["eventType"] = {"contains": type_prefix}
    if surface in _VALID_SURFACES:
        where["sourceSurface"] = surface
    find_kwargs: dict = {
        "where": where,
        "order_by": [{"createdAt": "desc"}, {"id": "desc"}],
        "take": limit + 1,
    }
    if cursor:
        find_kwargs["skip"] = 1
        find_kwargs["cursor"] = {"id": cursor}
    rows, total = await db.audit_event.find_many(**find_kwargs), await db.audit_event.count(where=where)
    next_cursor = rows[limit - 1].id if len(rows) > limit else None
    return AuditEventPage(
        items=[_map(r) for r in rows[:limit]],
        nextCursor=next_cursor, total=total,
    )
