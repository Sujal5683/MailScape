import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapDeadline, mapActionItem } from '@/lib/mappers'
import type { DashboardData } from '@/lib/types'

export const dynamic = 'force-dynamic'

// GET /api/dashboard — aggregated operational view, unified across all connected accounts.
export async function GET() {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accountIds = session.accountIds

  // Return a sensible empty state when no accounts are connected yet.
  if (accountIds.length === 0) {
    const empty: DashboardData = {
      totals: { emails: 0, unread: 0, important: 0, attachments: 0, senders: 0, categories: 0, deadlinesOpen: 0, notificationsUnread: 0 },
      categoryCounts: [],
      topSenders: [],
      trend: [],
      deadlines: [],
      actionItems: [],
      recentActivity: [],
      aiBrief: {
        summary: 'Connect a Google account to start syncing your inbox.',
        highlights: [],
      },
    }
    return NextResponse.json(empty)
  }

  const where = { accountId: { in: accountIds } }

  const [total, unread, important, attachments, senders, deadlinesOpen, notificationsUnread] = await Promise.all([
    db.email.count({ where }),
    db.email.count({ where: { ...where, isRead: false } }),
    db.email.count({ where: { ...where, isImportant: true } }),
    db.email.count({ where: { ...where, hasAttachment: true } }),
    db.sender.count({ where }),
    db.deadline.count({ where: { ...where, status: 'open' } }),
    db.notification.count({ where: { ...where, isRead: false } }),
  ])

  const categories = await db.category.findMany({
    where,
    include: {
      memberships: { include: { email: { select: { isRead: true, receivedAt: true } } } },
      _count: { select: { memberships: true } },
    },
    orderBy: { sortOrder: 'asc' },
  })
  const categoryCounts = categories.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
    count: c._count.memberships,
    unread: c.memberships.filter((m) => !m.email.isRead).length,
  }))

  const topSenders = await db.sender.findMany({
    where,
    orderBy: { messageCount: 'desc' },
    take: 6,
    select: { id: true, senderName: true, senderEmail: true, messageCount: true, domain: true },
  })

  // 14-day trend.
  const since = new Date()
  since.setDate(since.getDate() - 13)
  since.setHours(0, 0, 0, 0)
  const recentEmails = await db.email.findMany({
    where: { ...where, receivedAt: { gte: since } },
    select: { receivedAt: true },
  })
  const trendMap = new Map<string, number>()
  for (let i = 0; i < 14; i++) {
    const d = new Date(since)
    d.setDate(since.getDate() + i)
    trendMap.set(d.toISOString().slice(0, 10), 0)
  }
  for (const e of recentEmails) {
    if (!e.receivedAt) continue
    const key = e.receivedAt.toISOString().slice(0, 10)
    trendMap.set(key, (trendMap.get(key) ?? 0) + 1)
  }
  const trend = Array.from(trendMap.entries()).map(([date, count]) => ({ date, count }))

  const deadlineRows = await db.deadline.findMany({
    where: { ...where, status: 'open' },
    orderBy: { dueAt: 'asc' },
    take: 8,
    include: { email: { select: { subject: true } }, category: true },
  })
  const deadlines = deadlineRows.map(mapDeadline)

  const actionItemRows = await db.actionItem.findMany({
    where: { ...where, status: 'open' },
    orderBy: { createdAt: 'desc' },
    take: 6,
  })
  const actionItems = actionItemRows.map(mapActionItem)

  const recentRows = await db.email.findMany({
    where,
    orderBy: { receivedAt: 'desc' },
    take: 8,
    include: { memberships: { include: { category: true } } },
  })
  const recentActivity = recentRows.map((e) => ({
    id: e.id,
    subject: e.subject,
    fromEmail: e.fromEmail,
    receivedAt: e.receivedAt?.toISOString() ?? null,
    categoryName: e.memberships[0]?.category.name ?? null,
    categoryColor: e.memberships[0]?.category.color ?? null,
  }))

  // AI brief — deterministic summary from aggregates.
  const topCat = categoryCounts.slice().sort((a, b) => b.count - a.count)[0]
  const aiBrief = {
    summary: `You have ${unread} unread email${unread === 1 ? '' : 's'} across ${categoryCounts.filter((c) => c.count > 0).length} active sections. ${deadlinesOpen} open deadline${deadlinesOpen === 1 ? '' : 's'} need attention${topCat ? `, with "${topCat.name}" being your busiest section (${topCat.count})` : ''}.`,
    highlights: [
      { label: 'Unread', value: String(unread) },
      { label: 'Open deadlines', value: String(deadlinesOpen) },
      { label: 'Important', value: String(important) },
      { label: 'Active senders', value: String(senders) },
    ],
  }

  const data: DashboardData = {
    totals: {
      emails: total,
      unread,
      important,
      attachments,
      senders,
      categories: categories.length,
      deadlinesOpen,
      notificationsUnread,
    },
    categoryCounts,
    topSenders: topSenders.map((s) => ({ id: s.id, name: s.senderName, email: s.senderEmail, count: s.messageCount, domain: s.domain })),
    trend,
    deadlines,
    actionItems,
    recentActivity,
    aiBrief,
  }
  return NextResponse.json(data)
}
