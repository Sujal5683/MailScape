import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapRule } from '@/lib/mappers'
import { readBody, notFound } from '@/lib/api-helpers'
import type { ConditionGroup, RuleAction } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, ctx: { params: Promise<{ ruleId: string }> }) {
  const session = await getSession()
  const { ruleId } = await ctx.params
  const existing = await db.rule.findFirst({ where: { id: ruleId, accountId: session.accountId } })
  if (!existing) throw notFound('Rule not found')
  const body = await readBody<Partial<{ name: string; expression: ConditionGroup; actions: RuleAction[]; priority: number; enabled: boolean }>>(req)

  const updated = await db.rule.update({
    where: { id: ruleId },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.expression !== undefined ? { expression: JSON.stringify(body.expression) } : {}),
      ...(body.actions !== undefined ? { actions: JSON.stringify(body.actions) } : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    },
  })

  // New version snapshot if expression/actions changed.
  if (body.expression || body.actions) {
    const lastVersion = await db.ruleVersion.aggregate({
      where: { ruleId },
      _max: { version: true },
    })
    const nextVersion = (lastVersion._max.version ?? 0) + 1
    await db.ruleVersion.create({
      data: {
        ruleId,
        version: nextVersion,
        expression: updated.expression,
        actions: updated.actions,
      },
    })
  }

  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: 'RULE_UPDATED',
      targetType: 'rule',
      targetId: ruleId,
      sourceSurface: 'ui',
      metadata: JSON.stringify(body),
    },
  })

  return NextResponse.json(mapRule(updated))
}

export async function DELETE(req: Request, ctx: { params: Promise<{ ruleId: string }> }) {
  const session = await getSession()
  const { ruleId } = await ctx.params
  const existing = await db.rule.findFirst({ where: { id: ruleId, accountId: session.accountId } })
  if (!existing) throw notFound('Rule not found')
  await db.rule.delete({ where: { id: ruleId } })
  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: 'RULE_DELETED',
      targetType: 'rule',
      targetId: ruleId,
      sourceSurface: 'ui',
      metadata: JSON.stringify({ name: existing.name }),
    },
  })
  return NextResponse.json({ ok: true })
}
