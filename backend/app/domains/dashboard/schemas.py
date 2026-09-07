"""Pydantic schemas for the dashboard domain.

Mirrors `DashboardData` in `src/lib/types.ts`. Aggregates computed by the
service are projected into these typed shapes for the OpenAPI response.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

_Cfg = ConfigDict(populate_by_name=True)


class KPITotals(BaseModel):
    """Top-line counts surfaced at the top of the dashboard."""

    emails: int
    unread: int
    important: int
    attachments: int
    senders: int
    categories: int
    deadlines_open: int = Field(alias="deadlinesOpen")
    notifications_unread: int = Field(alias="notificationsUnread")
    model_config = _Cfg


class CategoryCount(BaseModel):
    """Category count row for the category breakdown widget."""

    id: str
    name: str
    color: str
    icon: str
    count: int
    unread: int


class TrendPoint(BaseModel):
    """A single day in the 14-day email-volume trend."""

    date: str
    count: int


class TopSender(BaseModel):
    """A high-volume sender (top 6 by message count)."""

    id: str
    name: str
    email: str
    count: int
    domain: str | None = None


class DeadlineRow(BaseModel):
    """Open deadline with email subject + category name/color."""

    id: str
    title: str
    due_at: str | None = Field(default=None, alias="dueAt")
    status: str
    email_subject: str | None = Field(default=None, alias="emailSubject")
    category_name: str | None = Field(default=None, alias="categoryName")
    category_color: str | None = Field(default=None, alias="categoryColor")
    model_config = _Cfg


class ActionItemRow(BaseModel):
    """Open action item."""

    id: str
    title: str
    status: str
    due_at: str | None = Field(default=None, alias="dueAt")
    model_config = _Cfg


class RecentActivityRow(BaseModel):
    """Recent email for the activity feed."""

    id: str
    subject: str | None = None
    from_email: str = Field(alias="fromEmail")
    received_at: str | None = Field(default=None, alias="receivedAt")
    category_name: str | None = Field(default=None, alias="categoryName")
    category_color: str | None = Field(default=None, alias="categoryColor")
    model_config = _Cfg


class AIBriefHighlight(BaseModel):
    """Single highlight label/value pair in the AI brief."""

    label: str
    value: str


class AIBrief(BaseModel):
    """Deterministic AI brief (no LLM call — keeps dashboard fast)."""

    summary: str
    highlights: list[AIBriefHighlight]


class DashboardData(BaseModel):
    """Aggregated dashboard payload."""

    totals: KPITotals
    category_counts: list[CategoryCount] = Field(alias="categoryCounts")
    top_senders: list[TopSender] = Field(default_factory=list, alias="topSenders")
    trend: list[TrendPoint] = Field(default_factory=list)
    deadlines: list[DeadlineRow] = Field(default_factory=list)
    action_items: list[ActionItemRow] = Field(
        default_factory=list, alias="actionItems"
    )
    recent_activity: list[RecentActivityRow] = Field(
        default_factory=list, alias="recentActivity"
    )
    ai_brief: AIBrief = Field(alias="aiBrief")
    model_config = _Cfg
