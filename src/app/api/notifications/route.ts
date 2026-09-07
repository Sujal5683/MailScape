import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapNotification } from '@/lib/mappers'
import type { NotificationGroup } from '@/lib/types'

export const dynamic = 'force-dynamic'

// GET /api/notifications?filter=all|unread|important — grouped notification center.
export async function GET(req: Request) {
  const session = await getSession()
  const url = new URL(req.url)
  const filter = url.searchParams.get('filter') ?? 'all'
  if (session.accountIds.length === 0) return NextResponse.json([])
  const where: Record<string, unknown> = { accountId: { in: session.accountIds } }
  if (filter === 'unread') where.isRead = false
  if (filter === 'important') where.importance = { in: ['important', 'urgent'] }

  const rows = await db.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { category: true },
  })

  // Group by category.
  const groups = new Map<string, NotificationGroup>()
  for (const n of rows) {
    const key = n.categoryId ?? 'uncategorized'
    const label = n.category?.name ?? 'Uncategorized'
    const color = n.category?.color ?? 'slate'
    const icon = n.category?.icon ?? 'inbox'
    if (!groups.has(key)) {
      groups.set(key, { key, label, color, icon, count: 0, unreadCount: 0, items: [] })
    }
    const g = groups.get(key)!
    g.count++
    if (!n.isRead) g.unreadCount++
    g.items.push(mapNotification(n))
  }
  return NextResponse.json(Array.from(groups.values()).sort((a, b) => b.unreadCount - a.unreadCount || b.count - a.count))
}
