import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapSender } from '@/lib/mappers'

export const dynamic = 'force-dynamic'

// GET /api/senders — sender intelligence with optional search.
export async function GET(req: Request) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(req.url)
  const q = url.searchParams.get('q') ?? ''
  if (session.accountIds.length === 0) return NextResponse.json([])
  const where: Record<string, unknown> = { accountId: { in: session.accountIds } }
  if (q) {
    where.OR = [
      { senderEmail: { contains: q } },
      { senderName: { contains: q } },
      { domain: { contains: q } },
    ]
  }
  const senders = await db.sender.findMany({
    where,
    include: {
      emails: {
        select: { subject: true, memberships: { include: { category: true } } },
        take: 20,
        orderBy: { receivedAt: 'desc' },
      },
    },
    orderBy: { messageCount: 'desc' },
    take: 100,
  })
  return NextResponse.json(senders.map(mapSender))
}
