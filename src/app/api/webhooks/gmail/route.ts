import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { db } from '@/lib/db'
import { syncGmailAccount } from '@/lib/sync/gmail'

export const dynamic = 'force-dynamic'

/**
 * GET /api/webhooks/gmail - Verification (optional, but good practice)
 */
export async function GET() {
  return NextResponse.json({ ok: true })
}

/**
 * POST /api/webhooks/gmail
 * Receives push notifications from Google Cloud Pub/Sub.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (!body.message || !body.message.data) {
      return NextResponse.json({ error: 'Invalid Pub/Sub message format' }, { status: 400 })
    }

    // Pub/Sub data is base64 encoded JSON
    const decodedData = Buffer.from(body.message.data, 'base64').toString('utf-8')
    const payload = JSON.parse(decodedData)

    const emailAddress = payload.emailAddress
    const historyId = payload.historyId

    if (!emailAddress) {
      return NextResponse.json({ error: 'Missing emailAddress in payload' }, { status: 400 })
    }

    // Find the account(s) associated with this email
    const accounts = await db.accountConnection.findMany({
      where: { emailAddress, status: { not: 'disconnected' } },
    })

    if (accounts.length === 0) {
      console.warn(`[webhook] Received push for ${emailAddress} but no active account found.`)
      // Return 200 so Pub/Sub stops retrying
      return NextResponse.json({ ok: true })
    }

    // For each account, trigger sync in the background
    for (const account of accounts) {
      console.info(`[webhook] Instant push received for ${emailAddress}. historyId: ${historyId}`)
      
      // Update sync state to indicate syncing
      await db.syncState.upsert({
        where: { accountId: account.id },
        update: { syncStatus: 'syncing', errorMessage: null },
        create: { accountId: account.id, syncStatus: 'syncing' },
      })

      // Offload actual sync to background using waitUntil so Vercel doesn't kill it
      waitUntil(
        syncGmailAccount(account.id)
          .then(async () => {
             await db.syncState.update({
               where: { accountId: account.id },
               data: {
                 syncStatus: 'success',
                 lastSyncedAt: new Date(),
                 errorMessage: null,
                 syncProgress: 100,
               },
             }).catch(() => {})
          })
          .catch(async (err) => {
             console.error(`[webhook] Background sync failed for ${account.id}:`, err)
             await db.syncState.update({
               where: { accountId: account.id },
               data: {
                 syncStatus: 'error',
                 errorMessage: (err as Error).message.slice(0, 500),
               },
             }).catch(() => {})
          })
      )
    }

    // Return 200 OK immediately so Google knows we received it
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[webhook] Fatal error processing Pub/Sub message:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
