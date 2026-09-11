import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { savePushSubscription } from '@/lib/push/web-push'

export const dynamic = 'force-dynamic'

/**
 * POST /api/push/subscribe
 * Body: { endpoint: string, keys: { p256dh: string, auth: string } }
 *
 * Saves/updates the browser push subscription for the authenticated user.
 * Called from the client-side usePushNotifications hook after subscribing.
 */
export async function POST(req: Request) {
  try {
    const session = await getSession()
    const body = await req.json()
    const { endpoint, keys } = body as {
      endpoint: string
      keys: { p256dh: string; auth: string }
    }

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription payload' }, { status: 400 })
    }

    const userAgent = req.headers.get('user-agent') ?? undefined
    await savePushSubscription(session.userId, { endpoint, keys }, userAgent)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save subscription'
    return NextResponse.json({ error: msg }, { status: 401 })
  }
}
