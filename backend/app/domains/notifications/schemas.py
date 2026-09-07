"""Pydantic schemas for the notifications domain.

Mirrors `Notification`, `NotificationGroup` in `src/lib/types.ts` and the
preference DTOs implied by `notification-preferences/route.ts`. Channels
default to in_app/web enabled, push disabled.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class Notification(BaseModel):
    """A single notification row."""

    id: str
    accountId: str = Field(alias="accountId")
    emailId: str | None = None
    categoryId: str | None = None
    title: str
    body: str | None = None
    importance: str = "normal"
    isRead: bool = False
    createdAt: str
    categoryName: str | None = None
    categoryColor: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class NotificationGroup(BaseModel):
    """Notifications grouped by category for the bell panel."""

    key: str
    label: str
    color: str = "slate"
    icon: str = "inbox"
    count: int = 0
    unreadCount: int = 0
    items: list[Notification] = Field(default_factory=list)


class PreferenceRow(BaseModel):
    """A single (channel, categoryId) effective preference row."""

    categoryId: str
    enabled: bool


class NotificationChannelPrefs(BaseModel):
    """Per-channel effective preferences (global + every category)."""

    channel: str
    preferences: list[PreferenceRow]


class NotificationPreferences(BaseModel):
    """Response for GET /notification-preferences."""

    channels: list[NotificationChannelPrefs]


class NotificationPrefUpdate(BaseModel):
    """Body for PUT /notification-preferences."""

    channel: str
    categoryId: str | None = None
    enabled: bool
