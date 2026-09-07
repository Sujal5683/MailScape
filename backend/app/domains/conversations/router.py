"""FastAPI router for the conversations domain.

Mounts (all under ``/api/v1``):
- GET   /conversations
- GET   /conversations/{conversation_id}
- PATCH /conversations/{conversation_id}
- GET   /emails/{message_id}/conversation
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from prisma import Prisma

from app.api.deps import get_account_id, get_db, get_session
from app.core.security.auth import Session
from app.domains.conversations.schemas import (
    ConversationDetail, ConversationSummary, ConversationUpdate,
)
from app.domains.conversations.service import (
    get_conversation, get_conversation_for_email, list_conversations,
    update_conversation,
)

router = APIRouter(tags=["conversations"])


@router.get("/conversations", response_model=list[ConversationSummary])
async def get_conversations(
    db: Prisma = Depends(get_db),
    account_id: str = Depends(get_account_id),
    status: str | None = Query(default=None),
    followUp: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
) -> list[ConversationSummary]:
    """List conversation summaries with optional status/followUp filters."""
    return await list_conversations(
        db, account_id, status=status, follow_up=followUp, limit=limit,
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation_detail(
    conversation_id: str,
    db: Prisma = Depends(get_db),
    account_id: str = Depends(get_account_id),
) -> ConversationDetail:
    """Fetch a conversation with all messages + detected changes."""
    return await get_conversation(db, account_id, conversation_id)


@router.patch("/conversations/{conversation_id}")
async def patch_conversation(
    conversation_id: str,
    body: ConversationUpdate,
    db: Prisma = Depends(get_db),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    """Update a conversation's status/followUp/importance."""
    await update_conversation(db, session, conversation_id, body)
    return {"ok": True}


@router.get(
    "/emails/{message_id}/conversation",
    response_model=ConversationDetail | None,
)
async def get_email_conversation(
    message_id: str,
    db: Prisma = Depends(get_db),
    account_id: str = Depends(get_account_id),
) -> ConversationDetail | None:
    """Resolve the conversation for a given email (null if ungrouped)."""
    return await get_conversation_for_email(db, account_id, message_id)
