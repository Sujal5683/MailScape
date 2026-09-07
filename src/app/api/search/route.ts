import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapEmailToList } from '@/lib/mappers'
import { readBody } from '@/lib/api-helpers'
import type { SearchFilters } from '@/lib/types'

export const dynamic = 'force-dynamic'

// POST /api/search — structured filters → cursor-paginated results.
export async function POST(req: Request) {
  const session = await getSession()
  const filters = await readBody<SearchFilters>(req)
  const limit = Math.min(filters.limit ?? 30, 100)

  if (session.accountIds.length === 0) return NextResponse.json({ items: [], nextCursor: null, total: 0 })
  const where: Record<string, unknown> = { accountId: { in: session.accountIds } }

  if (filters.query) {
    where.OR = [
      { subject: { contains: filters.query } },
      { snippet: { contains: filters.query } },
      { bodyText: { contains: filters.query } },
      { fromEmail: { contains: filters.query } },
      { fromName: { contains: filters.query } },
    ]
  }
  if (filters.sender) {
    where.OR = [
      ...(Array.isArray(where.OR) ? where.OR : []),
      { fromEmail: { contains: filters.sender } },
      { fromName: { contains: filters.sender } },
    ]
  }
  if (filters.isRead !== undefined) where.isRead = filters.isRead
  if (filters.isStarred !== undefined) where.isStarred = filters.isStarred
  if (filters.isImportant !== undefined) where.isImportant = filters.isImportant
  if (filters.hasAttachment !== undefined) where.hasAttachment = filters.hasAttachment
  if (!filters.includeSpam) where.isSpam = false
  if (!filters.includeDrafts) where.isDraft = false
  if (!filters.includeSent) where.isSent = false
  if (!filters.includeArchived) where.isArchived = false

  if (filters.categoryIds && filters.categoryIds.length > 0) {
    where.memberships = { some: { categoryId: { in: filters.categoryIds } } }
  }

  if (filters.dateFrom || filters.dateTo) {
    const range: Record<string, Date> = {}
    if (filters.dateFrom) range.gte = new Date(filters.dateFrom)
    if (filters.dateTo) range.lte = new Date(filters.dateTo)
    where.receivedAt = range
  }

  if (filters.labels && filters.labels.length > 0) {
    // SQLite has no array contains; filter post-query for labels.
  }

  let items = await db.email.findMany({
    where,
    include: { attachments: true, memberships: { include: { category: true } } },
    orderBy: { receivedAt: 'desc' },
    take: limit + 1,
    ...(filters.cursor ? { skip: 1, cursor: { id: filters.cursor } } : {}),
  })

  // Post-filter by labels (SQLite limitation).
  if (filters.labels && filters.labels.length > 0) {
    items = items.filter((e) => {
      try {
        const labels = JSON.parse(e.labels) as string[]
        return filters.labels!.some((l) => labels.includes(l))
      } catch {
        return false
      }
    })
  }

  // Time-of-day filter.
  if (filters.timeFrom && filters.timeTo) {
    const [fh, fm] = filters.timeFrom.split(':').map(Number)
    const [th, tm] = filters.timeTo.split(':').map(Number)
    items = items.filter((e) => {
      if (!e.receivedAt) return false
      const mins = e.receivedAt.getHours() * 60 + e.receivedAt.getMinutes()
      return mins >= fh * 60 + fm && mins <= th * 60 + tm
    })
  }

  // Attachment type filter.
  if (filters.attachmentType) {
    items = items.filter((e) =>
      e.attachments.some((a) => a.mimeType.toLowerCase().includes(filters.attachmentType!.toLowerCase())),
    )
  }

  const total = items.length
  let nextCursor: string | null = null
  const list = items.slice(0, limit)
  if (items.length > limit) {
    nextCursor = items[limit - 1].id
  }

  return NextResponse.json({
    items: list.map(mapEmailToList),
    nextCursor,
    total,
    parsedFilters: filters,
  })
}
