import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapEmailToDetail } from '@/lib/mappers'
import { notFound } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// GET /api/emails/[messageId] — full email detail.
export async function GET(_req: Request, ctx: { params: Promise<{ messageId: string }> }) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { messageId } = await ctx.params
  const email = await db.email.findFirst({
    where: { id: messageId, accountId: session.accountId },
    include: {
      attachments: true,
      memberships: { include: { category: true } },
    },
  })
  if (!email) throw notFound('Email not found')
  return NextResponse.json(mapEmailToDetail(email))
}
