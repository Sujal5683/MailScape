import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getSyncStatus } from '@/lib/scan/service'

export const dynamic = 'force-dynamic'

// GET /api/sync/status — current sync state for the session account.
export async function GET() {
  const session = await getSession()
  const status = await getSyncStatus(session.accountId)
  return NextResponse.json(status)
}
