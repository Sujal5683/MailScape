// PATCH /api/scan-configurations/[id] — update fields of a saved scan preset.
// DELETE /api/scan-configurations/[id] — delete a saved scan preset.

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { readBody, notFound, ApiError } from '@/lib/api-helpers'
import {
  updateScanConfiguration,
  deleteScanConfiguration,
  listScanConfigurations,
  type ScanConfigurationInput,
} from '@/lib/scan/service'
import { DEFAULT_SCAN_PROCESSING } from '@/lib/scan/types'
import type { ScanConfig } from '@/lib/scan/types'

export const dynamic = 'force-dynamic'

async function assertOwned(accountId: string, id: string) {
  const rows = await listScanConfigurations(accountId)
  if (!rows.some((r) => r.id === id)) throw notFound('Scan configuration not found')
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  await assertOwned(session.accountId, id)
  const body = await readBody<Partial<ScanConfigurationInput>>(req)
  if (body.name !== undefined && !body.name.trim()) throw new ApiError('name cannot be empty', 400)
  let patch: Partial<ScanConfigurationInput> = {}
  if (body.name !== undefined) patch.name = body.name
  if (body.description !== undefined) patch.description = body.description
  if (body.schedule !== undefined) patch.schedule = body.schedule
  if (body.enabled !== undefined) patch.enabled = body.enabled
  if (body.config !== undefined) {
    const c = body.config
    if (!c.scope || !c.dateRangePreset) throw new ApiError('config.scope + dateRangePreset required', 400)
    const config: ScanConfig = {
      scope: c.scope,
      dateRangePreset: c.dateRangePreset,
      dateFrom: c.dateFrom, dateTo: c.dateTo,
      senderFilter: c.senderFilter, subjectFilter: c.subjectFilter,
      hasAttachment: c.hasAttachment, includeSpam: c.includeSpam, includeTrash: c.includeTrash,
      gmailQuery: c.gmailQuery,
      processing: { ...DEFAULT_SCAN_PROCESSING, ...(c.processing ?? {}) },
    }
    patch.config = config
  }
  const row = await updateScanConfiguration(session.accountId, id, patch)
  return NextResponse.json(row)
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  await assertOwned(session.accountId, id)
  await deleteScanConfiguration(session.accountId, id)
  return NextResponse.json({ ok: true })
}
