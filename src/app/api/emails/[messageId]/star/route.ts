import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { readBody } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// POST /api/emails/[messageId]/star — star/unstar (reversible write).
export async function POST(req: Request, ctx: { params: Promise<{ messageId: string }> }) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { messageId } = await ctx.params
  const { starred } = await readBody<{ starred?: boolean }>(req)
  const target = starred === false ? false : true
  const email = await db.email.findFirst({ where: { id: messageId, accountId: session.accountId } })
  if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 })
  await db.email.update({ where: { id: messageId }, data: { isStarred: target } })
  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: target ? 'EMAIL_STARRED' : 'EMAIL_UNSTARRED',
      targetType: 'email',
      targetId: messageId,
      sourceSurface: 'ui',
      metadata: JSON.stringify({ previousState: email.isStarred }),
    },
  })
  return NextResponse.json({ ok: true })
}
