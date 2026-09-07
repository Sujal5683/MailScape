import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { readBody, ApiError } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// POST /api/emails/bulk — apply an action to many emails at once.
// Body: { ids: string[], action: 'read'|'unread'|'star'|'unstar'|'important'|'unimportant'|'archive'|'delete' }
// All `ids` MUST belong to the session account — IDs that don't are silently
// dropped (the route never touches emails the user doesn't own).
// Returns { ok: true, affected: number }.
//
// Audit: ONE AuditEvent row is written per bulk op (summarizing the action,
// the affected count, and the list of owned ids in metadata) to avoid
// audit-log spam from large selections.
//
// Demo adaptation: `delete` is a soft-delete — sets `isArchived=true` so the
// underlying message is preserved (matches the rest of the demo pipeline).

export type BulkEmailAction =
  | 'read'
  | 'unread'
  | 'star'
  | 'unstar'
  | 'important'
  | 'unimportant'
  | 'archive'
  | 'delete'

const VALID_ACTIONS: BulkEmailAction[] = [
  'read',
  'unread',
  'star',
  'unstar',
  'important',
  'unimportant',
  'archive',
  'delete',
]

// Maps a bulk action to the human-readable audit event type.
// `delete` aliases to the archive event in this demo (since we soft-delete).
function eventTypeFor(action: BulkEmailAction): string {
  switch (action) {
    case 'read':
      return 'EMAIL_MARKED_READ'
    case 'unread':
      return 'EMAIL_MARKED_UNREAD'
    case 'star':
      return 'EMAIL_STARRED'
    case 'unstar':
      return 'EMAIL_UNSTARRED'
    case 'important':
      return 'EMAIL_MARKED_IMPORTANT'
    case 'unimportant':
      return 'EMAIL_UNMARKED_IMPORTANT'
    case 'archive':
      return 'EMAIL_ARCHIVED'
    case 'delete':
      return 'EMAIL_ARCHIVED' // demo: delete ⇒ archive
  }
}

function patchFor(action: BulkEmailAction): Record<string, boolean> {
  switch (action) {
    case 'read':
      return { isRead: true }
    case 'unread':
      return { isRead: false }
    case 'star':
      return { isStarred: true }
    case 'unstar':
      return { isStarred: false }
    case 'important':
      return { isImportant: true }
    case 'unimportant':
      return { isImportant: false }
    case 'archive':
      return { isArchived: true }
    case 'delete':
      return { isArchived: true } // demo: soft-delete via archive
  }
}

export async function POST(req: Request) {
  const session = await getSession()
  let body: { ids?: unknown; action?: unknown }
  try {
    body = await readBody<{ ids?: unknown; action?: unknown }>(req)
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 400
    const message = err instanceof Error ? err.message : 'Invalid JSON body'
    return NextResponse.json({ error: message }, { status })
  }

  // Validate ids
  const rawIds = body.ids
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return NextResponse.json(
      { error: '`ids` is required and must be a non-empty array' },
      { status: 400 },
    )
  }
  const ids = rawIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
  if (ids.length === 0) {
    return NextResponse.json(
      { error: '`ids` must contain at least one valid id' },
      { status: 400 },
    )
  }

  // Validate action
  const action = body.action
  if (typeof action !== 'string' || !VALID_ACTIONS.includes(action as BulkEmailAction)) {
    return NextResponse.json(
      { error: `\`action\` must be one of: ${VALID_ACTIONS.join(', ')}` },
      { status: 400 },
    )
  }
  const typedAction = action as BulkEmailAction

  // Enforce account ownership — only emails belonging to session.accountId
  // are touched. Non-owned ids are silently dropped (no information leak).
  const owned = await db.email.findMany({
    where: { id: { in: ids }, accountId: session.accountId },
    select: { id: true },
  })
  const ownedIds = owned.map((e) => e.id)
  if (ownedIds.length === 0) {
    return NextResponse.json({ ok: true, affected: 0 })
  }

  // Apply the action to all owned ids in one updateMany.
  const result = await db.email.updateMany({
    where: { id: { in: ownedIds }, accountId: session.accountId },
    data: patchFor(typedAction),
  })

  // ONE summarizing audit event for the bulk op.
  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: `BULK_${eventTypeFor(typedAction)}`,
      targetType: 'email',
      targetId: ownedIds[0],
      sourceSurface: 'ui',
      metadata: JSON.stringify({
        action: typedAction,
        affected: result.count,
        requestedCount: ids.length,
        ids: ownedIds,
      }),
    },
  })

  return NextResponse.json({ ok: true, affected: result.count })
}
