"""Business logic for the compose domain.

Account-scoped draft save + send (audit-only; no real Gmail credentials
are available, mirroring the Next.js contract) + recipient autocomplete.
Mirrors `src/app/api/compose/drafts/route.ts`,
`src/app/api/compose/send/route.ts`, and
`src/app/api/recipients/search/route.ts`.

Send requires ``confirm: True`` — the router enforces this *before*
calling :func:`send_email` so the service never has to handle the
rejection path.
"""
from __future__ import annotations

import json
import secrets

from prisma import Prisma

from app.core.errors.types import ValidationFailed
from app.core.security.auth import Session
from app.domains.compose.schemas import (
    Draft, DraftCreate, Recipient, RecipientSearchResult, SendRequest, SendResponse,
)


async def save_draft(db: Prisma, session: Session, body: DraftCreate) -> Draft:
    """Persist a draft row + DRAFT_SAVED audit event."""
    if not isinstance(body.to, list):
        raise ValidationFailed("Recipients required")
    account_id = body.accountId or session.account_id
    row = await db.draft.create(
        data={"accountId": account_id,
              "toRecipients": json.dumps([r.model_dump() for r in body.to]),
              "ccRecipients": json.dumps([r.model_dump() for r in body.cc]),
              "subject": body.subject, "body": body.body}
    )
    await db.auditevent.create(
        data={"userId": session.user_id, "accountId": session.account_id,
              "eventType": "DRAFT_SAVED", "targetType": "draft", "targetId": row.id,
              "sourceSurface": "ui",
              "metadata": json.dumps({"subject": row.subject})}
    )
    return Draft(
        id=row.id, accountId=row.accountId, toRecipients=body.to, ccRecipients=body.cc,
        subject=row.subject, body=row.body,
        createdAt=row.createdAt.isoformat(), updatedAt=row.updatedAt.isoformat(),
    )


async def send_email(db: Prisma, session: Session, body: SendRequest) -> SendResponse:
    """Persist an EMAIL_SENT audit event + return a synthetic messageId.

    Caller must have already validated ``body.confirm is True``.
    """
    if not body.to:
        raise ValidationFailed("At least one recipient required")
    message_id = f"sent-{secrets.token_hex(4)}"
    await db.auditevent.create(
        data={"userId": session.user_id, "accountId": body.accountId or session.account_id,
              "eventType": "EMAIL_SENT", "targetType": "email",
              "targetId": message_id, "sourceSurface": "ui",
              "metadata": json.dumps({"to": [r.email for r in body.to],
                                       "cc": [r.email for r in body.cc],
                                       "subject": body.subject})}
    )
    return SendResponse(ok=True, messageId=message_id)


async def search_recipients(db: Prisma, account_id: str, q: str) -> list[RecipientSearchResult]:
    """Autocomplete recipients from stored senders (max 10)."""
    q = (q or "").strip().lower()
    if not q:
        return []
    rows = await db.sender.find_many(
        where={"accountId": account_id,
               "OR": [{"senderEmail": {"contains": q}},
                       {"senderName": {"contains": q}},
                       {"domain": {"contains": q}}]},
        order_by={"messageCount": "desc"}, take=10,
        select={"senderEmail": True, "senderName": True, "domain": True},
    )
    return [RecipientSearchResult(email=r.senderEmail, name=r.senderName or None) for r in rows]
