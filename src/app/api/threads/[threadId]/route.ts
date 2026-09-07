import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapEmailToList } from '@/lib/mappers'
import { notFound } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// GET /api/threads/[threadId] — thread context with all messages.
export async function GET(_req: Request, ctx: { params: Promise<{ threadId: string }> }) {
  const session = await getSession()
  const { threadId } = await ctx.params
  const thread = await db.thread.findFirst({
    where: { id: threadId, accountId: session.accountId },
    include: {
      emails: {
        orderBy: { receivedAt: 'asc' },
        include: { attachments: true, memberships: { include: { category: true } } },
      },
    },
  })
  if (!thread) throw notFound('Thread not found')
  return NextResponse.json({
    id: thread.id,
    providerThreadId: thread.providerThreadId,
    subject: thread.subject,
    lastMessageAt: thread.lastMessageAt?.toISOString() ?? null,
    messageCount: thread.emails.length,
    emails: thread.emails.map(mapEmailToList),
  })
}
