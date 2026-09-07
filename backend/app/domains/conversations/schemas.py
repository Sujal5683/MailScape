"""Pydantic schemas for the conversations domain.

Mirrors the TS contracts in `src/lib/conversations/types.ts`. The
``ConversationSummary`` is the list-view projection; ``ConversationDetail``
adds messages + changes; ``ConversationMessage`` is a single timeline entry;
``ConversationChange`` is a detected field diff across messages.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ConversationStatus = Literal[
    "active", "awaiting_user", "awaiting_other",
    "follow_up_due", "updated", "resolved", "archived",
]
FollowUpState = Literal[
    "none", "recommended", "due", "awaiting_response", "resolved",
]
Importance = Literal["normal", "important"]
MessageType = Literal[
    "original", "reply", "follow_up", "reminder",
    "update", "clarification", "final",
]


class ConversationParticipant(BaseModel):
    """A sender/recipient in a conversation."""

    email: str
    name: str | None = None
    role: Literal["sender", "recipient", "both"]


class ConversationSummary(BaseModel):
    """Lightweight conversation projection for list views."""

    id: str
    account_id: str = Field(alias="accountId")
    canonical_subject: str = Field(alias="canonicalSubject")
    status: ConversationStatus
    follow_up_state: FollowUpState = Field(alias="followUpState")
    importance: Importance
    message_count: int = Field(alias="messageCount")
    thread_count: int = Field(alias="threadCount")
    participants: list[ConversationParticipant] = Field(default_factory=list)
    latest_message_at: str | None = Field(default=None, alias="latestMessageAt")
    first_message_at: str | None = Field(default=None, alias="firstMessageAt")
    latest_subject: str | None = Field(default=None, alias="latestSubject")
    latest_from_email: str | None = Field(default=None, alias="latestFromEmail")
    unread_count: int = Field(default=0, alias="unreadCount")
    has_attachments: bool = Field(default=False, alias="hasAttachments")
    has_deadline: bool = Field(default=False, alias="hasDeadline")
    category_id: str | None = Field(default=None, alias="categoryId")
    category_name: str | None = Field(default=None, alias="categoryName")
    category_color: str | None = Field(default=None, alias="categoryColor")
    model_config = ConfigDict(populate_by_name=True)


class ConversationMessage(BaseModel):
    """A single message in the conversation timeline."""

    id: str
    email_id: str = Field(alias="emailId")
    thread_id: str | None = Field(default=None, alias="threadId")
    provider_thread_id: str | None = Field(default=None, alias="providerThreadId")
    from_name: str | None = Field(default=None, alias="fromName")
    from_email: str = Field(alias="fromEmail")
    subject: str | None = None
    snippet: str | None = None
    received_at: str | None = Field(default=None, alias="receivedAt")
    is_read: bool = Field(alias="isRead")
    is_important: bool = Field(alias="isImportant")
    has_attachment: bool = Field(alias="hasAttachment")
    message_type: MessageType = Field(alias="messageType")
    is_latest: bool = Field(alias="isLatest")
    category_id: str | None = Field(default=None, alias="categoryId")
    category_name: str | None = Field(default=None, alias="categoryName")
    category_color: str | None = Field(default=None, alias="categoryColor")
    model_config = ConfigDict(populate_by_name=True)


class ConversationChange(BaseModel):
    """A detected field diff between two messages (§12 "What changed?")."""

    field: str
    earlier: str | None = None
    latest: str | None = None
    changed_at: str | None = Field(default=None, alias="changedAt")
    source_message_id: str | None = Field(default=None, alias="sourceMessageId")
    source_subject: str | None = Field(default=None, alias="sourceSubject")
    model_config = ConfigDict(populate_by_name=True)


class ConversationDetail(ConversationSummary):
    """Full conversation with messages + detected changes."""

    messages: list[ConversationMessage] = Field(default_factory=list)
    changes: list[ConversationChange] = Field(default_factory=list)
    ai_summary: str | None = Field(default=None, alias="aiSummary")


class ConversationUpdate(BaseModel):
    """Body for PATCH /conversations/{id}."""

    status: ConversationStatus | None = None
    followUpState: FollowUpState | None = None
    importance: Importance | None = None
