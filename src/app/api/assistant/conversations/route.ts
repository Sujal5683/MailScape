import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { readBody, ApiError } from '@/lib/api-helpers'
import type { AssistantConversationDTO, AssistantMode } from '@/lib/types'

export const dynamic = 'force-dynamic'

function mapConv(c: {
  id: string
  userId: string
  accountId: string | null
  title: string | null
  mode: string
  archived: boolean
  createdAt: Date
  expiresAt: Date | null
  _count?: { messages: number }
}): AssistantConversationDTO {
  return {
    id: c.id,
    userId: c.userId,
    accountId: c.accountId,
    title: c.title,
    mode: c.mode as AssistantMode,
    archived: c.archived,
    createdAt: c.createdAt.toISOString(),
    expiresAt: c.expiresAt?.toISOString() ?? null,
    messageCount: c._count?.messages ?? 0,
  }
}

// GET /api/assistant/conversations — list within 30-day retention.
//
// Archived conversations are EXCLUDED by default so the rail shows only the
// user's "active" chats. Pass `?includeArchived=true` to surface them too
// (used by the rail's "Show archived" toggle).
export async function GET(req: Request) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const { searchParams } = new URL(req.url)
  const includeArchived = searchParams.get('includeArchived') === 'true'

  const convs = await db.assistantConversation.findMany({
    where: {
      userId: session.userId,
      createdAt: { gte: cutoff },
      ...(includeArchived ? {} : { archived: false }),
    },
    include: { _count: { select: { messages: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(convs.map(mapConv))
}

// POST /api/assistant/conversations — create conversation.
export async function POST(req: Request) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await readBody<{ mode?: AssistantMode; title?: string }>(req)
  if (body.title !== undefined && typeof body.title !== 'string') {
    throw new ApiError('title must be a string', 400)
  }
  const conv = await db.assistantConversation.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      mode: body.mode ?? 'direct',
      title: body.title ?? 'New conversation',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    include: { _count: { select: { messages: true } } },
  })
  return NextResponse.json(mapConv(conv))
}
