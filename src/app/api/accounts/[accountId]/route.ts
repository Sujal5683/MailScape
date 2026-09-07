import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'


// DELETE /api/accounts/[accountId] — HARD DELETE the account and all its data.
// Requires { confirm: true } in the request body.
// Because the Prisma schema uses onDelete: Cascade, this one delete cascades
// through emails, categories, threads, rules, notifications, etc.
export async function DELETE(req: Request, ctx: { params: Promise<{ accountId: string }> }) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { accountId } = await ctx.params

  const body = await req.json().catch(() => ({ confirm: false }))
  if (!body.confirm) {
    return NextResponse.json({ error: 'Confirmation required', needsConfirmation: true }, { status: 409 })
  }

  const account = await db.accountConnection.findUnique({ where: { id: accountId } })
  if (!account || account.userId !== session.userId) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  // Write audit event BEFORE deleting (the record will be gone after).
  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId,
      eventType: 'ACCOUNT_DISCONNECTED',
      targetType: 'account',
      targetId: accountId,
      sourceSurface: 'ui',
      metadata: JSON.stringify({ emailAddress: account.emailAddress }),
    },
  })

  // HARD DELETE — cascades through all related records automatically.
  await db.accountConnection.delete({ where: { id: accountId } })

  return NextResponse.json({ ok: true })
}
