import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const VALID_INTERVALS = ['instantly', '5m', '15m', '30m', '1h', '2h', '6h', 'daily']

/**
 * GET /api/user/sync-interval
 * Returns the authenticated user's global auto-sync interval preference.
 */
export async function GET() {
  try {
    const session = await getSession()
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { autoSyncInterval: true },
    })
    return NextResponse.json({ autoSyncInterval: user?.autoSyncInterval ?? '15m' })
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

/**
 * PATCH /api/user/sync-interval
 * Body: { autoSyncInterval: string }
 * Updates the global auto-sync interval for all the user's accounts.
 */
export async function PATCH(req: Request) {
  try {
    const session = await getSession()
    const { autoSyncInterval } = (await req.json()) as { autoSyncInterval: string }

    if (!VALID_INTERVALS.includes(autoSyncInterval)) {
      return NextResponse.json(
        { error: `Invalid interval. Valid values: ${VALID_INTERVALS.join(', ')}` },
        { status: 400 },
      )
    }

    await db.user.update({
      where: { id: session.userId },
      data: { autoSyncInterval },
    })

    return NextResponse.json({ ok: true, autoSyncInterval })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update interval'
    return NextResponse.json({ error: msg }, { status: 401 })
  }
}
