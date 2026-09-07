import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { notFound } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// POST /api/notifications/[id]/read
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const n = await db.notification.findFirst({ where: { id, accountId: session.accountId } })
  if (!n) throw notFound('Notification not found')
  await db.notification.update({ where: { id }, data: { isRead: true } })
  return NextResponse.json({ ok: true })
}
