/**
 * Conversation Resolver — the deterministic conversation-matching engine (§6).
 *
 * Pipeline:
 *   1. Gmail thread ID (exact match → EXACT confidence)
 *   2. Normalized subject + participant overlap (→ HIGH confidence)
 *   3. Same sender + time proximity + keyword overlap (→ MEDIUM confidence)
 *   4. Subject keyword overlap only (→ LOW confidence, no auto-merge)
 *
 * AI/semantic inference is used ONLY when deterministic signals are insufficient (§6).
 * Never blindly merge emails just because subjects look similar (§2, §8).
 */

import { db } from '@/lib/db'
import type { ConfidenceLevel, ConversationParticipant } from './types'

/** Normalize a subject by stripping Re:/Fwd:/Re[]: prefixes and whitespace. */
export function normalizeSubject(subject: string | null): string {
  if (!subject) return ''
  return subject
    .replace(/^(\s*(re|fwd|fw|aw|wg)\s*(\[\d+\])?\s*:\s*)+/gi, '')
    .trim()
    .toLowerCase()
}

/** Extract participants from an email's to/cc/from fields. */
export function extractParticipants(email: {
  fromEmail: string
  fromName: string | null
  toRecipients: string
  ccRecipients: string
}): ConversationParticipant[] {
  const participants: Map<string, ConversationParticipant> = new Map()
  // Sender
  participants.set(email.fromEmail.toLowerCase(), {
    email: email.fromEmail.toLowerCase(),
    name: email.fromName ?? undefined,
    role: 'sender',
  })
  // Recipients
  try {
    const to = JSON.parse(email.toRecipients || '[]') as Array<{ email: string; name?: string }>
    const cc = JSON.parse(email.ccRecipients || '[]') as Array<{ email: string; name?: string }>
    for (const r of [...to, ...cc]) {
      const emailLower = r.email.toLowerCase()
      const existing = participants.get(emailLower)
      if (existing) {
        existing.role = 'both'
      } else {
        participants.set(emailLower, { email: emailLower, name: r.name, role: 'recipient' })
      }
    }
  } catch {
    // ignore JSON parse errors
  }
  return Array.from(participants.values())
}

/** Compute participant overlap between two sets. */
function participantOverlap(a: ConversationParticipant[], b: ConversationParticipant[]): number {
  const setA = new Set(a.map((p) => p.email))
  const setB = new Set(b.map((p) => p.email))
  const intersection = new Set([...setA].filter((x) => setB.has(x)))
  const union = new Set([...setA, ...setB])
  return union.size > 0 ? intersection.size / union.size : 0
}

/** Check if two subjects are similar enough to be related. */
function subjectSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1.0
  // Token overlap (Jaccard)
  const tokensA = new Set(a.split(/\s+/).filter((t) => t.length > 2))
  const tokensB = new Set(b.split(/\s+/).filter((t) => t.length > 2))
  const intersection = new Set([...tokensA].filter((x) => tokensB.has(x)))
  const union = new Set([...tokensA, ...tokensB])
  return union.size > 0 ? intersection.size / union.size : 0
}

/** Resolve an incoming email to a conversation. */
export async function resolveConversation(
  email: {
    id: string
    accountId: string
    threadId: string | null
    providerThreadId: string | null
    subject: string | null
    fromEmail: string
    fromName: string | null
    toRecipients: string
    ccRecipients: string
    receivedAt: Date | null
  },
): Promise<{ conversationId: string; confidence: ConfidenceLevel; reason: string; isNew: boolean }> {
  const accountId = email.accountId

  // 1. EXACT: same Gmail thread → find existing conversation via thread
  if (email.threadId) {
    const thread = await db.thread.findUnique({
      where: { id: email.threadId },
      select: { conversationId: true },
    })
    if (thread?.conversationId) {
      return {
        conversationId: thread.conversationId,
        confidence: 'exact',
        reason: 'Same Gmail thread',
        isNew: false,
      }
    }
  }

  const normSubject = normalizeSubject(email.subject)
  const participants = extractParticipants(email)

  // 2. HIGH: same normalized subject + participant overlap > 0.5
  if (normSubject) {
    // Find conversations with matching normalized subject
    const conversations = await db.conversation.findMany({
      where: { accountId },
      select: {
        id: true,
        canonicalSubject: true,
        participantSummary: true,
        latestMessageAt: true,
        threads: { select: { id: true, subject: true } },
      },
      take: 100, // limit scan
    })

    for (const conv of conversations) {
      const convNorm = normalizeSubject(conv.canonicalSubject)
      if (convNorm !== normSubject) continue

      // Check participant overlap
      try {
        const convParticipants = JSON.parse(conv.participantSummary || '[]') as ConversationParticipant[]
        const overlap = participantOverlap(participants, convParticipants)
        if (overlap >= 0.5) {
          return {
            conversationId: conv.id,
            confidence: 'high',
            reason: `Same subject + ${Math.round(overlap * 100)}% participant overlap`,
            isNew: false,
          }
        }
      } catch {
        // skip malformed
      }
    }

    // 3. MEDIUM: high subject similarity + same sender + time proximity (7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    for (const conv of conversations) {
      const convNorm = normalizeSubject(conv.canonicalSubject)
      const similarity = subjectSimilarity(normSubject, convNorm)
      if (similarity < 0.6) continue

      try {
        const convParticipants = JSON.parse(conv.participantSummary || '[]') as ConversationParticipant[]
        const hasSameSender = convParticipants.some((p) => p.email === email.fromEmail.toLowerCase())
        const isRecent = conv.latestMessageAt && conv.latestMessageAt > sevenDaysAgo
        if (hasSameSender && isRecent) {
          return {
            conversationId: conv.id,
            confidence: 'medium',
            reason: `Similar subject (${Math.round(similarity * 100)}%) + same sender + recent`,
            isNew: false,
          }
        }
      } catch {
        // skip
      }
    }
  }

  // 4. No match → create new conversation
  const conversation = await db.conversation.create({
    data: {
      accountId,
      canonicalSubject: email.subject?.replace(/^(\s*(re|fwd|fw)\s*:\s*)+/i, '').trim() || '(no subject)',
      messageCount: 0,
      participantSummary: JSON.stringify(participants),
      firstMessageAt: email.receivedAt,
      latestMessageAt: email.receivedAt,
    },
  })

  return {
    conversationId: conversation.id,
    confidence: 'exact',
    reason: 'New conversation created',
    isNew: true,
  }
}

/** Assign a thread to a conversation + update conversation metadata. */
export async function assignThreadToConversation(
  threadId: string,
  conversationId: string,
): Promise<void> {
  await db.thread.update({
    where: { id: threadId },
    data: { conversationId },
  })

  // Update conversation metadata
  const emails = await db.email.findMany({
    where: { threadId },
    select: { receivedAt: true, isRead: true, fromEmail: true, fromName: true, toRecipients: true, ccRecipients: true, subject: true },
    orderBy: { receivedAt: 'asc' },
  })

  if (emails.length === 0) return

  // Merge participants
  const allParticipants: Map<string, ConversationParticipant> = new Map()
  for (const e of emails) {
    const parts = extractParticipants(e)
    for (const p of parts) {
      const existing = allParticipants.get(p.email)
      if (existing) existing.role = 'both'
      else allParticipants.set(p.email, p)
    }
  }

  const firstAt = emails[0].receivedAt
  const lastAt = emails[emails.length - 1].receivedAt

  // Count total messages across all threads in this conversation
  const threadCount = await db.thread.count({ where: { conversationId } })
  const totalMessages = await db.email.count({
    where: { thread: { conversationId } },
  })

  await db.conversation.update({
    where: { id: conversationId },
    data: {
      messageCount: totalMessages,
      participantSummary: JSON.stringify(Array.from(allParticipants.values())),
      firstMessageAt: firstAt,
      latestMessageAt: lastAt,
    },
  })
}

/** Detect message type from subject + context (§10). */
export function detectMessageType(
  subject: string | null,
  index: number,
  total: number,
): ConversationMessage_type {
  if (index === 0) return 'original'
  if (index === total - 1) {
    const s = (subject || '').toLowerCase()
    if (s.includes('final') || s.includes('last')) return 'final'
    if (s.includes('reminder')) return 'reminder'
    if (s.includes('update') || s.includes('updated')) return 'update'
  }
  const s = (subject || '').toLowerCase()
  if (s.includes('reminder')) return 'reminder'
  if (s.includes('follow') || s.includes('following up')) return 'follow_up'
  if (s.includes('clarif') || s.includes('question')) return 'clarification'
  if (s.includes('update') || s.includes('updated') || s.includes('revised')) return 'update'
  if (s.startsWith('re:')) return 'reply'
  return 'reply'
}

type ConversationMessage_type = 'original' | 'reply' | 'follow_up' | 'reminder' | 'update' | 'clarification' | 'final'

/** Detect follow-up state for a conversation (§15-17). */
export function detectFollowUpState(
  messages: { fromEmail: string; receivedAt: Date | null; subject: string | null }[],
  accountEmail: string,
): { state: 'none' | 'recommended' | 'due' | 'awaiting_response'; reason: string } {
  if (messages.length === 0) return { state: 'none', reason: '' }

  const sorted = [...messages].sort(
    (a, b) => (a.receivedAt?.getTime() ?? 0) - (b.receivedAt?.getTime() ?? 0),
  )
  const latest = sorted[sorted.length - 1]
  const isFromUser = latest.fromEmail.toLowerCase() === accountEmail.toLowerCase()

  if (isFromUser) {
    // User sent the last message → awaiting response from other party
    const daysSince = latest.receivedAt
      ? Math.floor((Date.now() - latest.receivedAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0
    if (daysSince >= 7) {
      return { state: 'due', reason: `You sent a message ${daysSince} days ago with no response` }
    }
    if (daysSince >= 3) {
      return { state: 'recommended', reason: `You sent a message ${daysSince} days ago` }
    }
    return { state: 'awaiting_response', reason: 'Awaiting response from the other party' }
  }

  // Other party sent the last message → check if user needs to respond
  const subject = (latest.subject || '').toLowerCase()
  if (subject.includes('reminder') || subject.includes('follow') || subject.includes('action required')) {
    return { state: 'due', reason: 'The latest message is a reminder/action request' }
  }

  return { state: 'none', reason: '' }
}
