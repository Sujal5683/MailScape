import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { notFound } from '@/lib/api-helpers'
import type { AssistantActionDTO } from '@/lib/types'

export const dynamic = 'force-dynamic'

// GET /api/assistant/conversations/[id]/actions — action log for the conversation.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const conv = await db.assistantConversation.findFirst({ where: { id, userId: session.userId } })
  if (!conv) throw notFound('Conversation not found')
  const actions = await db.assistantAction.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'desc' },
  })
  const out: AssistantActionDTO[] = actions.map((a) => ({
    id: a.id,
    conversationId: a.conversationId,
    toolName: a.toolName,
    inputSummary: safeParse(a.inputSummary) ?? {},
    resultSummary: safeParse(a.resultSummary ?? '{}') ?? {},
    reversible: a.reversible,
    status: a.status as AssistantActionDTO['status'],
    errorMessage: a.errorMessage,
    createdAt: a.createdAt.toISOString(),
    revertedAt: a.revertedAt?.toISOString() ?? null,
  }))
  return NextResponse.json(out)
}

function safeParse(s: string): Record<string, unknown> | null {
  try { return JSON.parse(s) as Record<string, unknown> } catch { return null }
}
