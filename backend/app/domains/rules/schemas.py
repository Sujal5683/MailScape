"""Pydantic schemas for the rules domain.

Mirrors `Rule`, `ConditionGroup`, `RuleAction` in `src/lib/types.ts`. The
Prisma `expression` and `actions` columns store JSON strings; the public
API exposes them as structured objects.
"""
from __future__ import annotations

from typing import Union

from pydantic import BaseModel, ConfigDict, Field


class Condition(BaseModel):
    """A single rule predicate (field/op/value)."""

    field: str
    op: str
    value: Union[str, int, float, bool, list[str]]


class ConditionGroup(BaseModel):
    """Recursive AND/OR group of conditions. Self-referential."""

    combinator: str = "AND"
    conditions: list["Condition | ConditionGroup"] = Field(default_factory=list)


ConditionGroup.model_rebuild()


class RuleAction(BaseModel):
    """An action performed when a rule's expression matches."""

    type: str
    categoryId: str | None = None
    label: str | None = None
    deadlineTitle: str | None = None


class Rule(BaseModel):
    """Public rule shape returned by every rule route."""

    id: str
    accountId: str = Field(alias="accountId")
    name: str
    expression: ConditionGroup
    actions: list[RuleAction]
    priority: int = 100
    enabled: bool = True
    createdBy: str = "user"
    hitCount: int = 0
    createdAt: str
    updatedAt: str

    model_config = ConfigDict(populate_by_name=True)


class RuleCreate(BaseModel):
    """Body for POST /rules."""

    name: str
    expression: ConditionGroup
    actions: list[RuleAction]
    priority: int = 100
    enabled: bool = True


class RuleUpdate(BaseModel):
    """Body for PATCH /rules/{id} — all fields optional."""

    name: str | None = None
    expression: ConditionGroup | None = None
    actions: list[RuleAction] | None = None
    priority: int | None = None
    enabled: bool | None = None


__all__ = [
    "Condition",
    "ConditionGroup",
    "RuleAction",
    "Rule",
    "RuleCreate",
    "RuleUpdate",
]
