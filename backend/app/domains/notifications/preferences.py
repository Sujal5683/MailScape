"""Business logic for notification preferences.

Mirrors `src/app/api/notification-preferences/route.ts`. Channels are
`in_app`, `web`, `push`. Per-channel defaults: in_app/web enabled,
push disabled. Missing (channel, categoryId) rows inherit the channel's
effective global default so the UI can render every row without a lookup.
"""
from __future__ import annotations

import json

from prisma import Prisma

from app.core.errors.types import NotFound, ValidationFailed
from app.core.security.auth import Session
from app.domains.notifications.schemas import (
    NotificationChannelPrefs,
    NotificationPreferences,
    NotificationPrefUpdate,
    PreferenceRow,
)

VALID_CHANNELS = ("in_app", "web", "push")
CHANNEL_DEFAULTS = {"in_app": True, "web": True, "push": False}


async def get_preferences(db: Prisma, account_id: str) -> NotificationPreferences:
    """Return effective preferences for every channel × (global + categories)."""
    rows, categories = await _load(db, account_id)
    by_key = {(r.channel, r.categoryId or "__global__"): r.enabled for r in rows}
    channels: list[NotificationChannelPrefs] = []
    for ch in VALID_CHANNELS:
        ch_default = by_key.get((ch, "__global__"), CHANNEL_DEFAULTS[ch])
        prefs = [PreferenceRow(categoryId="__global__", enabled=ch_default)]
        for c in categories:
            explicit = by_key.get((ch, c.id))
            prefs.append(PreferenceRow(categoryId=c.id, enabled=explicit if explicit is not None else ch_default))
        channels.append(NotificationChannelPrefs(channel=ch, preferences=prefs))
    return NotificationPreferences(channels=channels)


async def update_preference(
    db: Prisma, session: Session, body: NotificationPrefUpdate
) -> None:
    """Upsert one (channel, categoryId) preference row + audit event."""
    if body.channel not in VALID_CHANNELS:
        raise ValidationFailed("Invalid channel — must be one of in_app, web, push")
    category_id = body.categoryId
    if category_id:
        cat = await db.category.find_first(
            where={"id": category_id, "accountId": session.account_id}
        )
        if cat is None:
            raise NotFound("Category not found")
    existing = await db.notificationpreference.find_first(
        where={"accountId": session.account_id, "channel": body.channel, "categoryId": category_id}
    )
    if existing:
        row = await db.notificationpreference.update(
            where={"id": existing.id}, data={"enabled": body.enabled}
        )
    else:
        row = await db.notificationpreference.create(
            data={
                "accountId": session.account_id, "channel": body.channel,
                "categoryId": category_id, "enabled": body.enabled,
            }
        )
    await db.auditevent.create(
        data={
            "userId": session.user_id, "accountId": session.account_id,
            "eventType": "NOTIFICATION_PREF_UPDATED",
            "targetType": "notification_preference", "targetId": row.id,
            "sourceSurface": "ui",
            "metadata": json.dumps({"channel": body.channel, "categoryId": category_id, "enabled": body.enabled}),
        }
    )


async def _load(db: Prisma, account_id: str):
    rows = await db.notificationpreference.find_many(where={"accountId": account_id})
    categories = await db.category.find_many(
        where={"accountId": account_id}, order_by={"sortOrder": "asc"}
    )
    return rows, categories
