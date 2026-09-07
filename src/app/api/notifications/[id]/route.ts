import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { notFound } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// DELETE /api/notifications/[id]
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  const { id } = await ctx.params
  const n = await db.notification.findFirst({ where: { id, accountId: session.accountId } })
  if (!n) throw notFound('Notification not found')
  await db.notification.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
