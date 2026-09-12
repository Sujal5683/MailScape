import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { watchGmailAccount } from '@/lib/sync/gmail'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/auto-sync
 *
 * Called daily by Vercel Cron.
 * Renews the Google Cloud Pub/Sub watch for every active AccountConnection.
 * Gmail watches expire after 7 days, so running this daily keeps the Push 
 * Notification bridge alive permanently.
 *
 * Authorization: Bearer <CRON_SECRET> header required.
 */
export async function GET(req: Request) {
  // ── Auth: verify cron secret ─────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let renewed = 0
  let skipped = 0

  try {
    // Load all active accounts
    const accounts = await db.accountConnection.findMany({
      where: { status: { not: 'disconnected' } },
      select: {
        id: true,
        accessToken: true,
        refreshToken: true,
      },
    })

    for (const account of accounts) {
      // Skip accounts without OAuth tokens
      if (!account.accessToken && !account.refreshToken) {
        skipped++
        continue
      }

      // Renew the watch
      await watchGmailAccount(account.id)
      renewed++
    }

    return NextResponse.json({ ok: true, renewed, skipped, ts: new Date().toISOString() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    console.error('[cron/auto-sync] Fatal:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
