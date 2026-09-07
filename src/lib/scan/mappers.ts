// Scan service — mappers between Prisma rows and the API DTOs.
// Kept in its own module so service.ts stays focused on orchestration.

import type {
  ScanConfig,
  ScanConfigurationDTO,
  ScanJobDTO,
  ScanProgress,
  ScanResults,
  ScanStatus,
  SyncStatusDTO,
} from './types'
import { DEFAULT_SCAN_PROCESSING } from './types'
import type { RawEmail } from '@/lib/sync/seed-data'

/** Parse a JSON column defensively — never throws, falls back to the empty object. */
function parseJSON<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** Merge a partial config from the DB with sane processing defaults. */
export function mapScanConfig(raw: string | null | undefined): ScanConfig {
  const parsed = parseJSON<Partial<ScanConfig>>(raw, {})
  return {
    scope: parsed.scope ?? 'new_only',
    dateRangePreset: parsed.dateRangePreset ?? 'all_time',
    dateFrom: parsed.dateFrom,
    dateTo: parsed.dateTo,
    senderFilter: parsed.senderFilter,
    subjectFilter: parsed.subjectFilter,
    hasAttachment: parsed.hasAttachment,
    includeSpam: parsed.includeSpam,
    includeTrash: parsed.includeTrash,
    gmailQuery: parsed.gmailQuery,
    processing: { ...DEFAULT_SCAN_PROCESSING, ...(parsed.processing ?? {}) },
  }
}

const EMPTY_PROGRESS: ScanProgress = { phase: 'discovering', current: 0 }
const EMPTY_RESULTS: ScanResults = { discovered: 0, imported: 0, duplicates: 0, failed: 0, classified: 0 }

export function mapScanProgress(raw: string | null | undefined): ScanProgress {
  return parseJSON<ScanProgress>(raw, EMPTY_PROGRESS)
}
export function mapScanResults(raw: string | null | undefined): ScanResults {
  return parseJSON<ScanResults>(raw, EMPTY_RESULTS)
}

/** Map a ScanJob DB row to the API DTO. */
export function mapScanJob(row: {
  id: string; accountId: string; jobType: string; status: string
  config: string; results: string; progress: string
  errorMessage: string | null; startedAt: Date | null; completedAt: Date | null
  createdAt: Date
}): ScanJobDTO {
  return {
    id: row.id, accountId: row.accountId, jobType: row.jobType,
    status: row.status as ScanStatus,
    config: mapScanConfig(row.config), results: mapScanResults(row.results),
    progress: mapScanProgress(row.progress), errorMessage: row.errorMessage,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }
}

/** Map a ScanConfiguration DB row to the API DTO. */
export function mapScanConfiguration(row: {
  id: string; accountId: string; name: string; description: string | null
  config: string; schedule: string; enabled: boolean
  createdAt: Date; updatedAt: Date
}): ScanConfigurationDTO {
  return {
    id: row.id, accountId: row.accountId, name: row.name, description: row.description,
    config: mapScanConfig(row.config), schedule: row.schedule, enabled: row.enabled,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  }
}

/** Map a SyncState row to the lightweight SyncStatusDTO. */
export function mapSyncStatus(row: {
  syncStatus: string; lastSyncedAt: Date | null
  gmailHistoryId: string | null; errorMessage: string | null
}, newMessageCount: number): SyncStatusDTO {
  return {
    status: row.syncStatus as SyncStatusDTO['status'],
    lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    historyId: row.gmailHistoryId, errorMessage: row.errorMessage,
    newMessageCount,
  }
}

/**
 * Apply a ScanConfig filter to a raw seed message. True if the message
 * passes every clause the config expresses. Used during the discovery phase.
 */
export function matchesConfig(raw: RawEmail, cfg: ScanConfig): boolean {
  if (cfg.senderFilter && !raw.fromEmail.toLowerCase().includes(cfg.senderFilter.toLowerCase())) return false
  if (cfg.subjectFilter && !raw.subject.toLowerCase().includes(cfg.subjectFilter.toLowerCase())) return false
  if (cfg.hasAttachment !== undefined) {
    if (cfg.hasAttachment !== (raw.attachments ?? []).length > 0) return false
  }
  if (!cfg.includeSpam && raw.isSpam) return false
  const ts = new Date(raw.receivedAt).getTime()
  if (cfg.dateFrom && ts < new Date(cfg.dateFrom).getTime()) return false
  if (cfg.dateTo && ts > new Date(cfg.dateTo).getTime()) return false
  return true
}

