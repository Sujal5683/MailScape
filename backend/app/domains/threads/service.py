"""Business logic for the threads domain.

Account-scoped helper mirroring ``src/app/api/threads/[threadId]/route.ts``.
The thread's emails are mapped with the same ``map_email_to_list`` mapper
the emails domain uses so the list shapes stay consistent.
"""
from __future__ import annotations

from prisma import Prisma

from app.core.errors.types import NotFound
from app.domains.emails.mappers import map_email_to_list
from app.domains.threads.schemas import ThreadSummary


async def get_thread(
    db: Prisma, account_id: str, thread_id: str,
) -> ThreadSummary:
    """Fetch a thread with all member emails ordered by receivedAt asc."""
    thread = await db.thread.find_first(
        where={"id": thread_id, "accountId": account_id},
        include={
            "emails": {
                "order": {"receivedAt": "asc"},
                "include": {
                    "attachments": True,
                    "memberships": {"include": {"category": True}},
                },
            },
        },
    )
    if thread is None:
        raise NotFound("Thread not found")
    return ThreadSummary(
        id=thread.id,
        providerThreadId=thread.providerThreadId,
        subject=thread.subject,
        lastMessageAt=thread.lastMessageAt.isoformat()
        if thread.lastMessageAt
        else None,
        messageCount=len(thread.emails),
        emails=[map_email_to_list(e) for e in thread.emails],
    )
