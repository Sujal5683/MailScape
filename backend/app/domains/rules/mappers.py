"""Mappers for the rules domain.

Project a Prisma `Rule` row to the public Rule DTO. The `expression`
and `actions` columns store JSON strings; this module parses them
defensively (defaults to an empty group / empty list on parse failure
so a corrupt row never breaks the listing endpoint).
"""
from __future__ import annotations

import json

from app.domains.rules.schemas import ConditionGroup, Rule, RuleAction


def map_rule(row) -> Rule:
    """Project a Prisma Rule row → Rule DTO."""
    try:
        expression = ConditionGroup.model_validate_json(row.expression)
    except Exception:
        expression = ConditionGroup(combinator="AND", conditions=[])
    try:
        actions = [RuleAction.model_validate(a) for a in json.loads(row.actions)]
    except Exception:
        actions = []
    return Rule(
        id=row.id,
        accountId=row.accountId,
        name=row.name,
        expression=expression,
        actions=actions,
        priority=row.priority,
        enabled=row.enabled,
        createdBy=row.createdBy,
        hitCount=row.hitCount,
        createdAt=row.createdAt.isoformat(),
        updatedAt=row.updatedAt.isoformat(),
    )
