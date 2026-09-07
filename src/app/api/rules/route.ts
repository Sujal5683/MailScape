import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapRule } from '@/lib/mappers'
import { readBody, ApiError } from '@/lib/api-helpers'
import type { ConditionGroup, RuleAction } from '@/lib/types'

export const dynamic = 'force-dynamic'

// GET /api/rules
export async function GET() {
  const session = await getSession()
  if (session.accountIds.length === 0) return NextResponse.json([])
  const rules = await db.rule.findMany({
    where: { accountId: { in: session.accountIds } },
    orderBy: { priority: 'asc' },
  })
  return NextResponse.json(rules.map(mapRule))
}

// POST /api/rules — create rule scoped to the primary account.
export async function POST(req: Request) {
  const session = await getSession()
  const accountId = session.accountIds[0]
  if (!accountId) throw new ApiError('No connected accounts', 400)
  const body = await readBody<{
    name: string
    expression: ConditionGroup
    actions: RuleAction[]
    priority?: number
    enabled?: boolean
  }>(req)
  if (!body.name?.trim()) throw new ApiError('Name is required', 400)
  if (!body.expression || !body.actions) throw new ApiError('Expression and actions are required', 400)

  const rule = await db.rule.create({
    data: {
      accountId,
      name: body.name.trim(),
      expression: JSON.stringify(body.expression),
      actions: JSON.stringify(body.actions),
      priority: body.priority ?? 100,
      enabled: body.enabled ?? true,
      createdBy: 'user',
    },
  })

  // Version snapshot.
  await db.ruleVersion.create({
    data: {
      ruleId: rule.id,
      version: 1,
      expression: rule.expression,
      actions: rule.actions,
    },
  })

  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId,
      eventType: 'RULE_CREATED',
      targetType: 'rule',
      targetId: rule.id,
      sourceSurface: 'ui',
      metadata: JSON.stringify({ name: rule.name, ruleId: rule.id }),
    },
  })

  return NextResponse.json(mapRule(rule))
}
