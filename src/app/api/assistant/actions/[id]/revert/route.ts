import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { notFound, ApiError } from '@/lib/api-helpers'
import { revertAction } from '@/lib/ai/orchestrator'

export const dynamic = 'force-dynamic'

// POST /api/assistant/actions/[id]/revert — executes the recorded inverse operation.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const action = await db.assistantAction.findFirst({
    where: { id, userId: session.userId },
  })
  if (!action) throw notFound('Action not found')
  if (!action.reversible) throw new ApiError('Action is not reversible', 400)
  if (action.status === 'reverted') throw new ApiError('Action already reverted', 409)

  const inverse = action.inversePayload ? JSON.parse(action.inversePayload) : null
  if (!inverse || !inverse.tool || !inverse.payload) {
    throw new ApiError('No inverse operation recorded', 400)
  }

  const result = await revertAction({
    toolName: action.toolName,
    inverseTool: inverse.tool,
    inversePayload: inverse.payload,
    conversationId: action.conversationId,
    accountId: session.accountId,
    userId: session.userId,
  })

  if (!result.ok) throw new ApiError(result.error ?? 'Revert failed', 500)

  await db.assistantAction.update({
    where: { id },
    data: { status: 'reverted', revertedAt: new Date() },
  })
  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: 'AI_ACTION_REVERTED',
      targetType: 'assistant_action',
      targetId: id,
      sourceSurface: 'ui',
      metadata: JSON.stringify({ toolName: action.toolName }),
    },
  })
  return NextResponse.json({ ok: true, status: 'reverted' })
}
