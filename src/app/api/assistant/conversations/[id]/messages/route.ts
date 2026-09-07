import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { readBody, notFound } from '@/lib/api-helpers'
import { runAssistant } from '@/lib/ai/orchestrator'
import type { AssistantMessageDTO, AssistantMode, AssistantContentBlock, SourceRef } from '@/lib/types'

export const dynamic = 'force-dynamic'

function mapMsg(m: { id: string; conversationId: string; role: string; contentJson: string; attachments: string; sources: string; createdAt: Date }): AssistantMessageDTO {
  return {
    id: m.id,
    conversationId: m.conversationId,
    role: m.role as AssistantMessageDTO['role'],
    content: safeParse<AssistantContentBlock[]>(m.contentJson) ?? [{ type: 'text', text: '' }],
    attachments: safeParse(m.attachments) ?? [],
    sources: safeParse<SourceRef[]>(m.sources) ?? [],
    createdAt: m.createdAt.toISOString(),
  }
}

function safeParse<T>(s: string): T | null {
  try { return JSON.parse(s) as T } catch { return null }
}

// GET /api/assistant/conversations/[id]/messages
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  const { id } = await ctx.params
  const conv = await db.assistantConversation.findFirst({ where: { id, userId: session.userId } })
  if (!conv) throw notFound('Conversation not found')
  const msgs = await db.assistantMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(msgs.map(mapMsg))
}

// POST /api/assistant/conversations/[id]/messages — send a user message, get assistant response.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  const { id } = await ctx.params
  const conv = await db.assistantConversation.findFirst({ where: { id, userId: session.userId } })
  if (!conv) throw notFound('Conversation not found')

  const body = await readBody<{ content: string; mode?: AssistantMode; confirmedActionId?: string }>(req)

  // Persist user message.
  const userMsg = await db.assistantMessage.create({
    data: {
      conversationId: id,
      role: 'user',
      contentJson: JSON.stringify([{ type: 'text', text: body.content }]),
      attachments: '[]',
      sources: '[]',
    },
  })

  // Load history (last 10 messages).
  const historyRows = await db.assistantMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'asc' },
    take: 20,
  })
  const history = historyRows.map((m) => {
    const blocks = safeParse<AssistantContentBlock[]>(m.contentJson) ?? []
    const text = blocks.map((b) => b.text ?? '').filter(Boolean).join(' ')
    return { role: m.role as 'user' | 'assistant', content: text || '(structured response)' }
  })

  // Update mode if provided.
  if (body.mode && body.mode !== conv.mode) {
    await db.assistantConversation.update({ where: { id }, data: { mode: body.mode } })
  }

  // Run orchestrator.
  const result = await runAssistant({
    conversationId: id,
    userId: session.userId,
    accountId: session.accountId,
    userMessage: body.content,
    mode: body.mode ?? (conv.mode as AssistantMode),
    history,
    confirmedActionId: body.confirmedActionId,
  })

  // Persist assistant message.
  const assistantMsg = await db.assistantMessage.create({
    data: {
      conversationId: id,
      role: 'assistant',
      contentJson: JSON.stringify(result.content),
      attachments: '[]',
      sources: JSON.stringify(result.sources),
    },
  })

  // Auto-title from first user message.
  if (!conv.title || conv.title === 'New conversation') {
    await db.assistantConversation.update({
      where: { id },
      data: { title: body.content.slice(0, 48) },
    })
  }

  return NextResponse.json({
    userMessage: mapMsg(userMsg),
    assistantMessage: mapMsg(assistantMsg),
    actions: result.actions,
  })
}
