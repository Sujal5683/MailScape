import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapEmailToList } from '@/lib/mappers'

export const dynamic = 'force-dynamic'

// GET /api/emails/sent
//
// Dedicated sent-mail endpoint — returns emails flagged isSent=true (and not
// archived) for the session account, ordered by receivedAt desc so the most
// recently sent email surfaces first. This is a self-documenting alias for
// /api/emails?filter=sent; the where-clause logic is duplicated intentionally
// so callers can hit a dedicated, named endpoint without thinking about the
// filter vocabulary.
//
// Account-scoped via getSession. Skips the default snooze exclusion (sent
// items are never snoozed in practice).
export async function GET() {
  const session = await getSession()

  const where = {
    accountId: session.accountId,
    isSent: true,
    isArchived: false,
  }

  const [items, total] = await Promise.all([
    db.email.findMany({
      where,
      include: {
        attachments: true,
        memberships: { include: { category: true } },
      },
      orderBy: { receivedAt: 'desc' },
      take: 100,
    }),
    db.email.count({ where }),
  ])

  return NextResponse.json({
    items: items.map(mapEmailToList),
    nextCursor: null,
    total,
  })
}
