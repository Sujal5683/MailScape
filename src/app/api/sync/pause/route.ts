import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/sync/pause — pause automatic sync for the account.
export async function POST() {
  const session = await getSession()
  await db.syncState.update({
    where: { accountId: session.accountId },
    data: { syncStatus: 'idle', errorMessage: 'Sync paused by user' },
  })
  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: 'SYNC_PAUSED',
      targetType: 'sync_state',
      targetId: session.accountId,
      sourceSurface: 'ui',
      metadata: JSON.stringify({}),
    },
  })
  return NextResponse.json({ ok: true, status: 'paused' })
}
