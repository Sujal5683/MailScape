import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { deletePushSubscription } from '@/lib/push/web-push'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/push/unsubscribe
 * Body: { endpoint: string }
 *
 * Removes a push subscription from the database.
 * Called when the user disables push notifications in Settings.
 */
export async function DELETE(req: Request) {
  try {
    await getSession() // Auth guard — throws if unauthenticated
    const { endpoint } = (await req.json()) as { endpoint: string }
    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint required' }, { status: 400 })
    }
    await deletePushSubscription(endpoint)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to remove subscription'
    return NextResponse.json({ error: msg }, { status: 401 })
  }
}
