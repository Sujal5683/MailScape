/**
 * @deprecated Use /api/user/sync-interval instead.
 * This route now delegates to the global user-level interval endpoint
 * for backwards compatibility with any existing callers.
 */
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

const VALID_INTERVALS = ['instantly', '5m', '15m', '30m', '1h', '2h', '6h', 'daily']

export async function POST(req: Request) {
  try {
    const session = await getSession().catch(() => null)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { autoSyncInterval } = body as { accountId?: string; autoSyncInterval?: string }

    if (!autoSyncInterval || !VALID_INTERVALS.includes(autoSyncInterval)) {
      return NextResponse.json({ error: 'Invalid or missing autoSyncInterval' }, { status: 400 })
    }

    // Update at the user level (global, applies to all accounts)
    await db.user.update({
      where: { id: session.userId },
      data: { autoSyncInterval },
    })

    return NextResponse.json({ ok: true, autoSyncInterval })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update interval'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
