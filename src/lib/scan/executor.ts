// Scan job executor — the discovery → ingest pipeline.
//
// The pipeline (since there's no real Gmail API) "discovers" messages from
// the seed corpus (SEED_EMAILS + CONVERSATION_SEED_EMAILS), filters them
// against the ScanConfig, dedups against already-imported messages, then
// re-ingests any new ones via the EXISTING ingestEmail pipeline (normalize →
// classify → persist → deadlines → notifications → conversation resolution).
// This is honest: the same engine a real Gmail-driven scan would use — only
// the discovery source is stubbed.

import { db } from '@/lib/db'
import { SEED_EMAILS } from '@/lib/sync/seed-data'
import { CONVERSATION_SEED_EMAILS } from '@/lib/conversations/seed-data'
import { ingestEmail } from '@/lib/sync/seed'
import { matchesConfig } from './mappers'
import { resolveConversationForEmail } from './conv-resolver'
import type { ScanConfig } from './types'

/** Run the full discovery → ingest pipeline for a queued job. */
export async function executeScanJob(jobId: string): Promise<void> {
  const job = await db.scanJob.findUnique({ where: { id: jobId } })
  if (!job || job.status !== 'queued') return
  const cfg = JSON.parse(job.config) as ScanConfig
  const accountId = job.accountId
  await db.scanJob.update({
    where: { id: jobId },
    data: { status: 'scanning', startedAt: new Date(), progress: JSON.stringify({ phase: 'discovering', current: 0 }) },
  })
  try {
    const candidates = [...SEED_EMAILS, ...CONVERSATION_SEED_EMAILS].filter((r) => matchesConfig(r, cfg))
    await setProgress(jobId, 'fetching', 0, candidates.length)
    const existing = await db.email.findMany({ where: { accountId }, select: { providerMessageId: true } })
    const existingIds = new Set(existing.map((e) => e.providerMessageId))
    const categories = await db.category.findMany({ where: { accountId }, select: { id: true, name: true } })
    const categoryMap = new Map<string, string>()
    for (const c of categories) categoryMap.set(c.name, c.id)
    const account = await db.accountConnection.findUnique({ where: { id: accountId }, select: { emailAddress: true } })
    const sendersMap = new Map<string, string>()
    const threadsMap = new Map<string, string>()
    let imported = 0, duplicates = 0, failed = 0, classified = 0
    for (let i = 0; i < candidates.length; i++) {
      const raw = candidates[i]
      try {
        if (existingIds.has(raw.providerMessageId)) {
          duplicates++
        } else {
          const emailId = await ingestEmail(raw, accountId, categoryMap, sendersMap, threadsMap)
          imported++
          if (cfg.processing.classify) classified++
          if (cfg.processing.conversations) await resolveConversationForEmail(emailId, accountId, raw.providerThreadId, account?.emailAddress ?? '')
        }
      } catch (err) {
        failed++
        console.error(`[scan] ingest failed for ${raw.providerMessageId}:`, err)
      }
      if (i % 5 === 0 || i === candidates.length - 1) await setProgress(jobId, 'fetching', i + 1, candidates.length)
    }
    await db.scanJob.update({
      where: { id: jobId },
      data: {
        status: 'completed', completedAt: new Date(),
        progress: JSON.stringify({ phase: 'indexing', current: candidates.length, total: candidates.length }),
        results: JSON.stringify({ discovered: candidates.length, imported, duplicates, failed, classified }),
      },
    })
    await db.syncState.update({
      where: { accountId },
      data: { syncStatus: 'success', lastSyncedAt: new Date(), errorMessage: null, retryCount: 0 },
    }).catch(() => { /* syncState may not exist for fresh accounts — non-fatal */ })
    await db.auditEvent.create({
      data: {
        accountId, eventType: 'SCAN_COMPLETED', targetType: 'scan_job', targetId: jobId, sourceSurface: 'api',
        metadata: JSON.stringify({ discovered: candidates.length, imported, duplicates, failed, classified }),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scan failed'
    await db.scanJob.update({ where: { id: jobId }, data: { status: 'failed', errorMessage: message, completedAt: new Date() } })
    await db.auditEvent.create({
      data: { accountId, eventType: 'SCAN_FAILED', targetType: 'scan_job', targetId: jobId, sourceSurface: 'api', metadata: JSON.stringify({ error: message }) },
    })
  }
}

async function setProgress(jobId: string, phase: string, current: number, total: number): Promise<void> {
  await db.scanJob.update({ where: { id: jobId }, data: { progress: JSON.stringify({ phase, current, total }) } })
}
