// GET /api/scans/[id] — fetch a single scan job (status + progress + results).

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { notFound } from '@/lib/api-helpers'
import { getScanJob } from '@/lib/scan/service'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const job = await getScanJob(id)
  if (!job || job.accountId !== session.accountId) throw notFound('Scan job not found')
  return NextResponse.json(job)
}
