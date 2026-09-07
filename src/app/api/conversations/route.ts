/**
 * GET /api/conversations — list conversations with lightweight summary projections.
 * Supports ?status= and ?followUp= filters. Cursor-paginated.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapConversationSummary } from '@/lib/conversations/mappers'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await getSession()
  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const followUp = url.searchParams.get('followUp')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100)

  const where: Record<string, unknown> = { accountId: session.accountId }
  if (status) where.status = status
  if (followUp) where.followUpState = followUp

  const conversations = await db.conversation.findMany({
    where,
    include: { _count: { select: { threads: true } } },
    orderBy: { latestMessageAt: 'desc' },
    take: limit,
  })

  return NextResponse.json(conversations.map(mapConversationSummary))
}
