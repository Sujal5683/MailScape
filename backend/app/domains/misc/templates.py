"""Business logic for email templates (compose presets).

Account-scoped CRUD with category validation. Mirrors
`src/app/api/templates/route.ts` and `src/app/api/templates/[id]/route.ts`.
Categories are restricted to ``general | followup | request | announcement
| custom``; an unknown category is rejected with 400. Updates require at
least one field; an empty body is rejected with 400.
"""
from __future__ import annotations

import json

from prisma import Prisma

from app.core.errors.types import NotFound, ValidationFailed
from app.core.security.auth import Session
from app.domains.misc.mappers import coerce_category, map_template
from app.domains.misc.schemas import (
    ALLOWED_TEMPLATE_CATEGORIES, EmailTemplate, EmailTemplateCreate, EmailTemplateUpdate,
)


def _validate_name(name: str) -> str:
    """Trim + validate name length. Returns the trimmed name."""
    trimmed = name.strip()
    if not trimmed:
        raise ValidationFailed("Name cannot be empty")
    if len(trimmed) > 120:
        raise ValidationFailed("Name must be 120 characters or fewer")
    return trimmed


async def list_templates(db: Prisma, account_id: str, category: str | None = None) -> list[EmailTemplate]:
    """Return all templates for the account (optionally one category)."""
    where: dict = {"accountId": account_id}
    if category is not None:
        if category not in ALLOWED_TEMPLATE_CATEGORIES:
            raise ValidationFailed(f"Invalid category: {category}")
        where["category"] = category
    rows = await db.email_template.find_many(where=where, order_by={"updatedAt": "desc"})
    return [map_template(r) for r in rows]


async def create_template(db: Prisma, session: Session, body: EmailTemplateCreate) -> EmailTemplate:
    """Persist a new template + TEMPLATE_CREATED audit event."""
    name = _validate_name(body.name)
    category = coerce_category(body.category)
    row = await db.email_template.create(
        data={"accountId": session.account_id, "name": name,
              "subject": body.subject, "body": body.body, "category": category}
    )
    await _audit(db, session, "TEMPLATE_CREATED", row.id, {"name": name, "category": category})
    return map_template(row)


async def _owned(db: Prisma, account_id: str, template_id: str):
    row = await db.email_template.find_first(where={"id": template_id, "accountId": account_id})
    if row is None:
        raise NotFound("Template not found")
    return row


async def update_template(db: Prisma, session: Session, template_id: str, body: EmailTemplateUpdate) -> EmailTemplate:
    """Patch a template (≥1 field) + TEMPLATE_UPDATED audit event."""
    await _owned(db, session.account_id, template_id)
    data: dict = {}
    if body.name is not None:
        data["name"] = _validate_name(body.name)
    if body.subject is not None:
        data["subject"] = body.subject
    if body.body is not None:
        data["body"] = body.body
    if body.category is not None:
        data["category"] = coerce_category(body.category)
    if not data:
        raise ValidationFailed("No fields supplied for update")
    row = await db.email_template.update(where={"id": template_id}, data=data)
    await _audit(db, session, "TEMPLATE_UPDATED", template_id, data)
    return map_template(row)


async def delete_template(db: Prisma, session: Session, template_id: str) -> None:
    """Delete a template + TEMPLATE_DELETED audit event (404 if missing)."""
    row = await _owned(db, session.account_id, template_id)
    await db.email_template.delete(where={"id": row.id})
    await _audit(db, session, "TEMPLATE_DELETED", row.id, {"name": row.name, "category": row.category})


async def _audit(db: Prisma, session: Session, event_type: str, target_id: str, meta: dict) -> None:
    """Persist an audit event for a template-domain write."""
    await db.audit_event.create(data={
        "userId": session.user_id, "accountId": session.account_id,
        "eventType": event_type, "targetType": "email_template",
        "targetId": target_id, "sourceSurface": "ui", "metadata": json.dumps(meta)})
