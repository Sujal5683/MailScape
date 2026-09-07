import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// DELETE /api/emails/[messageId]/permanent-delete
//
// SENSITIVE: HARD-DELETES the email and every record tied to it
// (attachments, category memberships, classification results, deadlines,
// action items, and notifications). The action is irreversible — there is no
// soft-delete fallback. The audit event is written BEFORE the delete so we
// always have a record even if the transaction itself fails partway through.
//
// Body: { confirm: true } — required. Rejects with 400 if absent or not `true`.
//
// Account-scoped: the email must belong to the session account. Returns
// { ok: true } on success.
export async function DELETE(req: Request, ctx: { params: Promise<{ messageId: string }> }) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { messageId } = await ctx.params

  // Parse + validate the confirmation flag. We accept both DELETE with a body
  // (the standard pattern in this codebase) and a JSON body of `{ confirm }`.
  let body: { confirm?: unknown } = {}
  try {
    const text = await req.text()
    if (text) body = JSON.parse(text) as { confirm?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (body.confirm !== true) {
    return NextResponse.json(
      { error: 'Confirmation required — send { confirm: true } in the request body.' },
      { status: 400 },
    )
  }

  // Enforce account ownership before touching anything.
  const email = await db.email.findFirst({
    where: { id: messageId, accountId: session.accountId },
    select: {
      id: true,
      subject: true,
      fromEmail: true,
      providerMessageId: true,
      isArchived: true,
      receivedAt: true,
    },
  })
  if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 })

  // Write the audit event FIRST so the action is recorded even if the
  // cascading delete fails partway through.
  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: 'EMAIL_PERMANENTLY_DELETED',
      targetType: 'email',
      targetId: messageId,
      sourceSurface: 'ui',
      metadata: JSON.stringify({
        subject: email.subject,
        fromEmail: email.fromEmail,
        providerMessageId: email.providerMessageId,
        wasArchived: email.isArchived,
        receivedAt: email.receivedAt ? email.receivedAt.toISOString() : null,
      }),
    },
  })

  // Hard-delete in a transaction. Attachments / memberships / classification
  // results cascade via the Prisma schema (onDelete: Cascade on Email).
  // Deadlines / action items / notifications use onDelete: SetNull in the
  // schema, so we explicitly delete them here to fully purge the email's
  // footprint (the spec requires they be removed alongside the email).
  await db.$transaction([
    db.deadline.deleteMany({ where: { emailId: messageId } }),
    db.actionItem.deleteMany({ where: { emailId: messageId } }),
    db.notification.deleteMany({ where: { emailId: messageId } }),
    db.email.delete({ where: { id: messageId } }),
  ])

  return NextResponse.json({ ok: true })
}
