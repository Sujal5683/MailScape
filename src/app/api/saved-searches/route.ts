import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { readBody, ApiError } from '@/lib/api-helpers'
import type { SearchFilters, SavedSearch } from '@/lib/types'

export const dynamic = 'force-dynamic'

// Whitelisted SearchFilters keys — anything else in the payload is dropped
// so we never persist unexpected fields. Mirrors the SearchFilters contract.
const ALLOWED_FILTER_KEYS: ReadonlyArray<keyof SearchFilters> = [
  'query',
  'sender',
  'categoryIds',
  'isRead',
  'isStarred',
  'isImportant',
  'hasAttachment',
  'attachmentType',
  'dateFrom',
  'dateTo',
  'timeFrom',
  'timeTo',
  'labels',
  'includeSpam',
  'includeDrafts',
  'includeSent',
  'includeArchived',
  'cursor',
  'limit',
]

function sanitizeFilters(raw: unknown): SearchFilters {
  if (!raw || typeof raw !== 'object') throw new ApiError('filters must be an object', 400)
  const src = raw as Record<string, unknown>
  const out: SearchFilters = {}
  for (const key of ALLOWED_FILTER_KEYS) {
    if (key in src) {
      // Indexed assignment with a typed key — the cast below is the only
      // ergonomic way to write to a heterogeneous indexable interface.
      ;(out as Record<string, unknown>)[key as string] = src[key]
    }
  }
  return out
}

function mapRow(row: {
  id: string
  accountId: string
  name: string
  filters: string
  createdAt: Date
  updatedAt: Date
}): SavedSearch {
  let parsed: SearchFilters
  try {
    parsed = JSON.parse(row.filters) as SearchFilters
  } catch {
    parsed = {}
  }
  return {
    id: row.id,
    accountId: row.accountId,
    name: row.name,
    filters: parsed,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// GET /api/saved-searches — list filter presets for the session account,
// newest first. Empty list when none saved (no 404 — the panel renders an
// empty state either way).
export async function GET() {
  const session = await getSession()
  if (session.accountIds.length === 0) return NextResponse.json([])
  const rows = await db.savedSearch.findMany({
    where: { accountId: { in: session.accountIds } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(rows.map(mapRow))
}

// POST /api/saved-searches — create a new filter preset.
// Body: { name: string, filters: SearchFilters }
// Returns the created row (mapped to SavedSearch DTO). Validates name +
// filters shape; rejects empty names. Persists filters as a JSON string.
export async function POST(req: Request) {
  const session = await getSession()
  const body = await readBody<{ name?: string; filters?: unknown }>(req)
  const name = body.name?.trim()
  if (!name) throw new ApiError('Name is required', 400)
  if (name.length > 120) throw new ApiError('Name must be 120 characters or fewer', 400)
  if (!body.filters) throw new ApiError('filters is required', 400)
  const filters = sanitizeFilters(body.filters)

  const row = await db.savedSearch.create({
    data: {
      accountId: session.accountId,
      name,
      filters: JSON.stringify(filters),
    },
  })

  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: 'SAVED_SEARCH_CREATED',
      targetType: 'saved_search',
      targetId: row.id,
      sourceSurface: 'ui',
      metadata: JSON.stringify({ name }),
    },
  })

  return NextResponse.json(mapRow(row))
}
