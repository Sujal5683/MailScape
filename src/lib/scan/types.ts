// Scan & Sync Control Plane — type definitions.
// DB rows persist JSON-string columns (config/results/progress); these DTOs
// keep them as parsed objects so callers never JSON.parse the wire format.

/** What subset of the mailbox a scan should cover. */
export type ScanScope =
  | 'new_only'             // only messages not yet ingested (dedup by providerMessageId)
  | 'existing_only'        // re-walk already-imported messages (e.g. to re-classify)
  | 'existing_and_future'  // backfill + watch for new arrivals
  | 'rescan'               // wipe + re-ingest (destructive re-classification)
  | 'full_mailbox'         // every message in the seed corpus (Gmail stand-in)

/** Lifecycle state of a ScanJob. Matches the Prisma `ScanJob.status` column. */
export type ScanStatus =
  | 'queued'
  | 'scanning'
  | 'importing'
  | 'classifying'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused'

/** Coarse phase within the running scan, surfaced on the progress object. */
export type ScanPhase = 'discovering' | 'fetching' | 'normalizing' | 'classifying' | 'indexing'

/** Processing toggles — which downstream pipelines should run per message. */
export interface ScanProcessing {
  classify: boolean
  conversations: boolean
  deadlines: boolean
  actionItems: boolean
  notifications: boolean
  aiSummaries: boolean
}

/** Default processing toggles — all pipelines on. */
export const DEFAULT_SCAN_PROCESSING: ScanProcessing = {
  classify: true,
  conversations: true,
  deadlines: true,
  actionItems: true,
  notifications: true,
  aiSummaries: false,
}

/** The user-configurable scan shape. Persisted as JSON on ScanJob + ScanConfiguration. */
export interface ScanConfig {
  scope: ScanScope
  dateRangePreset: 'last_7_days' | 'last_30_days' | 'last_90_days' | 'this_year' | 'all_time' | 'custom'
  dateFrom?: string // ISO — present when preset === 'custom'
  dateTo?: string   // ISO — present when preset === 'custom'
  senderFilter?: string   // substring match on fromEmail
  subjectFilter?: string  // substring match on subject
  hasAttachment?: boolean
  includeSpam?: boolean
  includeTrash?: boolean
  gmailQuery?: string // raw Gmail search expression (e.g. "label:work older_than:1y")
  processing: ScanProcessing
}

/** Live progress for a running ScanJob. Persisted as JSON on ScanJob.progress. */
export interface ScanProgress {
  phase: ScanPhase
  current: number
  total?: number
}

/** Final tallies for a completed/failed ScanJob. Persisted as JSON on ScanJob.results. */
export interface ScanResults {
  discovered: number
  imported: number
  duplicates: number
  failed: number
  classified: number
}

/** A ScanJob row mapped to the API contract. */
export interface ScanJobDTO {
  id: string
  accountId: string
  jobType: string
  status: ScanStatus
  config: ScanConfig
  results: ScanResults
  progress: ScanProgress
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

/** A ScanConfiguration row mapped to the API contract. */
export interface ScanConfigurationDTO {
  id: string
  accountId: string
  name: string
  description: string | null
  config: ScanConfig
  schedule: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

/** Lightweight sync-state projection consumed by the "Sync" badge in the UI. */
export interface SyncStatusDTO {
  status: 'idle' | 'syncing' | 'error' | 'success' | 'paused'
  lastSyncedAt: string | null
  historyId: string | null
  errorMessage: string | null
  newMessageCount: number
}
