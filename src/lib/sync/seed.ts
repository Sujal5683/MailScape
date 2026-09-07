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
 * ingestEmail — the single normalization → classify → persist → deadlines →
 * notifications pipeline. Exported so the scan service (src/lib/scan/service.ts)
 * can re-ingest discovered messages without duplicating the pipeline.
 *
 * `sendersMap` + `threadsMap` are caller-owned batch-local caches so repeated
 * upserts within a single scan don't generate a DB round-trip per message.
 */
export async function ingestEmail(
  raw: RawEmail,
  accountId: string,
  categoryMap: Map<string, string>,
  sendersMap: Map<string, string>,
  threadsMap: Map<string, string>,
): Promise<string> {
  const domain = raw.fromEmail.split('@')[1] ?? null

  // Upsert sender.
  let senderId = sendersMap.get(raw.fromEmail)
  if (!senderId) {
    const sender = await db.sender.upsert({
      where: { accountId_senderEmail: { accountId, senderEmail: raw.fromEmail } },
      update: {
        senderName: raw.fromName,
        domain,
        lastSeenAt: new Date(raw.receivedAt),
        messageCount: { increment: 1 },
      },
      create: {
        accountId,
        senderEmail: raw.fromEmail,
        senderName: raw.fromName,
        domain,
        firstSeenAt: new Date(raw.receivedAt),
        lastSeenAt: new Date(raw.receivedAt),
        messageCount: 1,
        discovered: true,
      },
    })
    senderId = sender.id
    sendersMap.set(raw.fromEmail, senderId)
  } else {
    await db.sender.update({
      where: { id: senderId },
      data: { lastSeenAt: new Date(raw.receivedAt), messageCount: { increment: 1 } },
    })
  }

  // Upsert thread.
  let threadId = threadsMap.get(raw.providerThreadId)
  if (!threadId) {
    const thread = await db.thread.create({
      data: {
        accountId,
        providerThreadId: raw.providerThreadId,
        subject: raw.subject,
        lastMessageAt: new Date(raw.receivedAt),
      },
    })
    threadId = thread.id
    threadsMap.set(raw.providerThreadId, threadId)
  } else {
    await db.thread.update({
      where: { id: threadId },
      data: { lastMessageAt: new Date(raw.receivedAt) },
    })
  }

  // Classify.
  const sanitizedHtml = sanitizeHtml(raw.bodyHtml)
  const bodyText = raw.bodyText || htmlToText(raw.bodyHtml)
  const snippet = makeSnippet(bodyText)
  const links = extractUrls(bodyText)
  const attachmentTypes = (raw.attachments ?? []).map((a) => a.mimeType)

  const classification = classifyByEmail({
    fromEmail: raw.fromEmail,
    fromName: raw.fromName,
    domain,
    subject: raw.subject,
    bodyText,
    hasAttachment: (raw.attachments ?? []).length > 0,
    attachmentTypes,
  })

  const categoryId = categoryMap.get(classification.categoryName) ?? categoryMap.get('Others')!

  // Create email.
  const email = await db.email.create({
    data: {
      accountId,
      threadId,
      providerMessageId: raw.providerMessageId,
      providerThreadId: raw.providerThreadId,
      senderId,
      fromName: raw.fromName,
      fromEmail: raw.fromEmail,
      toRecipients: JSON.stringify(raw.toRecipients),
      ccRecipients: JSON.stringify(raw.ccRecipients ?? []),
      bccRecipients: JSON.stringify([]),
      subject: raw.subject,
      snippet,
      bodyText,
      bodyHtmlSanitized: sanitizedHtml,
      receivedAt: new Date(raw.receivedAt),
      isRead: raw.isRead,
      isStarred: raw.isStarred,
      isImportant: raw.isImportant,
      // Mailbox bucket flags — optional on RawEmail, default false. Drafts /
      // Sent / Spam surfaces read these via the `filter` param on /api/emails.
      isDraft: raw.isDraft ?? false,
      isSent: raw.isSent ?? false,
      isSpam: raw.isSpam ?? false,
      hasAttachment: (raw.attachments ?? []).length > 0,
      labels: JSON.stringify(raw.labels ?? ['inbox']),
      extractedLinks: JSON.stringify(links),
      classificationSource: classification.source,
      classificationConfidence: classification.confidence,
    },
  })

  // Category membership.
  await db.categoryMembership.create({
    data: {
      emailId: email.id,
      categoryId,
      source: classification.source,
      confidence: classification.confidence,
    },
  })

  // Classification result (audit).
  await db.classificationResult.create({
    data: {
      emailId: email.id,
      source: classification.source,
      categoryId,
      confidence: classification.confidence,
      rationaleSummary: classification.rationale,
    },
  })

  // Attachments.
  for (const att of raw.attachments ?? []) {
    await db.emailAttachment.create({
      data: {
        emailId: email.id,
        providerAttachmentId: `${raw.providerMessageId}-${att.filename}`,
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
        previewable: att.mimeType === 'application/pdf' || att.mimeType.startsWith('image/'),
      },
    })
  }

  // Deadlines extraction.
  const deadlines = extractDeadlines(raw.subject, bodyText)
  for (const dl of deadlines) {
    if (dl.dueAt) {
      await db.deadline.create({
        data: {
          accountId,
          emailId: email.id,
          categoryId,
          title: dl.title.slice(0, 200),
          dueAt: new Date(dl.dueAt),
          confidence: dl.confidence,
          status: 'open',
        },
      })
    }
  }

  // Action items extraction (deterministic heuristics for common institutional patterns).
  const actionItems = extractActionItems(raw.subject, bodyText)
  for (const ai of actionItems) {
    await db.actionItem.create({
      data: {
        accountId,
        emailId: email.id,
        title: ai.title,
        dueAt: ai.dueAt ? new Date(ai.dueAt) : null,
        status: 'open',
      },
    })
  }

  // Notifications for unread/important emails.
  if (!raw.isRead && raw.isImportant) {
    await db.notification.create({
      data: {
        accountId,
        emailId: email.id,
        categoryId,
        title: raw.subject.slice(0, 120),
        body: snippet,
        importance: 'important',
        isRead: false,
      },
    })
  } else if (!raw.isRead) {
    await db.notification.create({
      data: {
        accountId,
        emailId: email.id,
        categoryId,
        title: raw.subject.slice(0, 120),
        body: snippet,
        importance: 'normal',
        isRead: false,
      },
    })
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
