// ScanConfiguration CRUD — saved scan presets.
// Split out from service.ts to keep that file under the 120-line ceiling.

import { db } from '@/lib/db'
import { mapScanConfiguration } from './mappers'
import type { ScanConfig, ScanConfigurationDTO } from './types'

export interface ScanConfigurationInput {
  name: string
  description?: string
  config: ScanConfig
  schedule?: string
  enabled?: boolean
}

/** List all saved scan configurations for the account, newest first. */
export async function listScanConfigurations(accountId: string): Promise<ScanConfigurationDTO[]> {
  const rows = await db.scanConfiguration.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(mapScanConfiguration)
}

/** Create a new saved scan configuration. */
export async function createScanConfiguration(
  accountId: string,
  input: ScanConfigurationInput,
): Promise<ScanConfigurationDTO> {
  const row = await db.scanConfiguration.create({
    data: {
      accountId,
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      config: JSON.stringify(input.config),
      schedule: input.schedule ?? 'manual',
      enabled: input.enabled ?? true,
    },
  })
  await db.auditEvent.create({
    data: {
      accountId,
      eventType: 'SCAN_CONFIGURATION_CREATED',
      targetType: 'scan_configuration',
      targetId: row.id,
      sourceSurface: 'ui',
      metadata: JSON.stringify({ name: row.name, schedule: row.schedule }),
    },
  })
  return mapScanConfiguration(row)
}

/** Update fields of a saved scan configuration. */
export async function updateScanConfiguration(
  accountId: string,
  id: string,
  patch: Partial<ScanConfigurationInput>,
): Promise<ScanConfigurationDTO> {
  const data: Record<string, unknown> = {}
  if (patch.name !== undefined) data.name = patch.name.trim()
  if (patch.description !== undefined) data.description = patch.description.trim()
  if (patch.config !== undefined) data.config = JSON.stringify(patch.config)
  if (patch.schedule !== undefined) data.schedule = patch.schedule
  if (patch.enabled !== undefined) data.enabled = patch.enabled
  const row = await db.scanConfiguration.update({ where: { id }, data })
  await db.auditEvent.create({
    data: {
      accountId,
      eventType: 'SCAN_CONFIGURATION_UPDATED',
      targetType: 'scan_configuration',
      targetId: id,
      sourceSurface: 'ui',
      metadata: JSON.stringify({ fields: Object.keys(data) }),
    },
  })
  return mapScanConfiguration(row)
}

/** Delete a saved scan configuration. */
export async function deleteScanConfiguration(accountId: string, id: string): Promise<void> {
  await db.scanConfiguration.delete({ where: { id } })
  await db.auditEvent.create({
    data: {
      accountId,
      eventType: 'SCAN_CONFIGURATION_DELETED',
      targetType: 'scan_configuration',
      targetId: id,
      sourceSurface: 'ui',
      metadata: JSON.stringify({}),
    },
  })
}
