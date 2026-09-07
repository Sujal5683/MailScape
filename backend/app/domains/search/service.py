"""Business logic for the search domain.

Account-scoped structured search + natural-language query parsing.
Mirrors `src/app/api/search/route.ts` and
`src/app/api/search/natural-language/route.ts`. SQLite-unfriendly filters
(labels, time-of-day, attachment type) are applied post-query in
:mod:`app.domains.search.filters`.
"""
from __future__ import annotations

from prisma import Prisma

from app.domains.search.filters import build_where, post_filter
from app.domains.search.schemas import (
    EmailListItem, NaturalLanguageResponse, SearchFilters, SearchResult,
)


def _map_email(row) -> EmailListItem:
    """Project a Prisma Email row → EmailListItem DTO."""
    return EmailListItem(
        id=row.id, subject=row.subject, fromEmail=row.fromEmail,
        fromName=row.fromName,
        receivedAt=row.receivedAt.isoformat() if row.receivedAt else None,
        isRead=row.isRead, isStarred=row.isStarred, isImportant=row.isImportant,
        hasAttachment=row.hasAttachment, snippet=row.snippet,
    )


async def structured_search(
    db: Prisma, account_id: str, f: SearchFilters
) -> SearchResult:
    """Execute a structured search; returns paginated items + total."""
    limit = min(f.limit, 100)
    where = build_where(account_id, f)
    find_kwargs: dict = {
        "where": where,
        "include": {"attachments": True, "memberships": {"include": {"category": True}}},
        "order_by": {"receivedAt": "desc"},
        "take": limit + 1,
    }
    if f.cursor:
        find_kwargs["skip"] = 1
        find_kwargs["cursor"] = {"id": f.cursor}
    rows = await db.email.find_many(**find_kwargs)
    rows = post_filter(rows, f)
    next_cursor = rows[limit - 1].id if len(rows) > limit else None
    return SearchResult(
        items=[_map_email(r) for r in rows[:limit]],
        nextCursor=next_cursor, total=len(rows), parsedFilters=f,
    )


async def natural_language_search(
    db: Prisma, account_id: str, query: str
) -> NaturalLanguageResponse:
    """Convert a natural-language query into structured filters via the LLM."""
    if not query.strip():
        return NaturalLanguageResponse(parsed=SearchFilters(), summary="Empty query")
    categories = await db.category.find_many(
        where={"accountId": account_id}, select={"id": True, "name": True}
    )
    parsed, summary = await _llm_parse(query, categories)
    if parsed.categoryIds:
        valid = {c.id for c in categories}
        parsed.categoryIds = [cid for cid in parsed.categoryIds if cid in valid]
    return NaturalLanguageResponse(parsed=parsed, summary=summary)


async def _llm_parse(query: str, categories) -> tuple[SearchFilters, str]:
    """Call the LLM to parse the query. TODO: wire to app.integrations.gemini.

    Falls back to a simple keyword search when the LLM integration is not
    available yet (mirrors the Next.js try/catch fallback).
    """
    # TODO: from app.integrations.gemini import chat; await chat([...]).
    return SearchFilters(query=query), query
