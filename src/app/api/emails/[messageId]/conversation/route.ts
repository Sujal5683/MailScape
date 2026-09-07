/**
 * GET /api/emails/[messageId]/conversation — get the conversation for an email.
 * Returns the full ConversationDetail (messages + changes) that this email belongs to.
 * Used by the email detail view to render the conversation timeline (§9).
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapConversationDetail } from '@/lib/conversations/mappers'
import { notFound } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ messageId: string }> }) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { messageId } = await ctx.params

  // Find the email → its thread → its conversation
  const email = await db.email.findFirst({
    where: { id: messageId, accountId: session.accountId },
    select: { threadId: true },
  })
  if (!email) throw notFound('Email not found')
  if (!email.threadId) return NextResponse.json(null)

  const thread = await db.thread.findUnique({
    where: { id: email.threadId },
    select: { conversationId: true },
  })
  if (!thread?.conversationId) return NextResponse.json(null)

  const conv = await db.conversation.findFirst({
    where: { id: thread.conversationId, accountId: session.accountId },
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
  if (!conv) return NextResponse.json(null)

  return NextResponse.json(mapConversationDetail(conv))
}
