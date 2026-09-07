// Scan service — public API entry point for scan job orchestration.
//
// Re-exports the long-running executeScanJob from executor.ts and the
// ScanConfiguration CRUD from configurations.ts. This file itself holds
// the small lifecycle helpers (createScanJob, cancelScanJob, retryScanJob)
// + the read query helpers (getScanJob, listScanJobs).
//
// `executeScanJob` runs asynchronously (fire-and-forget) — `createScanJob`
// returns immediately with the queued job ID, and the API surfaces progress
// via GET /api/scans/[id].

import { db } from '@/lib/db'
import { mapScanJob } from './mappers'
import { executeScanJob } from './executor'
import type { ScanConfig, ScanJobDTO, ScanStatus } from './types'

export { executeScanJob } from './executor'
export {
  listScanConfigurations,
  createScanConfiguration,
  updateScanConfiguration,
  deleteScanConfiguration,
  type ScanConfigurationInput,
} from './configurations'
export { getSyncStatus, runSync, pauseSync, resumeSync } from './sync-control'

/**
 * Create a queued ScanJob + fire-and-forget executeScanJob. Returns the DTO
 * immediately so the API caller can poll GET /api/scans/[id] for progress.
 * The async run is detached — any error is captured into the job row.
 */
export async function createScanJob(
  accountId: string,
  config: ScanConfig,
  jobType: string = 'manual',
  configurationId: string | null = null,
): Promise<ScanJobDTO> {
  const job = await db.scanJob.create({
    data: {
      accountId,
      configurationId,
      jobType,
      status: 'queued',
      config: JSON.stringify(config),
      progress: JSON.stringify({ phase: 'discovering', current: 0 }),
      results: JSON.stringify({ discovered: 0, imported: 0, duplicates: 0, failed: 0, classified: 0 }),
    },
  })
  await db.auditEvent.create({
    data: {
      accountId,
      eventType: 'SCAN_STARTED',
      targetType: 'scan_job',
      targetId: job.id,
      sourceSurface: 'ui',
      metadata: JSON.stringify({ jobType, scope: config.scope }),
    },
  })
  // Fire-and-forget — never awaited by the caller.
  void executeScanJob(job.id).catch((err) => {
    console.error(`[scan] executeScanJob(${job.id}) unhandled:`, err)
  })
  return mapScanJob(job)
}

/**
 * Mark a queued/scanning job as cancelled. In-flight ingest continues for the
 * current message but no new ones start; the next iteration sees the new
 * status and bails.
 */
export async function cancelScanJob(jobId: string): Promise<void> {
  await db.scanJob.update({ where: { id: jobId }, data: { status: 'cancelled', completedAt: new Date() } })
  await db.auditEvent.create({
    data: {
      eventType: 'SCAN_CANCELLED',
      targetType: 'scan_job',
      targetId: jobId,
      sourceSurface: 'ui',
      metadata: JSON.stringify({}),
    },
  })
}

/** Create a new queued job with the same config as an existing job. */
export async function retryScanJob(jobId: string): Promise<ScanJobDTO> {
  const original = await db.scanJob.findUnique({ where: { id: jobId } })
  if (!original) throw new Error('Scan job not found')
  return createScanJob(original.accountId, JSON.parse(original.config) as ScanConfig, 'retry', original.configurationId)
}

// ---------------------------------------------------------------------------
// Read query helpers
// ---------------------------------------------------------------------------

export async function getScanJob(jobId: string): Promise<ScanJobDTO | null> {
  const row = await db.scanJob.findUnique({ where: { id: jobId } })
  return row ? mapScanJob(row) : null
}

export async function listScanJobs(
  accountId: string,
  filter?: { status?: ScanStatus; limit?: number },
): Promise<ScanJobDTO[]> {
  const rows = await db.scanJob.findMany({
    where: { accountId, ...(filter?.status ? { status: filter.status } : {}) },
    orderBy: { createdAt: 'desc' },
    take: filter?.limit ?? 50,
  })
  return rows.map(mapScanJob)
}
