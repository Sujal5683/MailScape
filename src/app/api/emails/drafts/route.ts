import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapEmailToList } from '@/lib/mappers'

export const dynamic = 'force-dynamic'

// GET /api/emails/drafts
//
// Dedicated drafts endpoint — returns emails flagged isDraft=true (and not
// archived) for the session account, ordered by updatedAt desc so the most
// recently edited draft surfaces first. This is a self-documenting alias for
// the bucket filter on /api/emails?filter=drafts; the where-clause logic is
// duplicated intentionally so callers can hit a dedicated, named endpoint
// without thinking about the filter vocabulary.
//
// Account-scoped via getSession. Skips the default snooze exclusion (drafts
// are never snoozed in practice).
export async function GET() {
  const session = await getSession()

  const where = {
    accountId: session.accountId,
    isDraft: true,
    isArchived: false,
  }

  const [items, total] = await Promise.all([
    db.email.findMany({
      where,
      include: {
        attachments: true,
        memberships: { include: { category: true } },
      },
      orderBy: { updatedAt: 'desc' },
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
