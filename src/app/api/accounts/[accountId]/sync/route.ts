import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** Stale-sync threshold: if stuck in 'syncing' for > 5 min, auto-reset. */
const STALE_SYNC_MS = 5 * 60 * 1_000

/**
 * POST /api/accounts/[accountId]/sync
 *
 * Triggers a real Gmail sync for the given account.
 * Returns immediately with { ok, status: 'syncing' } — sync runs in background.
 *
 * Improvements over original:
 *  - Stuck-state guard: auto-resets if previous sync has been 'syncing' > 5 min
 *  - syncProgress reset to 0 at start of each sync
 *  - Full error state written to DB on failure (never left in 'syncing')
 *  - Logs structured error details
 */
export async function POST(_req: Request, ctx: { params: Promise<{ accountId: string }> }) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { accountId } = await ctx.params

  // Verify ownership
  const account = await db.accountConnection.findUnique({
    where: { id: accountId },
    include: { syncState: true },
  })
  if (!account || account.userId !== session.userId) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  // ── Stuck-state guard ────────────────────────────────────────────────────
  const syncState = account.syncState
  if (syncState?.syncStatus === 'syncing') {
    const staleMs = Date.now() - (syncState.updatedAt?.getTime() ?? 0)
    if (staleMs < STALE_SYNC_MS) {
      // Legitimately still syncing — don't re-trigger
      return NextResponse.json({ ok: true, status: 'syncing', alreadyRunning: true })
    }
    // Stale — fall through and re-trigger
    console.warn(`[sync] Stale sync detected for account ${accountId} (${Math.round(staleMs / 1000)}s). Resetting.`)
  }

  // Mark sync as in-progress (resets progress bar to 0)
  await db.syncState.upsert({
    where:  { accountId },
    update: { syncStatus: 'syncing', errorMessage: null, syncProgress: 0, retryCount: 0 },
    create: { accountId, syncStatus: 'syncing' },
  })

  // ── Background sync (fire-and-forget) ────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  ;(async () => {
    try {
      const { syncGmailAccount } = await import('@/lib/sync/gmail')
      await syncGmailAccount(accountId)

      await db.syncState.update({
        where: { accountId },
        data: {
          syncStatus:   'success',
          lastSyncedAt: new Date(),
          errorMessage: null,
          retryCount:   0,
          syncProgress: 100,
        },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown sync error'
      console.error(`[sync] Account ${accountId} failed:`, err)

      await db.syncState.update({
        where: { accountId },
        data: {
          syncStatus:   'error',
          errorMessage: msg.slice(0, 500),
          retryCount:   { increment: 1 },
          syncProgress: 0,
        },
      }).catch(() => { /* non-fatal — don't shadow original error */ })
    }
  })()

  return NextResponse.json({ ok: true, status: 'syncing' })
}
