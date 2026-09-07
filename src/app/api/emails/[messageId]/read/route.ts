import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { readBody } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// POST /api/emails/[messageId]/read — mark read/unread (reversible write).
export async function POST(req: Request, ctx: { params: Promise<{ messageId: string }> }) {
  const session = await getSession()
  const { messageId } = await ctx.params
  const { read } = await readBody<{ read?: boolean }>(req)
  const target = read === false ? false : true
  const email = await db.email.findFirst({ where: { id: messageId, accountId: session.accountId } })
  if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 })
  await db.email.update({ where: { id: messageId }, data: { isRead: target } })
  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: target ? 'EMAIL_MARKED_READ' : 'EMAIL_MARKED_UNREAD',
      targetType: 'email',
      targetId: messageId,
      sourceSurface: 'ui',
      metadata: JSON.stringify({ previousState: email.isRead }),
    },
  })
  return NextResponse.json({ ok: true })
}
