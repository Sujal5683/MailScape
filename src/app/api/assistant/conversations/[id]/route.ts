import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { readBody, ApiError, notFound } from '@/lib/api-helpers'
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

// Resolve an id as owned by the session user. AssistantConversation is scoped
// to the user (not the account — conversations can predate an account link),
// so we enforce userId ownership. A foreign-user conversation is treated as
// "not found" (404) so we never leak existence across users.
async function getOwned(session: { userId: string }, id: string) {
  const row = await db.assistantConversation.findFirst({
    where: { id, userId: session.userId },
    include: { _count: { select: { messages: true } } },
  })
  if (!row) throw notFound('Conversation not found')
  return row
}

// PATCH /api/assistant/conversations/[id]
// Body: { title?: string, archived?: boolean }
//
// Updates the conversation's title and/or archived flag. Both fields are
// optional — only the supplied fields are written. Emits an audit event
// (AI_CONVERSATION_RENAMED | AI_CONVERSATION_ARCHIVED | AI_CONVERSATION_UNARCHIVED)
// describing the change. Returns the updated conversation.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const row = await getOwned(session, id)

  const body = await readBody<{ title?: string; archived?: boolean }>(req)

  const data: { title?: string; archived?: boolean } = {}
  if (body.title !== undefined) {
    const trimmed = body.title.trim()
    if (!trimmed) throw new ApiError('title cannot be empty', 400)
    if (trimmed.length > 120) throw new ApiError('title must be 120 characters or fewer', 400)
    data.title = trimmed
  }
  if (body.archived !== undefined) {
    if (typeof body.archived !== 'boolean') {
      throw new ApiError('archived must be a boolean', 400)
    }
    data.archived = body.archived
  }
  if (Object.keys(data).length === 0) {
    throw new ApiError('No fields supplied for update', 400)
  }

  const updated = await db.assistantConversation.update({
    where: { id: row.id },
    data,
    include: { _count: { select: { messages: true } } },
  })

  // Emit one audit event per logical change. Title change always comes first
  // so the order in the audit timeline matches the user's mental model.
  if (data.title !== undefined && data.title !== row.title) {
    await db.auditEvent.create({
      data: {
        userId: session.userId,
        accountId: session.accountId,
        eventType: 'AI_CONVERSATION_RENAMED',
        targetType: 'assistant_conversation',
        targetId: row.id,
        sourceSurface: 'ui',
        metadata: JSON.stringify({
          previousTitle: row.title,
          newTitle: data.title,
        }),
      },
    })
  }
  if (data.archived !== undefined && data.archived !== row.archived) {
    await db.auditEvent.create({
      data: {
        userId: session.userId,
        accountId: session.accountId,
        eventType: data.archived
          ? 'AI_CONVERSATION_ARCHIVED'
          : 'AI_CONVERSATION_UNARCHIVED',
        targetType: 'assistant_conversation',
        targetId: row.id,
        sourceSurface: 'ui',
        metadata: JSON.stringify({
          title: row.title,
        }),
      },
    })
  }

  return NextResponse.json(mapConv(updated))
}

// DELETE /api/assistant/conversations/[id]
//
// HARD-DELETES the conversation and every tied record (messages + actions).
// Cascade is enforced by the Prisma schema (AssistantMessage + AssistantAction
// both have onDelete: Cascade on the conversation FK), so a single delete call
// purges everything. The audit event is written BEFORE the delete so we always
// have a record even if the cascading delete fails partway through.
// Returns { ok: true }.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const row = await getOwned(session, id)

  // Audit-first so the deletion trail survives even a partial cascade failure.
  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: 'AI_CONVERSATION_DELETED',
      targetType: 'assistant_conversation',
      targetId: row.id,
      sourceSurface: 'ui',
      metadata: JSON.stringify({
        title: row.title,
        messageCount: row._count?.messages ?? 0,
        wasArchived: row.archived,
      }),
    },
  })

  // Cascade: AssistantMessage + AssistantAction both have onDelete: Cascade,
  // so deleting the conversation row purges them automatically.
  await db.assistantConversation.delete({ where: { id: row.id } })

  return NextResponse.json({ ok: true })
}
