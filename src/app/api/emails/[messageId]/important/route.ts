import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { readBody } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// POST /api/emails/[messageId]/important — mark important/unimportant (reversible write).
// Mirrors the read/star routes: updates the flag, writes an audit event with previous state.
export async function POST(req: Request, ctx: { params: Promise<{ messageId: string }> }) {
  const session = await getSession()
  const { messageId } = await ctx.params
  const { important } = await readBody<{ important?: boolean }>(req)
  const target = important === false ? false : true
  const email = await db.email.findFirst({ where: { id: messageId, accountId: session.accountId } })
  if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 })
  await db.email.update({ where: { id: messageId }, data: { isImportant: target } })
  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: target ? 'EMAIL_MARKED_IMPORTANT' : 'EMAIL_UNMARKED_IMPORTANT',
      targetType: 'email',
      targetId: messageId,
      sourceSurface: 'ui',
      metadata: JSON.stringify({ previousState: email.isImportant }),
    },
  })
  return NextResponse.json({ ok: true })
}
