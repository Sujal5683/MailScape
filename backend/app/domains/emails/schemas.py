"""Pydantic schemas for the emails domain.

Mirrors `EmailListItem` / `EmailDetail` in `src/lib/types.ts`. JSON-encoded
Prisma fields (toRecipients, labels, extractedLinks) are parsed into typed
lists by the mappers, not the schemas.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

_Cfg = ConfigDict(populate_by_name=True)
ClassificationSource = Literal["manual_rule", "user_override", "sender_rule", "ai", "system_default"]
CategorySource = Literal["manual_rule", "user_override", "sender_rule", "ai", "system_default"]
BulkAction = Literal["read", "unread", "star", "unstar", "important", "unimportant", "archive", "delete"]


class Recipient(BaseModel):
    """Email recipient (name optional)."""

    email: str
    name: str | None = None


class CategoryRef(BaseModel):
    """Category membership projection for an email."""

    id: str
    name: str
    color: str
    icon: str
    source: CategorySource
    confidence: float | None = None


class EmailFlags(BaseModel):
    """Flag bundle shown in list views."""

    is_read: bool = Field(alias="isRead")
    is_starred: bool = Field(alias="isStarred")
    is_important: bool = Field(alias="isImportant")
    is_spam: bool = Field(alias="isSpam")
    is_draft: bool = Field(alias="isDraft")
    is_sent: bool = Field(alias="isSent")
    is_archived: bool = Field(alias="isArchived")
    has_attachment: bool = Field(alias="hasAttachment")
    model_config = _Cfg


class EmailAttachmentMeta(BaseModel):
    """Attachment metadata (no body)."""

    id: str
    filename: str
    mime_type: str = Field(alias="mimeType")
    size: int
    previewable: bool = False
    model_config = _Cfg


class EmailLinkMeta(BaseModel):
    """A single link extracted from the email body."""

    url: str
    text: str | None = None


class EmailListItem(BaseModel):
    """Row used by list/thread/dashboard views."""

    id: str
    account_id: str = Field(alias="accountId")
    thread_id: str | None = Field(default=None, alias="threadId")
    provider_message_id: str = Field(alias="providerMessageId")
    provider_thread_id: str | None = Field(default=None, alias="providerThreadId")
    from_name: str | None = Field(default=None, alias="fromName")
    from_email: str = Field(alias="fromEmail")
    to_recipients: list[Recipient] = Field(default_factory=list, alias="toRecipients")
    subject: str | None = None
    snippet: str | None = None
    received_at: str | None = Field(default=None, alias="receivedAt")
    has_attachment: bool = Field(default=False, alias="hasAttachment")
    attachments_count: int = Field(default=0, alias="attachmentsCount")
    categories: list[CategoryRef] = Field(default_factory=list)
    classification_source: ClassificationSource | None = Field(default=None, alias="classificationSource")
    classification_confidence: float | None = Field(default=None, alias="classificationConfidence")
    flags: EmailFlags
    labels: list[str] = Field(default_factory=list)
    snoozed_until: str | None = Field(default=None, alias="snoozedUntil")
    model_config = _Cfg


class EmailDetail(EmailListItem):
    """Full email body + attachments + cc/bcc."""

    cc_recipients: list[Recipient] = Field(default_factory=list, alias="ccRecipients")
    bcc_recipients: list[Recipient] = Field(default_factory=list, alias="bccRecipients")
    body_text: str | None = Field(default=None, alias="bodyText")
    body_html_sanitized: str | None = Field(default=None, alias="bodyHtmlSanitized")
    extracted_links: list[EmailLinkMeta] = Field(default_factory=list, alias="extractedLinks")
    attachments: list[EmailAttachmentMeta] = Field(default_factory=list)
    gmail_url: str | None = Field(default=None, alias="gmailUrl")


class EmailListResponse(BaseModel):
    """Paginated email list response with total count."""

    items: list[EmailListItem]
    next_cursor: str | None = Field(default=None, alias="nextCursor")
    total: int
    model_config = _Cfg


class BulkEmailResponse(BaseModel):
    """Response for POST /emails/bulk."""

    ok: bool = True
    affected: int
