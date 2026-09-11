// Email ingestion pipeline — normalize → rules → classification → persistence.
// This module exports ingestEmail() which is used by both the Gmail sync engine
// (src/lib/sync/gmail.ts) and the scan service (src/lib/scan/service.ts).
//
// ensureSeedData() has been removed. The demo seed data bypass is gone —
// the app now uses real Google OAuth and the Gmail API for email ingestion.

import { db } from '@/lib/db'
import { resolveConversation, assignThreadToConversation, detectFollowUpState } from '@/lib/conversations/resolver'
import { classifyByEmail, extractDeadlines, extractActionItems } from '@/lib/classifier'
import { sanitizeHtml, htmlToText, makeSnippet, extractUrls } from '@/lib/sanitize'
import type { CategorySummary } from '@/lib/types'

export interface RawEmail {
  providerMessageId: string
  providerThreadId: string
  fromName: string
  fromEmail: string
  toRecipients: { name?: string; email: string }[]
  ccRecipients?: { name?: string; email: string }[]
  subject: string
  bodyText: string
  bodyHtml: string
  receivedAt: string // ISO
  isRead: boolean
  isStarred: boolean
  isImportant: boolean
  isDraft?: boolean
  isSent?: boolean
  isSpam?: boolean
  labels?: string[]
  attachments?: { filename: string; mimeType: string; size: number }[]
}



/**
 * ingestEmail — normalize → classify → persist → deadlines → notifications.
 *
 * Performance improvements:
 *  - Sender + Thread upserts run in parallel (Promise.all)
 *  - After email.create, all downstream writes run in parallel:
 *    categoryMembership, classificationResult, attachments, deadlines, actionItems
 *  - AI reclassification fires asynchronously (non-blocking) for low-confidence results
 *  - Push notification triggered for new unread emails
 */
export async function ingestEmail(
  raw: RawEmail,
  accountId: string,
  categoryMap: Map<string, string>,
  sendersMap: Map<string, string>,
  threadsMap: Map<string, string>,
  options?: { skipNotifications?: boolean },
): Promise<string> {
  const domain = raw.fromEmail.split('@')[1] ?? null

  // ── 1. Upsert sender + thread in PARALLEL ──────────────────────────────────
  const [senderId, threadId] = await Promise.all([
    // Sender upsert
    (async () => {
      let id = sendersMap.get(raw.fromEmail)
      if (id) {
        await db.sender.update({
          where: { id },
          data: { lastSeenAt: new Date(raw.receivedAt), messageCount: { increment: 1 } },
        })
        return id
      }
      const sender = await db.sender.upsert({
        where: { accountId_senderEmail: { accountId, senderEmail: raw.fromEmail } },
        update: { senderName: raw.fromName, domain, lastSeenAt: new Date(raw.receivedAt), messageCount: { increment: 1 } },
        create: {
          accountId, senderEmail: raw.fromEmail, senderName: raw.fromName, domain,
          firstSeenAt: new Date(raw.receivedAt), lastSeenAt: new Date(raw.receivedAt),
          messageCount: 1, discovered: true,
        },
      })
      sendersMap.set(raw.fromEmail, sender.id)
      return sender.id
    })(),

    // Thread upsert
    (async () => {
      let id = threadsMap.get(raw.providerThreadId)
      if (id) {
        await db.thread.update({
          where: { id },
          data: { lastMessageAt: new Date(raw.receivedAt) },
        })
        return id
      }
      const thread = await db.thread.upsert({
        where: { accountId_providerThreadId: { accountId, providerThreadId: raw.providerThreadId } },
        update: { lastMessageAt: new Date(raw.receivedAt) },
        create: { accountId, providerThreadId: raw.providerThreadId, subject: raw.subject, lastMessageAt: new Date(raw.receivedAt) },
      })
      threadsMap.set(raw.providerThreadId, thread.id)
      return thread.id
    })(),
  ])

  // ── 2. Classify (deterministic heuristics first) ───────────────────────────
  const sanitizedHtml = sanitizeHtml(raw.bodyHtml)
  const bodyText      = raw.bodyText || htmlToText(raw.bodyHtml)
  const snippet       = makeSnippet(bodyText)
  const links         = extractUrls(bodyText)
  const attachmentTypes = (raw.attachments ?? []).map((a) => a.mimeType)

  let classification = classifyByEmail({
    fromEmail: raw.fromEmail, fromName: raw.fromName, domain,
    subject: raw.subject, bodyText, hasAttachment: (raw.attachments ?? []).length > 0,
    attachmentTypes,
  })

  let categoryId = categoryMap.get(classification.categoryName) ?? categoryMap.get('Others')!

  // ── 3. Create email record ─────────────────────────────────────────────────
  const email = await db.email.create({
    data: {
      accountId, threadId, providerMessageId: raw.providerMessageId,
      providerThreadId: raw.providerThreadId, senderId,
      fromName: raw.fromName, fromEmail: raw.fromEmail,
      toRecipients: JSON.stringify(raw.toRecipients),
      ccRecipients: JSON.stringify(raw.ccRecipients ?? []),
      bccRecipients: JSON.stringify([]),
      subject: raw.subject, snippet, bodyText, bodyHtmlSanitized: sanitizedHtml,
      receivedAt: new Date(raw.receivedAt), isRead: raw.isRead,
      isStarred: raw.isStarred, isImportant: raw.isImportant,
      isDraft: raw.isDraft ?? false, isSent: raw.isSent ?? false, isSpam: raw.isSpam ?? false,
      hasAttachment: (raw.attachments ?? []).length > 0,
      labels: JSON.stringify(raw.labels ?? ['inbox']),
      extractedLinks: JSON.stringify(links),
      classificationSource: classification.source,
      classificationConfidence: classification.confidence,
    },
  })

  // ── 4. Parallel downstream writes ─────────────────────────────────────────
  const deadlines    = extractDeadlines(raw.subject, bodyText)
  const actionItems  = extractActionItems(raw.subject, bodyText)

  await Promise.all([
    // Category membership
    db.categoryMembership.create({
      data: { emailId: email.id, categoryId, source: classification.source, confidence: classification.confidence },
    }),
    // Classification audit
    db.classificationResult.create({
      data: {
        emailId: email.id, source: classification.source, categoryId,
        confidence: classification.confidence, rationaleSummary: classification.rationale,
      },
    }),
    // Attachments
    ...(raw.attachments ?? []).map((att) =>
      db.emailAttachment.create({
        data: {
          emailId: email.id,
          providerAttachmentId: `${raw.providerMessageId}-${att.filename}`,
          filename: att.filename, mimeType: att.mimeType, size: att.size,
          previewable: att.mimeType === 'application/pdf' || att.mimeType.startsWith('image/'),
        },
      }),
    ),
    // Deadlines
    ...deadlines
      .filter((dl) => dl.dueAt)
      .map((dl) =>
        db.deadline.create({
          data: {
            accountId, emailId: email.id, categoryId,
            title: dl.title.slice(0, 200), dueAt: new Date(dl.dueAt!),
            confidence: dl.confidence, status: 'open',
          },
        }),
      ),
    // Action items
    ...actionItems.map((ai) =>
      db.actionItem.create({
        data: {
          accountId, emailId: email.id, title: ai.title,
          dueAt: ai.dueAt ? new Date(ai.dueAt) : null, status: 'open',
        },
      }),
    ),
    // Notifications (in-DB)
    ...(options?.skipNotifications || raw.isRead
      ? []
      : [
          db.notification.create({
            data: {
              accountId, emailId: email.id, categoryId,
              title: raw.subject.slice(0, 120), body: snippet,
              importance: raw.isImportant ? 'important' : 'normal', isRead: false,
            },
          }),
        ]),
  ])

  // ── 5. AI reclassification (non-blocking, async) ───────────────────────────
  // If confidence is low, fire Gemini reclassification in the background.
  // This doesn't block email ingestion — email is already saved with best-effort category.
  if (classification.confidence < 0.65 && !options?.skipNotifications) {
    ;(async () => {
      try {
        const { classifyWithGemini } = await import('@/lib/classifier-ai')
        const cats = Array.from(categoryMap.keys())
        const aiResult = await classifyWithGemini({
          fromEmail: raw.fromEmail, fromName: raw.fromName, domain,
          subject: raw.subject, bodyText, hasAttachment: (raw.attachments ?? []).length > 0,
          attachmentTypes,
        }, cats)

        if (aiResult && aiResult.confidence > classification.confidence) {
          const newCategoryId = categoryMap.get(aiResult.categoryName) ?? categoryId
          await Promise.all([
            db.categoryMembership.updateMany({
              where: { emailId: email.id },
              data: { categoryId: newCategoryId, source: 'ai', confidence: aiResult.confidence },
            }),
            db.email.update({
              where: { id: email.id },
              data: { classificationSource: 'ai', classificationConfidence: aiResult.confidence },
            }),
            db.classificationResult.create({
              data: {
                emailId: email.id, source: 'ai', categoryId: newCategoryId,
                confidence: aiResult.confidence, rationaleSummary: aiResult.rationale,
              },
            }),
          ])
        }
      } catch (err) {
        console.error('[ingest] AI reclassification failed (non-fatal):', err)
      }
    })()
  }

  // ── 6. Web Push notification for new unread emails ─────────────────────────
  if (!options?.skipNotifications && !raw.isRead) {
    ;(async () => {
      try {
        const account = await db.accountConnection.findUnique({
          where: { id: accountId }, select: { userId: true },
        })
        if (account?.userId) {
          const { sendPushToUser } = await import('@/lib/push/web-push')
          await sendPushToUser(account.userId, {
            title: raw.subject.slice(0, 80),
            body: snippet.slice(0, 120),
            url: `/?view=inbox&emailId=${email.id}`,
            tag: `email-${raw.providerMessageId}`,
            important: raw.isImportant,
          })
        }
      } catch (err) {
        console.error('[ingest] Push notification failed (non-fatal):', err)
      }
    })()
  }

  return email.id
}




export async function getAccountSummary(accountId: string) {
  const account = await db.accountConnection.findUnique({
    where: { id: accountId },
    include: { syncState: true },
  })
  return account
}
