// GET /api/scan-configurations  — list saved scan presets.
// POST /api/scan-configurations — create a new saved scan preset.

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { readBody, ApiError } from '@/lib/api-helpers'
import {
  listScanConfigurations,
  createScanConfiguration,
  type ScanConfigurationInput,
} from '@/lib/scan/service'
import { DEFAULT_SCAN_PROCESSING } from '@/lib/scan/types'
import type { ScanConfig } from '@/lib/scan/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await listScanConfigurations(session.accountId)
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await readBody<{
    name?: string
    description?: string
    config?: Partial<ScanConfig>
    schedule?: string
    enabled?: boolean
  }>(req)
  const name = body.name?.trim()
  if (!name) throw new ApiError('name is required', 400)
  if (!body.config?.scope) throw new ApiError('config.scope is required', 400)
  if (!body.config?.dateRangePreset) throw new ApiError('config.dateRangePreset is required', 400)
  const config: ScanConfig = {
    scope: body.config.scope,
    dateRangePreset: body.config.dateRangePreset,
    dateFrom: body.config.dateFrom,
    dateTo: body.config.dateTo,
    senderFilter: body.config.senderFilter,
    subjectFilter: body.config.subjectFilter,
    hasAttachment: body.config.hasAttachment,
    includeSpam: body.config.includeSpam,
    includeTrash: body.config.includeTrash,
    gmailQuery: body.config.gmailQuery,
    processing: { ...DEFAULT_SCAN_PROCESSING, ...(body.config.processing ?? {}) },
  }
  const input: ScanConfigurationInput = {
    name,
    description: body.description,
    config,
    schedule: body.schedule,
    enabled: body.enabled,
  }
  const row = await createScanConfiguration(session.accountId, input)
  return NextResponse.json(row, { status: 201 })
}
