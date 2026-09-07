import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapCategory } from '@/lib/mappers'
import { readBody, ApiError } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// GET /api/categories — list with counts across all connected accounts.
export async function GET() {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.accountIds.length === 0) return NextResponse.json([])
  const categories = await db.category.findMany({
    where: { accountId: { in: session.accountIds } },
    include: {
      memberships: {
        include: { email: { select: { isRead: true, isImportant: true, receivedAt: true } } },
      },
      _count: { select: { memberships: true } },
    },
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json(categories.map(mapCategory))
}

// POST /api/categories — create a custom category on the primary account.
export async function POST(req: Request) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Scope new categories to the first active account.
  const accountId = session.accountIds[0]
  if (!accountId) throw new ApiError('No connected accounts', 400)
  const body = await readBody<{ name: string; description?: string; color?: string; icon?: string }>(req)
  if (!body.name?.trim()) throw new ApiError('Name is required', 400)
  const existing = await db.category.findFirst({
    where: { accountId, name: body.name },
  })
  if (existing) throw new ApiError('Category already exists', 409)
  const maxOrder = await db.category.aggregate({
    where: { accountId },
    _max: { sortOrder: true },
  })
  const cat = await db.category.create({
    data: {
      accountId,
      name: body.name.trim(),
      description: body.description,
      color: body.color ?? 'slate',
      icon: body.icon ?? 'folder',
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      systemDefault: false,
    },
    include: { memberships: true, _count: { select: { memberships: true } } },
  })
  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId,
      eventType: 'CATEGORY_CREATED',
      targetType: 'category',
      targetId: cat.id,
      sourceSurface: 'ui',
      metadata: JSON.stringify({ name: cat.name }),
    },
  })
  return NextResponse.json(mapCategory({ ...cat, memberships: [] }))
}
