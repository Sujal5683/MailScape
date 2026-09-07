"""FastAPI router for the misc domain (saved searches + templates).

Thin handlers delegating to :mod:`app.domains.misc.saved_searches` and
:mod:`app.domains.misc.templates`. Mounts:
- ``GET    /saved-searches``         — list presets
- ``POST   /saved-searches``         — create preset
- ``DELETE /saved-searches/{id}``    — delete preset
- ``GET    /templates``              — list templates (optional ?category)
- ``POST   /templates``              — create template
- ``PUT    /templates/{id}``         — update template
- ``DELETE /templates/{id}``         — delete template
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from prisma import Prisma

from app.api.deps import get_db, get_session
from app.core.security.auth import Session
from app.domains.misc.schemas import (
    EmailTemplate, EmailTemplateCreate, EmailTemplateUpdate,
    SavedSearch, SavedSearchCreate,
)
from app.domains.misc.saved_searches import (
    create_saved_search, delete_saved_search, list_saved_searches,
)
from app.domains.misc.templates import (
    create_template, delete_template, list_templates, update_template,
)

router = APIRouter(tags=["misc"])


@router.get("/saved-searches", response_model=list[SavedSearch])
async def list_saved_searches_route(
    db: Prisma = Depends(get_db), session: Session = Depends(get_session),
) -> list[SavedSearch]:
    """List saved searches for the active account."""
    return await list_saved_searches(db, session.account_id)


@router.post("/saved-searches", response_model=SavedSearch, status_code=201)
async def create_saved_search_route(
    body: SavedSearchCreate, db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> SavedSearch:
    """Save a new filter preset. Emits SAVED_SEARCH_CREATED audit."""
    return await create_saved_search(db, session, body)


@router.delete("/saved-searches/{saved_search_id}")
async def delete_saved_search_route(
    saved_search_id: str, db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    """Delete a saved search. Emits SAVED_SEARCH_DELETED audit."""
    await delete_saved_search(db, session, saved_search_id)
    return {"ok": True}


@router.get("/templates", response_model=list[EmailTemplate])
async def list_templates_route(
    category: str | None = Query(default=None, description="Filter by category"),
    db: Prisma = Depends(get_db), session: Session = Depends(get_session),
) -> list[EmailTemplate]:
    """List email templates for the active account."""
    return await list_templates(db, session.account_id, category)


@router.post("/templates", response_model=EmailTemplate, status_code=201)
async def create_template_route(
    body: EmailTemplateCreate, db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> EmailTemplate:
    """Create a new email template. Emits TEMPLATE_CREATED audit."""
    return await create_template(db, session, body)


@router.put("/templates/{template_id}", response_model=EmailTemplate)
async def update_template_route(
    template_id: str, body: EmailTemplateUpdate,
    db: Prisma = Depends(get_db), session: Session = Depends(get_session),
) -> EmailTemplate:
    """Update an existing template. Emits TEMPLATE_UPDATED audit."""
    return await update_template(db, session, template_id, body)


@router.delete("/templates/{template_id}")
async def delete_template_route(
    template_id: str, db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    """Delete a template. Emits TEMPLATE_DELETED audit."""
    await delete_template(db, session, template_id)
    return {"ok": True}
