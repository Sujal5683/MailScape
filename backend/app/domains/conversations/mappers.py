"""Prisma row → Pydantic DTO mappers for the conversations domain.

Mirrors `src/lib/conversations/mappers.ts`. ``detectMessageType`` and
``detectChanges`` port the TS heuristics so the FastAPI side returns the
same timeline + diff shape the frontend already consumes.
"""
from __future__ import annotations

import json
import re
from typing import Any

from app.domains.conversations.schemas import (
    ConversationChange, ConversationDetail, ConversationMessage,
    ConversationParticipant, ConversationSummary,
)

_FIELD_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("Deadline", re.compile(r"(?:deadline|due(?:\s+by)?|submit\s+by|last\s+date)\s*:?\s*([^\n.]{3,60})", re.I)),
    ("Eligibility", re.compile(r"(?:eligib(?:le|ility)|cgpa|grade)\s*:?\s*([^\n.]{3,60})", re.I)),
    ("Location", re.compile(r"(?:location|venue|auditorium|room)\s*:?\s*([^\n.]{3,60})", re.I)),
    ("Time", re.compile(r"(?:time|at)\s*:?\s*(\d{1,2}[:.]?\d{0,2}\s*(?:am|pm)?)", re.I)),
    ("Date", re.compile(r"(?:date|on)\s*:?\s*([^\n.]{3,40})", re.I)),
]


def _parse_participants(raw: str | None) -> list[ConversationParticipant]:
    """Parse the JSON-encoded participantSummary column (tolerant)."""
    if not raw:
        return []
    try:
        arr = json.loads(raw)
    except (TypeError, ValueError):
        return []
    if not isinstance(arr, list):
        return []
    out: list[ConversationParticipant] = []
    for item in arr:
        if isinstance(item, dict) and "email" in item:
            out.append(ConversationParticipant(
                email=item["email"], name=item.get("name"),
                role=item.get("role", "both"),
            ))
    return out


def detect_message_type(subject: str | None, index: int, total: int) -> str:
    """Classify a message within a thread (mirrors TS detectMessageType)."""
    if index == 0:
        return "original"
    s = (subject or "").lower()
    if index == total - 1:
        if "final" in s or "last" in s:
            return "final"
        if "reminder" in s:
            return "reminder"
        if "update" in s or "updated" in s:
            return "update"
    if "reminder" in s:
        return "reminder"
    if "follow" in s or "following up" in s:
        return "follow_up"
    if "clarif" in s or "question" in s:
        return "clarification"
    if "update" in s or "updated" in s or "revised" in s:
        return "update"
    return "reply"


def _detect_changes(emails: list[Any]) -> list[ConversationChange]:
    """Extract field diffs across messages (mirrors TS detectChanges)."""
    if len(emails) < 2:
        return []
    changes: list[ConversationChange] = []
    for field, pattern in _FIELD_PATTERNS:
        values: list[tuple[str, str, str | None, str | None]] = []
        for e in emails:
            text = f"{e.subject or ''}\n{e.bodyText or ''}"
            m = pattern.search(text)
            if m and m.group(1):
                values.append((
                    m.group(1).strip()[:80], e.id, e.subject,
                    e.receivedAt.isoformat() if e.receivedAt else None,
                ))
        if len(values) >= 2:
            first, last = values[0], values[-1]
            if first[0].lower() != last[0].lower():
                changes.append(ConversationChange(
                    field=field, earlier=first[0], latest=last[0],
                    changedAt=last[3], sourceMessageId=last[1],
                    sourceSubject=last[2],
                ))
    return changes


def map_conversation_summary(row: Any) -> ConversationSummary:
    """Project a Conversation row to the summary DTO."""
    thread_count = getattr(getattr(row, "_count", None), "threads", None) \
        or len(getattr(row, "threads", None) or [])
    return ConversationSummary(
        id=row.id, accountId=row.accountId,
        canonicalSubject=row.canonicalSubject, status=row.status,
        followUpState=row.followUpState, importance=row.importance,
        messageCount=row.messageCount, threadCount=thread_count,
        participants=_parse_participants(row.participantSummary),
        latestMessageAt=row.latestMessageAt.isoformat() if row.latestMessageAt else None,
        firstMessageAt=row.firstMessageAt.isoformat() if row.firstMessageAt else None,
        latestSubject=None, latestFromEmail=None, unreadCount=0,
        hasAttachments=False, hasDeadline=False,
        categoryId=None, categoryName=None, categoryColor=None,
    )


def map_conversation_detail(row: Any) -> ConversationDetail:
    """Map a Conversation (with threads.emails.memberships) to detail DTO."""
    base = map_conversation_summary(row)
    all_emails = sorted(
        (e for t in (row.threads or []) for e in (t.emails or [])),
        key=lambda e: e.receivedAt or 0,
    )
    total = len(all_emails)
    messages = [
        ConversationMessage(
            id=e.id, emailId=e.id, threadId=e.threadId,
            providerThreadId=e.providerThreadId, fromName=e.fromName,
            fromEmail=e.fromEmail, subject=e.subject, snippet=e.snippet,
            receivedAt=e.receivedAt.isoformat() if e.receivedAt else None,
            isRead=e.isRead, isImportant=e.isImportant,
            hasAttachment=e.hasAttachment,
            messageType=detect_message_type(e.subject, i, total),
            isLatest=i == total - 1,
            categoryId=(e.memberships[0].category.id if e.memberships else None),
            categoryName=(e.memberships[0].category.name if e.memberships else None),
            categoryColor=(e.memberships[0].category.color if e.memberships else None),
        )
        for i, e in enumerate(all_emails)
    ]
    return ConversationDetail(
        **base.model_dump(by_alias=True),
        messages=messages, changes=_detect_changes(all_emails),
        aiSummary=row.aiSummary,
    )
