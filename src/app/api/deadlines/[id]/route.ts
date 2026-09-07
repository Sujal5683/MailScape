import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { readBody, notFound } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// PATCH /api/deadlines/[id] — update status (open|done|missed).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const body = await readBody<{ status?: 'open' | 'done' | 'missed' }>(req)
  const dl = await db.deadline.findFirst({ where: { id, accountId: session.accountId } })
  if (!dl) throw notFound('Deadline not found')
  if (body.status) {
    await db.deadline.update({ where: { id }, data: { status: body.status } })
    await db.auditEvent.create({
      data: {
        userId: session.userId,
        accountId: session.accountId,
        eventType: 'DEADLINE_STATUS_CHANGED',
        targetType: 'deadline',
        targetId: id,
        sourceSurface: 'ui',
        metadata: JSON.stringify({ from: dl.status, to: body.status }),
      },
    })
  }
  return NextResponse.json({ ok: true })
}

// DELETE /api/deadlines/[id]
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const dl = await db.deadline.findFirst({ where: { id, accountId: session.accountId } })
  if (!dl) throw notFound('Deadline not found')
  await db.deadline.delete({ where: { id } })
  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: 'DEADLINE_DELETED',
      targetType: 'deadline',
      targetId: id,
      sourceSurface: 'ui',
      metadata: JSON.stringify({ title: dl.title }),
    },
  })
  return NextResponse.json({ ok: true })
}
