import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createScanJob } from '@/lib/scan/service'
import { DEFAULT_SCAN_PROCESSING } from '@/lib/scan/types'
import type { ScanConfig } from '@/lib/scan/types'

export const dynamic = 'force-dynamic'

// POST /api/sync/run — trigger an incremental sync (creates a scan job with jobType='incremental_sync').
export async function POST() {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const config: ScanConfig = {
    scope: 'new_only',
    dateRangePreset: 'last_7_days',
    processing: { ...DEFAULT_SCAN_PROCESSING },
  }
  const job = await createScanJob(session.accountId, config, 'incremental_sync', null)
  return NextResponse.json(job, { status: 202 })
}
