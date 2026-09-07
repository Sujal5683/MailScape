import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import type { AuditEventDTO, AuditEventPage, AuditSourceSurface } from '@/lib/types'

export const dynamic = 'force-dynamic'

const SURFACES: ReadonlySet<AuditSourceSurface> = new Set(['ui', 'ai', 'api', 'system'])

// Map a raw AuditEvent row to the public AuditEventDTO. The metadata column is
// already sanitized when written (no userId, no raw email bodies), so we just
// parse + default to an empty object on a corrupt row.
function mapRow(row: {
  id: string
  eventType: string
  targetType: string | null
  targetId: string | null
  sourceSurface: string | null
  actionId: string | null
  metadata: string
  createdAt: Date
}): AuditEventDTO {
  let metadata: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(row.metadata)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      metadata = parsed as Record<string, unknown>
    }
  } catch {
    metadata = {}
  }
  return {
    id: row.id,
    eventType: row.eventType,
    targetType: row.targetType,
    targetId: row.targetId,
    sourceSurface: (row.sourceSurface as AuditSourceSurface | null) ?? null,
    actionId: row.actionId,
    metadata,
    createdAt: row.createdAt.toISOString(),
  }
}

// GET /api/audit-events — list audit events for the session account.
//
// Query params:
//   ?type=    partial eventType match (e.g. "EMAIL_", "AI_RULE_CREATED")
//   ?surface= ui | ai | api | system
//   ?limit=   page size (default 50, capped at 200)
//   ?cursor=  id cursor for pagination (ordered by createdAt desc, then id desc)
//
// Returns { items, nextCursor, total } — nextCursor is null when the last page
// was returned. Account-scoped (accountId = session.accountId).
export async function GET(req: Request) {
  const session = await getSession()
  const url = new URL(req.url)
  const type = url.searchParams.get('type')?.trim() || undefined
  const surfaceRaw = url.searchParams.get('surface')?.trim() || undefined
  const surface =
    surfaceRaw && SURFACES.has(surfaceRaw as AuditSourceSurface)
      ? (surfaceRaw as AuditSourceSurface)
      : undefined
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 1),
    200,
  )
  const cursor = url.searchParams.get('cursor') || undefined

  const where: Record<string, unknown> = { accountId: session.accountId }
  if (type) where.eventType = { contains: type }
  if (surface) where.sourceSurface = surface

  const [rows, total] = await Promise.all([
    db.auditEvent.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    }),
    db.auditEvent.count({ where }),
  ])

  let nextCursor: string | null = null
  const list = rows.slice(0, limit)
  if (rows.length > limit) {
    nextCursor = list[list.length - 1].id
  }

  const page: AuditEventPage = {
    items: list.map(mapRow),
    nextCursor,
    total,
  }
  return NextResponse.json(page)
}
