import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapSender } from '@/lib/mappers'
import { notFound } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ senderId: string }> }) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { senderId } = await ctx.params
  const sender = await db.sender.findFirst({
    where: { id: senderId, accountId: session.accountId },
    include: {
      emails: {
        select: { subject: true, memberships: { include: { category: true } } },
        take: 30,
        orderBy: { receivedAt: 'desc' },
      },
    },
  })
  if (!sender) throw notFound('Sender not found')
  return NextResponse.json(mapSender(sender))
}
