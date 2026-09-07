import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const session = await getSession().catch(() => null)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const body = await req.json()
    const { accountId, autoSyncInterval } = body

    if (!accountId || !autoSyncInterval) {
      return NextResponse.json({ error: 'Missing accountId or autoSyncInterval' }, { status: 400 })
    }

    // Verify account belongs to user (or if we have multi-user, currently we assume session is valid)
    const syncState = await db.syncState.findUnique({
      where: { accountId },
    })

    if (!syncState) {
      return NextResponse.json({ error: 'SyncState not found for account' }, { status: 404 })
    }

    await db.syncState.update({
      where: { accountId },
      data: { autoSyncInterval },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update interval'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
