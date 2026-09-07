"""Pydantic schemas for the senders domain.

Mirrors `SenderSummary` in `src/lib/types.ts`. Prisma row fields are
stored under snake_case keys but the public API returns camelCase to
preserve the Next.js response contract.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class SenderCategoryRef(BaseModel):
    """A category-count pair aggregated from a sender's recent emails."""

    id: str
    name: str
    count: int


class SenderSummary(BaseModel):
    """Public sender shape returned by every sender route."""

    id: str
    account_id: str = Field(alias="accountId")
    sender_email: str = Field(alias="senderEmail")
    sender_name: str | None = Field(default=None, alias="senderName")
    domain: str | None = None
    first_seen_at: str | None = Field(default=None, alias="firstSeenAt")
    last_seen_at: str | None = Field(default=None, alias="lastSeenAt")
    message_count: int = Field(default=0, alias="messageCount")
    discovered: bool = True
    rule_status: str = Field(default="none", alias="ruleStatus")
    categories: list[SenderCategoryRef] = Field(default_factory=list)
    recent_subjects: list[str] = Field(default_factory=list, alias="recentSubjects")

    model_config = ConfigDict(populate_by_name=True)
