import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Map interval string to milliseconds */
const INTERVAL_MS: Record<string, number> = {
  instantly: 60_000,         // 1 min polling (minimum safe interval)
  '5m':  5  * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h':  60 * 60_000,
  '2h':  2  * 60 * 60_000,
  '6h':  6  * 60 * 60_000,
  daily: 24 * 60 * 60_000,
}

/**
 * GET /api/cron/auto-sync
 *
 * Called every 5 minutes by Vercel Cron (or any external scheduler).
 * Finds every active AccountConnection whose last sync was longer ago than
 * the owner's autoSyncInterval, then triggers a real Gmail sync for each.
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

  const now = Date.now()
  let triggered = 0
  let skipped  = 0

  try {
    // Load all active users with their accounts + syncState
    const users = await db.user.findMany({
      select: {
        id: true,
        autoSyncInterval: true,
        accounts: {
          where: { status: { not: 'disconnected' } },
          select: {
            id: true,
            accessToken: true,
            refreshToken: true,
            syncState: { select: { lastSyncedAt: true, syncStatus: true, updatedAt: true } },
          },
        },
      },
    })

    for (const user of users) {
      const intervalMs = INTERVAL_MS[user.autoSyncInterval] ?? INTERVAL_MS['15m']

      for (const account of user.accounts) {
        const syncState = account.syncState

        // Skip accounts without OAuth tokens (not yet connected via Google OAuth)
        if (!account.accessToken && !account.refreshToken) {
          skipped++
          continue
        }

        // Skip if sync is currently running and hasn't timed out (5 min guard)
        if (syncState?.syncStatus === 'syncing') {
          const stalledMs = now - (syncState.updatedAt?.getTime() ?? 0)
          if (stalledMs < 5 * 60_000) {
            skipped++
            continue
          }
          // Stalled — reset and re-trigger
        }

        // Check if interval has elapsed since last successful sync
        const lastSyncMs = syncState?.lastSyncedAt?.getTime() ?? 0
        if (now - lastSyncMs < intervalMs) {
          skipped++
          continue
        }

        // Mark as syncing and fire background sync
        await db.syncState.upsert({
          where: { accountId: account.id },
          update: { syncStatus: 'syncing', errorMessage: null },
          create: { accountId: account.id, syncStatus: 'syncing' },
        })

        // Fire-and-forget in the background
        ;(async () => {
          try {
            const { syncGmailAccount } = await import('@/lib/sync/gmail')
            await syncGmailAccount(account.id)
            await db.syncState.update({
              where: { accountId: account.id },
              data: {
                syncStatus: 'success',
                lastSyncedAt: new Date(),
                errorMessage: null,
                retryCount: 0,
                syncProgress: 100,
              },
            })
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            console.error(`[cron/auto-sync] Account ${account.id}:`, err)
            await db.syncState.update({
              where: { accountId: account.id },
              data: {
                syncStatus: 'error',
                errorMessage: msg.slice(0, 500),
                retryCount: { increment: 1 },
                syncProgress: 0,
              },
            })
          }
        })()

        triggered++
      }
    }

    return NextResponse.json({ ok: true, triggered, skipped, ts: new Date().toISOString() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    console.error('[cron/auto-sync] Fatal:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
