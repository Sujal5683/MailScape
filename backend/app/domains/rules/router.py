"""FastAPI router for the rules domain.

Thin handlers delegating to :mod:`app.domains.rules.service`. Mounts:
- ``GET    /rules``        — list rules
- ``POST   /rules``        — create rule
- ``PATCH  /rules/{id}``   — update rule
- ``DELETE /rules/{id}``   — delete rule
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from prisma import Prisma

from app.api.deps import get_db, get_session
from app.core.security.auth import Session
from app.domains.rules.schemas import Rule, RuleCreate, RuleUpdate
from app.domains.rules.service import create_rule, delete_rule, list_rules, update_rule

router = APIRouter(tags=["rules"])


@router.get("/rules", response_model=list[Rule])
async def list_rules_route(
    db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> list[Rule]:
    """List all rules for the active account, ordered by priority."""
    return await list_rules(db, session.account_id)


@router.post("/rules", response_model=Rule, status_code=201)
async def create_rule_route(
    body: RuleCreate,
    db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> Rule:
    """Create a new rule. Emits RULE_CREATED audit + version v1 snapshot."""
    return await create_rule(db, session, body)


@router.patch("/rules/{rule_id}", response_model=Rule)
async def update_rule_route(
    rule_id: str,
    body: RuleUpdate,
    db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> Rule:
    """Patch a rule. Bumps a new RuleVersion when expression/actions change."""
    return await update_rule(db, session, rule_id, body)


@router.delete("/rules/{rule_id}")
async def delete_rule_route(
    rule_id: str,
    db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    """Delete a rule. Emits RULE_DELETED audit event."""
    await delete_rule(db, session, rule_id)
    return {"ok": True}
