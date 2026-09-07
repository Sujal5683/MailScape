import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/sync/resume — resume automatic sync for the account.
export async function POST() {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await db.syncState.update({
    where: { accountId: session.accountId },
    data: { syncStatus: 'success', errorMessage: null },
  })
  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: 'SYNC_RESUMED',
      targetType: 'sync_state',
      targetId: session.accountId,
      sourceSurface: 'ui',
      metadata: JSON.stringify({}),
    },
  })
  return NextResponse.json({ ok: true, status: 'resumed' })
}
