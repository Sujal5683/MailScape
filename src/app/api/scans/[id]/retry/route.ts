// POST /api/scans/[id]/retry — create a new queued job with the same config.

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { notFound } from '@/lib/api-helpers'
import { getScanJob, retryScanJob } from '@/lib/scan/service'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  const { id } = await ctx.params
  const job = await getScanJob(id)
  if (!job || job.accountId !== session.accountId) throw notFound('Scan job not found')
  const retried = await retryScanJob(id)
  return NextResponse.json(retried, { status: 202 })
}
