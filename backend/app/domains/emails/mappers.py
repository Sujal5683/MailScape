"""Prisma row → Pydantic DTO mappers for the emails domain.

Mirrors `mapEmailToList` / `mapEmailToDetail` in `src/lib/mappers.ts`.
JSON-encoded Prisma ``String`` fields (toRecipients, labels, extractedLinks)
are parsed here with ``json.loads`` so the DTO carries typed lists.
"""
from __future__ import annotations

import json
from typing import Any

from app.domains.emails.schemas import (
    CategoryRef, EmailAttachmentMeta, EmailDetail, EmailFlags,
    EmailLinkMeta, EmailListItem, Recipient,
)


def _parse_recipients(raw: str | None) -> list[Recipient]:
    """Parse a JSON-encoded recipient list (tolerant of bad JSON / strings)."""
    if not raw:
        return []
    try:
        arr = json.loads(raw)
    except (TypeError, ValueError):
        return []
    if not isinstance(arr, list):
        return []
    out: list[Recipient] = []
    for item in arr:
        if isinstance(item, str):
            out.append(Recipient(email=item))
        elif isinstance(item, dict) and "email" in item:
            out.append(Recipient(email=item["email"], name=item.get("name")))
    return out


def _parse_array(raw: str | None, fallback: Any) -> Any:
    """Parse a JSON string into the typed fallback shape on failure."""
    if not raw:
        return fallback
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return fallback


def _gmail_url(provider_thread_id: str | None) -> str:
    """Best-effort Gmail deep link (mirrors TS ``gmailUrlFor``)."""
    if provider_thread_id:
        return f"https://mail.google.com/mail/u/0/#inbox/{provider_thread_id}"
    return "https://mail.google.com/mail/u/0/#all"


def _categories(row: Any) -> list[CategoryRef]:
    """Project memberships → CategoryRef list."""
    return [
        CategoryRef(
            id=m.category.id, name=m.category.name, color=m.category.color,
            icon=m.category.icon, source=m.source, confidence=m.confidence,
        )
        for m in (getattr(row, "memberships", None) or [])
    ]


def _flags(row: Any) -> EmailFlags:
    """Build the flag bundle from the email row."""
    return EmailFlags(
        isRead=row.isRead, isStarred=row.isStarred, isImportant=row.isImportant,
        isSpam=row.isSpam, isDraft=row.isDraft, isSent=row.isSent,
        isArchived=row.isArchived, hasAttachment=row.hasAttachment,
    )


def map_email_to_list(row: Any) -> EmailListItem:
    """Map a Prisma ``Email`` row (with attachments + memberships) to DTO."""
    return EmailListItem(
        id=row.id, accountId=row.accountId, threadId=row.threadId,
        providerMessageId=row.providerMessageId, providerThreadId=row.providerThreadId,
        fromName=row.fromName, fromEmail=row.fromEmail,
        toRecipients=_parse_recipients(row.toRecipients),
        subject=row.subject, snippet=row.snippet,
        receivedAt=row.receivedAt.isoformat() if row.receivedAt else None,
        hasAttachment=row.hasAttachment,
        attachmentsCount=len(getattr(row, "attachments", None) or []),
        categories=_categories(row),
        classificationSource=row.classificationSource,
        classificationConfidence=row.classificationConfidence,
        flags=_flags(row),
        labels=_parse_array(row.labels, []),
        snoozedUntil=row.snoozedUntil.isoformat() if row.snoozedUntil else None,
    )


def map_email_to_detail(row: Any) -> EmailDetail:
    """Map a Prisma ``Email`` row to the full ``EmailDetail`` DTO."""
    base = map_email_to_list(row)
    links = [
        EmailLinkMeta(**link)
        for link in _parse_array(row.extractedLinks, [])
        if isinstance(link, dict) and "url" in link
    ]
    attachments = [
        EmailAttachmentMeta(
            id=a.id, filename=a.filename, mimeType=a.mimeType,
            size=a.size, previewable=a.previewable,
        )
        for a in (getattr(row, "attachments", None) or [])
    ]
    return EmailDetail(
        **base.model_dump(by_alias=True),
        ccRecipients=_parse_recipients(row.ccRecipients),
        bccRecipients=_parse_recipients(row.bccRecipients),
        bodyText=row.bodyText, bodyHtmlSanitized=row.bodyHtmlSanitized,
        extractedLinks=links, attachments=attachments,
        gmailUrl=_gmail_url(row.providerThreadId),
    )
