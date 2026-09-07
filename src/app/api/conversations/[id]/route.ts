/**
 * GET /api/conversations/[id] — full conversation detail with all messages + changes.
 * PATCH /api/conversations/[id] — update status/followUp/importance.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapConversationDetail } from '@/lib/conversations/mappers'
import { readBody, notFound } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  const { id } = await ctx.params
  const conv = await db.conversation.findFirst({
    where: { id, accountId: session.accountId },
    include: {
      threads: {
        include: {
          emails: {
            include: { memberships: { include: { category: true } } },
            orderBy: { receivedAt: 'asc' },
          },
        },
      },
    },
  })
  if (!conv) throw notFound('Conversation not found')
  return NextResponse.json(mapConversationDetail(conv))
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  const { id } = await ctx.params
  const body = await readBody<Partial<{ status: string; followUpState: string; importance: string }>>(req)
  const conv = await db.conversation.findFirst({ where: { id, accountId: session.accountId } })
  if (!conv) throw notFound('Conversation not found')
  const updated = await db.conversation.update({
    where: { id },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.followUpState ? { followUpState: body.followUpState } : {}),
      ...(body.importance ? { importance: body.importance } : {}),
    },
  })
  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: 'CONVERSATION_UPDATED',
      targetType: 'conversation',
      targetId: id,
      sourceSurface: 'ui',
      metadata: JSON.stringify(body),
    },
  })
  return NextResponse.json({ ok: true })
}
