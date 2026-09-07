/**
 * Conversation mappers — convert Prisma rows to DTOs.
 * Centralized so all conversation API routes return consistent shapes.
 */

import type {
  ConversationSummary,
  ConversationDetail,
  ConversationMessage,
  ConversationChange,
  ConversationParticipant,
} from './types'
import { detectMessageType } from './resolver'
import type { Conversation, Email, CategoryMembership, Category, Thread } from '@prisma/client'

/** Parse participant summary JSON safely. */
function parseParticipants(json: string): ConversationParticipant[] {
  try {
    return JSON.parse(json || '[]') as ConversationParticipant[]
  } catch {
    return []
  }
}

/** Map a Conversation row (with includes) to a ConversationSummary. */
export function mapConversationSummary(
  c: Conversation & {
    threads?: Thread[]
    _count?: { threads: number }
  },
): ConversationSummary {
  const participants = parseParticipants(c.participantSummary)
  const threadCount = c._count?.threads ?? c.threads?.length ?? 0
  return {
    id: c.id,
    accountId: c.accountId,
    canonicalSubject: c.canonicalSubject,
    status: c.status as ConversationSummary['status'],
    followUpState: c.followUpState as ConversationSummary['followUpState'],
    importance: c.importance as ConversationSummary['importance'],
    messageCount: c.messageCount,
    threadCount,
    participants,
    latestMessageAt: c.latestMessageAt?.toISOString() ?? null,
    firstMessageAt: c.firstMessageAt?.toISOString() ?? null,
    latestSubject: null,
    latestFromEmail: null,
    unreadCount: 0,
    hasAttachments: false,
    hasDeadline: false,
    categoryId: null,
    categoryName: null,
    categoryColor: null,
  }
}

/** Map a full conversation with messages + changes to ConversationDetail. */
export function mapConversationDetail(
  c: Conversation & {
    threads: (Thread & {
      emails: (Email & {
        memberships: (CategoryMembership & { category: Category })[]
      })[]
    })[]
  },
): ConversationDetail {
  const base = mapConversationSummary(c)

  // Flatten all emails across threads, sorted by receivedAt
  const allEmails = c.threads
    .flatMap((t) => t.emails)
    .sort((a, b) => (a.receivedAt?.getTime() ?? 0) - (b.receivedAt?.getTime() ?? 0))

  const messages: ConversationMessage[] = allEmails.map((e, i) => {
    const cat = e.memberships[0]?.category
    return {
      id: e.id,
      emailId: e.id,
      threadId: e.threadId ?? null,
      providerThreadId: e.providerThreadId ?? null,
      fromName: e.fromName,
      fromEmail: e.fromEmail,
      subject: e.subject,
      snippet: e.snippet,
      receivedAt: e.receivedAt?.toISOString() ?? null,
      isRead: e.isRead,
      isImportant: e.isImportant,
      hasAttachment: e.hasAttachment,
      messageType: detectMessageType(e.subject, i, allEmails.length) as ConversationMessage['messageType'],
      isLatest: i === allEmails.length - 1,
      categoryId: cat?.id ?? null,
      categoryName: cat?.name ?? null,
      categoryColor: cat?.color ?? null,
    }
  })

  const changes = detectChanges(allEmails)

  return {
    ...base,
    messages,
    changes,
    aiSummary: c.aiSummary,
  }
}

/**
 * Detect changes across conversation messages (§12 "What changed?").
 * Extracts deadlines, eligibility, location, and other key fields from each
 * message and computes diffs. Grounded in actual message content — never fabricates.
 */
function detectChanges(
  emails: Email[],
): ConversationChange[] {
  const changes: ConversationChange[] = []
  if (emails.length < 2) return changes

  // Extract key fields from each email's body
  const fieldExtractors: { field: string; pattern: RegExp }[] = [
    { field: 'Deadline', pattern: /(?:deadline|due(?:\s+by)?|submit\s+by|last\s+date)\s*:?\s*([^\n.]{3,60})/i },
    { field: 'Eligibility', pattern: /(?:eligib(?:le|ility)|cgpa|grade)\s*:?\s*([^\n.]{3,60})/i },
    { field: 'Location', pattern: /(?:location|venue|auditorium|room)\s*:?\s*([^\n.]{3,60})/i },
    { field: 'Time', pattern: /(?:time|at)\s*:?\s*(\d{1,2}[:.]?\d{0,2}\s*(?:am|pm)?)/i },
    { field: 'Date', pattern: /(?:date|on)\s*:?\s*([^\n.]{3,40})/i },
  ]

  for (const { field, pattern } of fieldExtractors) {
    const values: { value: string; emailId: string; subject: string | null; receivedAt: Date | null }[] = []
    for (const e of emails) {
      const text = `${e.subject ?? ''}\n${e.bodyText ?? ''}`
      const match = text.match(pattern)
      if (match?.[1]) {
        values.push({
          value: match[1].trim().slice(0, 80),
          emailId: e.id,
          subject: e.subject,
          receivedAt: e.receivedAt,
        })
      }
    }

    // If we have 2+ distinct values, record the change
    if (values.length >= 2) {
      const first = values[0]
      const last = values[values.length - 1]
      if (first.value.toLowerCase() !== last.value.toLowerCase()) {
        changes.push({
          field,
          earlier: first.value,
          latest: last.value,
          changedAt: last.receivedAt?.toISOString() ?? null,
          sourceMessageId: last.emailId,
          sourceSubject: last.subject,
        })
      }
    }
  }

  return changes
}
