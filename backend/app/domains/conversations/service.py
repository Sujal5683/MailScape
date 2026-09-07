"""Business logic for the conversations domain.

Account-scoped helpers mirroring `src/app/api/conversations/**/route.ts`
and `src/app/api/emails/[messageId]/conversation/route.ts`. Every query
filters by ``account_id`` from the session; the email→thread→conversation
lookup is the only cross-table navigation.
"""
from __future__ import annotations

import json

from prisma import Prisma

from app.core.errors.types import NotFound
from app.core.security.auth import Session
from app.domains.conversations.mappers import (
    map_conversation_detail, map_conversation_summary,
)
from app.domains.conversations.schemas import (
    ConversationDetail, ConversationSummary, ConversationUpdate,
)

_DETAIL_INCLUDE = {
    "threads": {
        "include": {
            "emails": {
                "include": {"memberships": {"include": {"category": True}}},
                "order": {"receivedAt": "asc"},
            },
        },
    },
}


async def list_conversations(
    db: Prisma, account_id: str, *,
    status: str | None = None, follow_up: str | None = None,
    limit: int = 50,
) -> list[ConversationSummary]:
    """List conversation summaries with optional status/followUp filters."""
    where: dict[str, str] = {"accountId": account_id}
    if status:
        where["status"] = status
    if follow_up:
        where["followUpState"] = follow_up
    rows = await db.conversation.find_many(
        where=where,
        include={"_count": {"select": {"threads": True}}},
        order={"latestMessageAt": "desc"},
        take=limit,
    )
    return [map_conversation_summary(r) for r in rows]


async def get_conversation(
    db: Prisma, account_id: str, conversation_id: str,
) -> ConversationDetail:
    """Fetch full conversation detail (404 if not owned)."""
    row = await db.conversation.find_first(
        where={"id": conversation_id, "accountId": account_id},
        include=_DETAIL_INCLUDE,
    )
    if row is None:
        raise NotFound("Conversation not found")
    return map_conversation_detail(row)


async def update_conversation(
    db: Prisma, session: Session, conversation_id: str, body: ConversationUpdate,
) -> None:
    """Patch status/followUp/importance + write an audit row."""
    row = await db.conversation.find_first(
        where={"id": conversation_id, "accountId": session.account_id},
    )
    if row is None:
        raise NotFound("Conversation not found")
    data = body.model_dump(exclude_unset=True)
    if data:
        await db.conversation.update(where={"id": conversation_id}, data=data)
    await db.auditevent.create(data={
        "userId": session.user_id, "accountId": session.account_id,
        "eventType": "CONVERSATION_UPDATED", "targetType": "conversation",
        "targetId": conversation_id, "sourceSurface": "ui",
        "metadata": json.dumps(data),
    })


async def get_conversation_for_email(
    db: Prisma, account_id: str, message_id: str,
) -> ConversationDetail | None:
    """Resolve email → thread → conversation; return None if ungrouped."""
    email = await db.email.find_first(
        where={"id": message_id, "accountId": account_id},
        select={"threadId": True},
    )
    if email is None:
        raise NotFound("Email not found")
    if email.threadId is None:
        return None
    thread = await db.thread.find_unique(
        where={"id": email.threadId}, select={"conversationId": True},
    )
    if thread is None or thread.conversationId is None:
        return None
    row = await db.conversation.find_first(
        where={"id": thread.conversationId, "accountId": account_id},
        include=_DETAIL_INCLUDE,
    )
    return map_conversation_detail(row) if row is not None else None
