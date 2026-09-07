// GET /api/scans  — list scan jobs for the session account.
// POST /api/scans — create + start a scan job (fire-and-forget execution).

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { readBody, ApiError } from '@/lib/api-helpers'
import { createScanJob, listScanJobs } from '@/lib/scan/service'
import { DEFAULT_SCAN_PROCESSING } from '@/lib/scan/types'
import type { ScanConfig, ScanStatus } from '@/lib/scan/types'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(req.url)
  const status = url.searchParams.get('status') as ScanStatus | null
  const limitRaw = url.searchParams.get('limit')
  const limit = limitRaw ? Math.min(200, Math.max(1, parseInt(limitRaw, 10) || 50)) : 50
  const jobs = await listScanJobs(session.accountId, { status: status ?? undefined, limit })
  return NextResponse.json(jobs)
}

export async function POST(req: Request) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await readBody<Partial<ScanConfig> & { configurationId?: string }>(req)
  if (!body.scope) throw new ApiError('scope is required', 400)
  if (!body.dateRangePreset) throw new ApiError('dateRangePreset is required', 400)
  const config: ScanConfig = {
    scope: body.scope,
    dateRangePreset: body.dateRangePreset,
    dateFrom: body.dateFrom,
    dateTo: body.dateTo,
    senderFilter: body.senderFilter,
    subjectFilter: body.subjectFilter,
    hasAttachment: body.hasAttachment,
    includeSpam: body.includeSpam,
    includeTrash: body.includeTrash,
    gmailQuery: body.gmailQuery,
    processing: { ...DEFAULT_SCAN_PROCESSING, ...(body.processing ?? {}) },
  }
  const job = await createScanJob(session.accountId, config, 'manual', body.configurationId ?? null)
  return NextResponse.json(job, { status: 202 })
}
