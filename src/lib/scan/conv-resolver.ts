// Conversation resolution helper for the scan executor.
// Split out so executor.ts stays under the 120-line ceiling.

import { db } from '@/lib/db'
import {
  resolveConversation,
  assignThreadToConversation,
  detectFollowUpState,
} from '@/lib/conversations/resolver'

/**
 * Resolve a conversation for the freshly-ingested email + update its
 * follow-up state + status. Mirrors the same flow the seed pipeline uses
 * in src/lib/sync/seed.ts.
 */
export async function resolveConversationForEmail(
  emailId: string,
  accountId: string,
  providerThreadId: string,
  accountEmail: string,
): Promise<void> {
  const email = await db.email.findFirst({
    where: { id: emailId },
    select: {
      id: true, threadId: true, subject: true, fromEmail: true, fromName: true,
      toRecipients: true, ccRecipients: true, receivedAt: true,
    },
  })
  if (!email?.threadId) return
  const result = await resolveConversation({ ...email, accountId, providerThreadId })
  await assignThreadToConversation(email.threadId, result.conversationId)
  const conv = await db.conversation.findUnique({
    where: { id: result.conversationId },
    include: {
      threads: {
        include: {
          emails: {
            select: { fromEmail: true, receivedAt: true, subject: true, isRead: true, isImportant: true },
            orderBy: { receivedAt: 'asc' as const },
          },
        },
      },
    },
  })
  if (!conv) return
  const msgs = conv.threads.flatMap((t) => t.emails)
  const { state } = detectFollowUpState(msgs, accountEmail)
  const status =
    state === 'awaiting_response' ? 'awaiting_other'
    : state === 'due' ? 'follow_up_due'
    : msgs.some((m) => !m.isRead) ? 'updated' : 'active'
  await db.conversation.update({
    where: { id: result.conversationId },
    data: {
      followUpState: state,
      status,
      importance: msgs.some((m) => m.isImportant) ? 'important' : 'normal',
    },
  })
}
