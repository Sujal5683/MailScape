import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapEmailToList } from '@/lib/mappers'

export const dynamic = 'force-dynamic'

// GET /api/emails — cursor-paginated list with filters.
//
// Snooze semantics:
//   - Default (no snooze params): exclude emails whose snoozedUntil is in the
//     future (i.e., still snoozed). Expired snoozes (snoozedUntil in the past)
//     resurface here so the user sees them again.
//   - `snoozedOnly=true`: show only actively-snoozed emails (snoozedUntil set
//     AND in the future).
//   - `includeSnoozed=true`: no snooze filter at all (used by search/dashboard
//     style aggregations where the caller wants the full set).
//
// Archive semantics:
//   - `archivedOnly=true`: restrict to isArchived=true emails (the Archive
//     view). Skips the default snooze exclusion so archived emails with a
//     stale snoozedUntil still appear. Ordered by updatedAt desc so the most
//     recently archived/restored email surfaces first.
//
// Filter buckets (complements the boolean *Only params above):
//   - `filter=drafts` → isDraft=true (and not archived). The Drafts view.
//   - `filter=sent`   → isSent=true  (and not archived). The Sent view.
//   - `filter=spam`   → isSpam=true  (and not archived). The Spam view.
//   - `filter=starred`→ isStarred=true (and not archived). Complements the
//                      existing `starredOnly` param; both produce the same
//                      result set, but `filter=starred` also actively excludes
//                      drafts/sent/spam so the Starred surface shows only
//                      inbox-relevant starred items.
//   - Default (no filter, no archivedOnly): normal inbox — excludes archived,
//     drafts, sent, and spam. Existing *Only params (unreadOnly, importantOnly,
//     starredOnly, snoozedOnly, includeSnoozed) layer on top of this default.
export async function GET(req: Request) {
  const session = await getSession()
  const url = new URL(req.url)
  const cursor = url.searchParams.get('cursor') ?? undefined
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '30', 10), 100)
  const categoryId = url.searchParams.get('categoryId') ?? undefined
  const senderId = url.searchParams.get('senderId') ?? undefined
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true'
  const importantOnly = url.searchParams.get('importantOnly') === 'true'
  const starredOnly = url.searchParams.get('starredOnly') === 'true'
  const snoozedOnly = url.searchParams.get('snoozedOnly') === 'true'
  const includeSnoozed = url.searchParams.get('includeSnoozed') === 'true'
  // archivedOnly=true: restrict to isArchived=true emails (the Archive view).
  // When set, the default exclude-archived/snooze filtering below is skipped so
  // archived emails — which often also have a stale snoozedUntil — still show.
  const archivedOnly = url.searchParams.get('archivedOnly') === 'true'
  // Coarse bucket filter (drafts | sent | spam | starred). Each maps to a
  // single flag predicate and excludes archived items. Mutually exclusive in
  // practice with archivedOnly — when both are set, archivedOnly wins (the
  // archive view always shows every archived email regardless of bucket).
  const filter = url.searchParams.get('filter') ?? undefined
  const bucket: 'drafts' | 'sent' | 'spam' | 'starred' | null =
    filter === 'drafts' || filter === 'sent' || filter === 'spam' || filter === 'starred'
      ? filter
      : null

  const where: Record<string, unknown> = {
    accountId: session.accountIds.length > 0 ? { in: session.accountIds } : '__no_accounts__',
  }
  if (archivedOnly) {
    where.isArchived = true
  } else {
    // Bucket filter (drafts/sent/spam/starred) — each sets its flag and
    // excludes archived. The default (no bucket) excludes archived + drafts +
    // sent + spam so the normal inbox never shows those messages.
    if (bucket === 'drafts') {
      where.isDraft = true
      where.isArchived = false
    } else if (bucket === 'sent') {
      where.isSent = true
      where.isArchived = false
    } else if (bucket === 'spam') {
      where.isSpam = true
      where.isArchived = false
    } else if (bucket === 'starred') {
      where.isStarred = true
      where.isArchived = false
      where.isDraft = false
      where.isSent = false
      where.isSpam = false
    } else {
      // Default inbox: exclude archived + drafts + sent + spam.
      where.isArchived = false
      where.isDraft = false
      where.isSent = false
      where.isSpam = false
    }
  }
  if (unreadOnly) where.isRead = false
  if (importantOnly) where.isImportant = true
  if (starredOnly) where.isStarred = true
  if (senderId) where.senderId = senderId
  if (categoryId) {
    where.memberships = { some: { categoryId } }
  }
  const now = new Date()
  if (archivedOnly) {
    // No snooze filter for the archive view — we want every archived email
    // regardless of snooze state, ordered by the most recent change.
  } else if (snoozedOnly) {
    // Actively snoozed: has a future snoozedUntil.
    where.snoozedUntil = { not: null, gt: now }
  } else if (bucket === 'drafts') {
    // Drafts: order by updatedAt desc (most recently edited draft first). No
    // snooze filter — drafts are never snoozed in practice, and applying the
    // default exclude-snoozed clause would silently hide a draft that happened
    // to carry a stale snoozedUntil.
  } else if (!includeSnoozed) {
    // Default: not currently snoozed. Either snoozedUntil is null, or it has
    // already elapsed (resurfaced). Modeled as OR so the operator combines
    // cleanly with any other `where` predicates above.
    where.OR = [
      { snoozedUntil: null },
      { snoozedUntil: { lte: now } },
    ]
  }

  // Order: archive view → most recently updated first (restore/archive bumps
  // updatedAt); snoozed view → next resurface time; drafts → most recently
  // edited first (updatedAt); default → received desc.
  const orderBy = archivedOnly
    ? { updatedAt: 'desc' as const }
    : snoozedOnly
      ? { snoozedUntil: 'asc' as const }
      : bucket === 'drafts'
        ? { updatedAt: 'desc' as const }
        : { receivedAt: 'desc' as const }

  const [items, total] = await Promise.all([
    db.email.findMany({
      where,
      include: {
        attachments: true,
        memberships: { include: { category: true } },
      },
      orderBy,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    }),
    db.email.count({ where }),
  ])

  let nextCursor: string | null = null
  const list = items.slice(0, limit)
  if (items.length > limit) {
    nextCursor = items[limit - 1].id
  }

  return NextResponse.json({
    items: list.map(mapEmailToList),
    nextCursor,
    total,
  })
}
