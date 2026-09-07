"""Mappers + category helpers for the email templates domain.

Category enum is restricted to ``general | followup | request |
announcement | custom``; an unknown value is rejected on write and
coerced to ``custom`` on read (defensive — the API never allows that
today, but a future schema migration could leave stray rows).
"""
from __future__ import annotations

from app.core.errors.types import ValidationFailed
from app.domains.misc.schemas import ALLOWED_TEMPLATE_CATEGORIES, EmailTemplate


def coerce_category(value: str | None) -> str:
    """Default to 'general' when none supplied; validate otherwise."""
    if value is None:
        return "general"
    if value not in ALLOWED_TEMPLATE_CATEGORIES:
        raise ValidationFailed(f"Invalid category: {value}")
    return value


def map_template(row) -> EmailTemplate:
    """Project a Prisma EmailTemplate row → EmailTemplate DTO."""
    category = row.category if row.category in ALLOWED_TEMPLATE_CATEGORIES else "custom"
    return EmailTemplate(
        id=row.id, accountId=row.accountId, name=row.name, subject=row.subject,
        body=row.body, category=category,
        createdAt=row.createdAt.isoformat(), updatedAt=row.updatedAt.isoformat(),
    )
