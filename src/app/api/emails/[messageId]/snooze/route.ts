import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { readBody } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// POST /api/emails/[messageId]/snooze
// Body: { until: string | null } — ISO string to snooze until, or null to unsnooze.
//
// Account-scoped (the email must belong to the session account). Writes an
// audit event (EMAIL_SNOOZED / EMAIL_UNSNOOZED) with the previous snoozedUntil
// in metadata so the action is reversible via the audit log. Returns { ok: true }.
export async function POST(req: Request, ctx: { params: Promise<{ messageId: string }> }) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { messageId } = await ctx.params
  const { until } = await readBody<{ until?: string | null }>(req)

  // `until` may be null (unsnooze) or an ISO string. Reject anything else.
  let resolved: Date | null = null
  if (until !== null && until !== undefined) {
    if (typeof until !== 'string') {
      return NextResponse.json({ error: 'until must be an ISO string or null' }, { status: 400 })
    }
    const parsed = new Date(until)
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'until must be a valid ISO string' }, { status: 400 })
    }
    resolved = parsed
  }

  const email = await db.email.findFirst({
    where: { id: messageId, accountId: session.accountId },
    select: { id: true, snoozedUntil: true },
  })
  if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 })

  await db.email.update({
    where: { id: messageId },
    data: { snoozedUntil: resolved },
  })

  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: resolved ? 'EMAIL_SNOOZED' : 'EMAIL_UNSNOOZED',
      targetType: 'email',
      targetId: messageId,
      sourceSurface: 'ui',
      metadata: JSON.stringify({
        previousSnoozedUntil: email.snoozedUntil ? email.snoozedUntil.toISOString() : null,
        newSnoozedUntil: resolved ? resolved.toISOString() : null,
      }),
    },
  })

  return NextResponse.json({ ok: true })
}
