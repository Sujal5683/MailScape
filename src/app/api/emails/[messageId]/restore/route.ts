import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/emails/[messageId]/restore
//
// Restores an archived/trashed email back to the inbox by clearing its
// `isArchived` flag. Account-scoped (the email must belong to the session
// account). Writes an `EMAIL_RESTORED` audit event (with the previous
// `isArchived` value in metadata) so the action is traceable. Returns
// { ok: true }.
//
// Idempotent: if the email is already not archived, the call still succeeds
// and writes the audit event so the user always gets consistent feedback.
export async function POST(_req: Request, ctx: { params: Promise<{ messageId: string }> }) {
  const session = await getSession()
  const { messageId } = await ctx.params

  const email = await db.email.findFirst({
    where: { id: messageId, accountId: session.accountId },
    select: { id: true, isArchived: true, subject: true, fromEmail: true },
  })
  if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 })

  await db.email.update({
    where: { id: messageId },
    data: { isArchived: false },
  })

  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: 'EMAIL_RESTORED',
      targetType: 'email',
      targetId: messageId,
      sourceSurface: 'ui',
      metadata: JSON.stringify({
        previousIsArchived: email.isArchived,
        newIsArchived: false,
        subject: email.subject,
        fromEmail: email.fromEmail,
      }),
    },
  })

  return NextResponse.json({ ok: true })
}
