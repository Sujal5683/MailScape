// POST /api/scans/[id]/cancel — cancel a queued/scanning job.

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { notFound } from '@/lib/api-helpers'
import { cancelScanJob, getScanJob } from '@/lib/scan/service'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const job = await getScanJob(id)
  if (!job || job.accountId !== session.accountId) throw notFound('Scan job not found')
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    return NextResponse.json({ ok: false, error: `Job already ${job.status}` }, { status: 409 })
  }
  await cancelScanJob(id)
  return NextResponse.json({ ok: true, id })
}
