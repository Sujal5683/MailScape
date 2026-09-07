import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { readBody, notFound } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// PATCH /api/action-items/[id] — toggle status.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  const { id } = await ctx.params
  const body = await readBody<{ status?: 'open' | 'done' }>(req)
  const ai = await db.actionItem.findFirst({ where: { id, accountId: session.accountId } })
  if (!ai) throw notFound('Action item not found')
  if (body.status) {
    await db.actionItem.update({ where: { id }, data: { status: body.status } })
    await db.auditEvent.create({
      data: {
        userId: session.userId,
        accountId: session.accountId,
        eventType: 'ACTION_ITEM_STATUS_CHANGED',
        targetType: 'action_item',
        targetId: id,
        sourceSurface: 'ui',
        metadata: JSON.stringify({ from: ai.status, to: body.status }),
      },
    })
  }
  return NextResponse.json({ ok: true })
}

// DELETE /api/action-items/[id]
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  const { id } = await ctx.params
  const ai = await db.actionItem.findFirst({ where: { id, accountId: session.accountId } })
  if (!ai) throw notFound('Action item not found')
  await db.actionItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
