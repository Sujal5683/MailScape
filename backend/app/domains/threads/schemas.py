"""Pydantic schemas for the threads domain.

Mirrors the ad-hoc response shape returned by
``src/app/api/threads/[threadId]/route.ts``. The ``emails`` field reuses
``EmailListItem`` from the emails domain so the thread context shape
matches the email list shape consumed by the frontend.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.domains.emails.schemas import EmailListItem


class ThreadSummary(BaseModel):
    """Thread context with all member emails."""

    id: str
    provider_thread_id: str = Field(alias="providerThreadId")
    subject: str | None = None
    last_message_at: str | None = Field(default=None, alias="lastMessageAt")
    message_count: int = Field(alias="messageCount")
    emails: list[EmailListItem] = Field(default_factory=list)
    model_config = ConfigDict(populate_by_name=True)
