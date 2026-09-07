"""FastAPI router for the search domain.

Thin handlers delegating to :mod:`app.domains.search.service`. Mounts:
- ``POST /search``                       — structured filter search
- ``POST /search/natural-language``      — NL query → structured filters
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from prisma import Prisma

from app.api.deps import get_db, get_session
from app.core.security.auth import Session
from app.domains.search.schemas import (
    NaturalLanguageRequest,
    NaturalLanguageResponse,
    SearchFilters,
    SearchResult,
)
from app.domains.search.service import natural_language_search, structured_search

router = APIRouter(tags=["search"])


@router.post("/search", response_model=SearchResult)
async def structured_search_route(
    body: SearchFilters,
    db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> SearchResult:
    """Run a structured filter search against the account's emails."""
    return await structured_search(db, session.account_id, body)


@router.post("/search/natural-language", response_model=NaturalLanguageResponse)
async def natural_language_search_route(
    body: NaturalLanguageRequest,
    db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> NaturalLanguageResponse:
    """Convert a natural-language query into structured filters via the LLM."""
    return await natural_language_search(db, session.account_id, body.query)
