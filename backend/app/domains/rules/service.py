"""Business logic for the rules domain.

Account-scoped CRUD on rules with version snapshots and audit events.
Mirrors `src/app/api/rules/route.ts` and `src/app/api/rules/[ruleId]/route.ts`:
- create → row + RuleVersion v1 + RULE_CREATED audit event
- update → row + next RuleVersion (only if expression/actions changed) +
           RULE_UPDATED audit event
- delete → row delete + RULE_DELETED audit event
"""
from __future__ import annotations

import json

from prisma import Prisma

from app.core.errors.types import NotFound, ValidationFailed
from app.core.security.auth import Session
from app.domains.rules.mappers import map_rule
from app.domains.rules.schemas import Rule, RuleCreate, RuleUpdate


async def list_rules(db: Prisma, account_id: str) -> list[Rule]:
    """Return all rules for the account, ordered by priority asc."""
    rows = await db.rule.find_many(
        where={"accountId": account_id}, order_by={"priority": "asc"}
    )
    return [map_rule(r) for r in rows]


async def _owned(db: Prisma, account_id: str, rule_id: str):
    row = await db.rule.find_first(where={"id": rule_id, "accountId": account_id})
    if row is None:
        raise NotFound("Rule not found")
    return row


async def create_rule(db: Prisma, session: Session, body: RuleCreate) -> Rule:
    """Create a rule + initial version snapshot + audit event."""
    if not body.name.strip():
        raise ValidationFailed("Name is required")
    if not body.actions:
        raise ValidationFailed("Expression and actions are required")
    rule = await db.rule.create(
        data={
            "accountId": session.account_id, "name": body.name.strip(),
            "expression": body.expression.model_dump_json(),
            "actions": json.dumps([a.model_dump() for a in body.actions]),
            "priority": body.priority, "enabled": body.enabled, "createdBy": "user",
        }
    )
    await db.rule_version.create(
        data={"ruleId": rule.id, "version": 1, "expression": rule.expression, "actions": rule.actions}
    )
    await _audit(db, session, "RULE_CREATED", rule.id, {"name": rule.name, "ruleId": rule.id})
    return map_rule(rule)


async def update_rule(db: Prisma, session: Session, rule_id: str, body: RuleUpdate) -> Rule:
    """Patch a rule; bump RuleVersion when expression/actions changed."""
    await _owned(db, session.account_id, rule_id)
    data: dict = {}
    if body.name is not None:
        data["name"] = body.name
    if body.expression is not None:
        data["expression"] = body.expression.model_dump_json()
    if body.actions is not None:
        data["actions"] = json.dumps([a.model_dump() for a in body.actions])
    if body.priority is not None:
        data["priority"] = body.priority
    if body.enabled is not None:
        data["enabled"] = body.enabled
    updated = await db.rule.update(where={"id": rule_id}, data=data)
    if body.expression or body.actions:
        agg = await db.rule_version.aggregate(where={"ruleId": rule_id}, _max={"version": True})
        await db.rule_version.create(
            data={"ruleId": rule_id, "version": (agg._max.version or 0) + 1,
                  "expression": updated.expression, "actions": updated.actions}
        )
    await _audit(db, session, "RULE_UPDATED", rule_id, body.model_dump(exclude_none=True))
    return map_rule(updated)


async def delete_rule(db: Prisma, session: Session, rule_id: str) -> None:
    """Delete a rule + audit event."""
    existing = await _owned(db, session.account_id, rule_id)
    await db.rule.delete(where={"id": rule_id})
    await _audit(db, session, "RULE_DELETED", rule_id, {"name": existing.name})


async def _audit(db: Prisma, session: Session, event_type: str, target_id: str, meta: dict) -> None:
    """Persist an audit event for a rule write."""
    await db.audit_event.create(
        data={
            "userId": session.user_id, "accountId": session.account_id,
            "eventType": event_type, "targetType": "rule", "targetId": target_id,
            "sourceSurface": "ui", "metadata": json.dumps(meta),
        }
    )
