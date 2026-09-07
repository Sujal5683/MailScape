"""Business logic for the senders domain.

Account-scoped helpers wrapping Prisma reads. Mirrors
`src/app/api/senders/route.ts` and `src/app/api/senders/[senderId]/route.ts` —
the response shape (with aggregated category counts and recent subjects)
matches the Next.js `mapSender` output exactly.
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime

from prisma import Prisma

from app.core.errors.types import NotFound
from app.domains.senders.schemas import SenderCategoryRef, SenderSummary


def _iso(value: datetime | None) -> str | None:
    """ISO-8601 string or None — matches Next.js `.toISOString()` output."""
    return value.isoformat() if value else None


def _map(row) -> SenderSummary:
    """Project a Prisma sender row (with nested emails) → SenderSummary."""
    cat_counter: Counter[str] = Counter()
    cat_names: dict[str, str] = {}
    for email in row.emails or []:
        for membership in email.memberships or []:
            cat = membership.category
            if cat is None:
                continue
            cat_counter[cat.id] += 1
            cat_names[cat.id] = cat.name
    categories = [
        SenderCategoryRef(id=cid, name=cat_names[cid], count=n)
        for cid, n in cat_counter.most_common()
    ]
    recent = [e.subject or "(no subject)" for e in (row.emails or [])[:5]]
    return SenderSummary(
        id=row.id, accountId=row.accountId, senderEmail=row.senderEmail,
        senderName=row.senderName, domain=row.domain,
        firstSeenAt=_iso(row.firstSeenAt), lastSeenAt=_iso(row.lastSeenAt),
        messageCount=row.messageCount, discovered=row.discovered,
        ruleStatus=row.ruleStatus, categories=categories, recentSubjects=recent,
    )


_EMAIL_INCLUDE = {
    "emails": {
        "select": {"subject": True, "memberships": {"include": {"category": True}}},
        "order_by": {"receivedAt": "desc"},
    }
}


async def list_senders(db: Prisma, account_id: str, q: str = "") -> list[SenderSummary]:
    """Return up to 100 senders for the account, optionally filtered by `q`."""
    where: dict = {"accountId": account_id}
    if q:
        where["OR"] = [{"senderEmail": {"contains": q}},
                       {"senderName": {"contains": q}},
                       {"domain": {"contains": q}}]
    rows = await db.sender.find_many(
        where=where, include={**_EMAIL_INCLUDE, "emails": {**_EMAIL_INCLUDE["emails"], "take": 20}},
        order_by={"messageCount": "desc"}, take=100,
    )
    return [_map(r) for r in rows]


async def get_sender(db: Prisma, account_id: str, sender_id: str) -> SenderSummary:
    """Return one sender (account-scoped). Raises NotFound if missing."""
    row = await db.sender.find_first(
        where={"id": sender_id, "accountId": account_id},
        include={**_EMAIL_INCLUDE, "emails": {**_EMAIL_INCLUDE["emails"], "take": 30}},
    )
    if row is None:
        raise NotFound("Sender not found")
    return _map(row)
