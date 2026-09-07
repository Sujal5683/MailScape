import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { notFound } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// DELETE /api/saved-searches/[id] — delete a saved-search preset.
// Account-scoped: a preset owned by a different account is treated as
// "not found" (404) so we never leak existence across accounts. Returns
// { ok: true } and emits a SAVED_SEARCH_DELETED audit event.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  const { id } = await ctx.params

  // findFirst (not findUnique) so the accountId filter is enforced — a
  // foreign preset returns null and we 404 rather than 403.
  const row = await db.savedSearch.findFirst({
    where: { id, accountId: session.accountId },
  })
  if (!row) throw notFound('Saved search not found')

  await db.savedSearch.delete({ where: { id: row.id } })

  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: 'SAVED_SEARCH_DELETED',
      targetType: 'saved_search',
      targetId: row.id,
      sourceSurface: 'ui',
      metadata: JSON.stringify({ name: row.name }),
    },
  })

  return NextResponse.json({ ok: true })
}
