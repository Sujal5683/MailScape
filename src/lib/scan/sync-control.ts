// Sync control — the SyncState projection + run/pause/resume helpers.
// Split out from service.ts to keep that file under the 120-line ceiling.
//
// The auto-sync state is stored on the SyncState row (one row per account).
// "paused" is encoded as the string `syncStatus = 'paused'` (the column is a
// free-form String, not an enum, so no migration needed).

import { db } from '@/lib/db'
import { mapSyncStatus } from './mappers'
import type { SyncStatusDTO } from './types'
import { createScanJob } from './service'
import type { ScanConfig } from './types'

/**
 * Project the SyncState row + a "new message" count into the lightweight
 * SyncStatusDTO consumed by the UI's Sync badge.
 */
export async function getSyncStatus(accountId: string): Promise<SyncStatusDTO> {
  const syncState = await db.syncState.findUnique({ where: { accountId } })
  // Count unread + non-snoozed messages as "new".
  const newMessageCount = await db.email.count({
    where: { accountId, isRead: false, snoozedUntil: null },
  })
  if (!syncState) {
    return { status: 'idle', lastSyncedAt: null, historyId: null, errorMessage: null, newMessageCount }
  }
  return mapSyncStatus(syncState, newMessageCount)
}

/**
 * Trigger an incremental sync — equivalent to running a `new_only` scan with
 * the default processing toggles. Returns the freshly-queued job DTO so the
 * caller can poll for completion.
 */
export async function runSync(accountId: string): Promise<{ jobId: string }> {
  const config: ScanConfig = {
    scope: 'new_only',
    dateRangePreset: 'all_time',
    includeSpam: false,
    processing: {
      classify: true,
      conversations: true,
      deadlines: true,
      actionItems: true,
      notifications: true,
      aiSummaries: false,
    },
  }
  // Mark as syncing immediately so the UI badge flips before the scan starts.
  await db.syncState.update({
    where: { accountId },
    data: { syncStatus: 'syncing', errorMessage: null },
  }).catch(() => { /* syncState may not exist for fresh accounts */ })
  const job = await createScanJob(accountId, config, 'incremental_sync', null)
  await db.auditEvent.create({
    data: {
      accountId,
      eventType: 'SYNC_TRIGGERED',
      targetType: 'account',
      targetId: accountId,
      sourceSurface: 'ui',
      metadata: JSON.stringify({ jobId: job.id }),
    },
  })
  return { jobId: job.id }
}

/** Pause auto-sync — sets syncStatus to 'paused'. Manual scans still work. */
export async function pauseSync(accountId: string): Promise<void> {
  await db.syncState.update({
    where: { accountId },
    data: { syncStatus: 'paused' },
  }).catch(() => { /* syncState may not exist for fresh accounts */ })
  await db.auditEvent.create({
    data: {
      accountId,
      eventType: 'SYNC_PAUSED',
      targetType: 'account',
      targetId: accountId,
      sourceSurface: 'ui',
      metadata: JSON.stringify({}),
    },
  })
}

/** Resume auto-sync — sets syncStatus to 'idle' (the next poll will pick up). */
export async function resumeSync(accountId: string): Promise<void> {
  await db.syncState.update({
    where: { accountId },
    data: { syncStatus: 'idle', errorMessage: null },
  }).catch(() => { /* syncState may not exist for fresh accounts */ })
  await db.auditEvent.create({
    data: {
      accountId,
      eventType: 'SYNC_RESUMED',
      targetType: 'account',
      targetId: accountId,
      sourceSurface: 'ui',
      metadata: JSON.stringify({}),
    },
  })
}
