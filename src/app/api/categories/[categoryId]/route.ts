import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapCategory } from '@/lib/mappers'
import { readBody, ApiError, notFound } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

async function getOwned(session: { accountId: string; userId: string }, id: string) {
  const cat = await db.category.findFirst({ where: { id, accountId: session.accountId } })
  if (!cat) throw notFound('Category not found')
  return cat
}

export async function PATCH(req: Request, ctx: { params: Promise<{ categoryId: string }> }) {
  const session = await getSession()
  const { categoryId } = await ctx.params
  await getOwned(session, categoryId)
  const body = await readBody<Partial<{ name: string; description: string; color: string; icon: string }>>(req)
  const cat = await db.category.update({
    where: { id: categoryId },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.color !== undefined ? { color: body.color } : {}),
      ...(body.icon !== undefined ? { icon: body.icon } : {}),
    },
    include: { memberships: { include: { email: { select: { isRead: true, isImportant: true, receivedAt: true } } } }, _count: { select: { memberships: true } } },
  })
  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: 'CATEGORY_UPDATED',
      targetType: 'category',
      targetId: categoryId,
      sourceSurface: 'ui',
      metadata: JSON.stringify(body),
    },
  })
  return NextResponse.json(mapCategory(cat))
}

export async function DELETE(req: Request, ctx: { params: Promise<{ categoryId: string }> }) {
  const session = await getSession()
  const { categoryId } = await ctx.params
  const cat = await getOwned(session, categoryId)
  if (cat.systemDefault) throw new ApiError('System categories cannot be deleted', 400)
  // Move memberships to "Others" first.
  const others = await db.category.findFirst({
    where: { accountId: session.accountId, name: 'Others' },
  })
  if (others) {
    await db.categoryMembership.updateMany({
      where: { categoryId },
      data: { categoryId: others.id, source: 'system_default' },
    })
  }
  await db.category.delete({ where: { id: categoryId } })
  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: 'CATEGORY_DELETED',
      targetType: 'category',
      targetId: categoryId,
      sourceSurface: 'ui',
      metadata: JSON.stringify({ name: cat.name }),
    },
  })
  return NextResponse.json({ ok: true })
}
