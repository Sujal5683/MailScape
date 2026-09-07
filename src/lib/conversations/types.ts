/**
 * Conversation types — canonical contracts for the conversation intelligence layer.
 * A Conversation groups related emails/threads into a first-class domain concept.
 */

export type ID = string

/** Confidence level for an inferred conversation relationship. */
export type ConfidenceLevel = 'exact' | 'high' | 'medium' | 'low'

/** Relationship between two emails within or across conversations. */
export type RelationshipType =
  | 'reply_to'
  | 'follow_up_to'
  | 'reminder_of'
  | 'clarification_of'
  | 'update_to'
  | 'forward_of'
  | 'related_to'
  | 'supersedes'
  | 'references'

/** Conversation status — single authoritative model (§49). */
export type ConversationStatus =
  | 'active'
  | 'awaiting_user'
  | 'awaiting_other'
  | 'follow_up_due'
  | 'updated'
  | 'resolved'
  | 'archived'

/** Follow-up state for actionable intelligence (§17). */
export type FollowUpState =
  | 'none'
  | 'recommended'
  | 'due'
  | 'awaiting_response'
  | 'resolved'

/** A participant in a conversation. */
export interface ConversationParticipant {
  email: string
  name?: string
  role: 'sender' | 'recipient' | 'both'
}

/** Lightweight conversation summary for list views. */
export interface ConversationSummary {
  id: ID
  accountId: ID
  canonicalSubject: string
  status: ConversationStatus
  followUpState: FollowUpState
  importance: 'normal' | 'important'
  messageCount: number
  threadCount: number
  participants: ConversationParticipant[]
  latestMessageAt: string | null
  firstMessageAt: string | null
  latestSubject: string | null
  latestFromEmail: string | null
  unreadCount: number
  hasAttachments: boolean
  hasDeadline: boolean
  categoryId: ID | null
  categoryName: string | null
  categoryColor: string | null
}

/** Full conversation detail with all messages. */
export interface ConversationDetail extends ConversationSummary {
  messages: ConversationMessage[]
  changes: ConversationChange[]
  aiSummary: string | null
}

/** A single message within a conversation timeline. */
export interface ConversationMessage {
  id: ID
  emailId: ID
  threadId: ID | null
  providerThreadId: string | null
  fromName: string | null
  fromEmail: string
  subject: string | null
  snippet: string | null
  receivedAt: string | null
  isRead: boolean
  isImportant: boolean
  hasAttachment: boolean
  messageType: 'original' | 'reply' | 'follow_up' | 'reminder' | 'update' | 'clarification' | 'final'
  isLatest: boolean
  categoryId: ID | null
  categoryName: string | null
  categoryColor: string | null
}

/** A detected change across conversation messages (§12 "What changed?"). */
export interface ConversationChange {
  field: string // e.g. "Deadline", "Eligibility", "Location"
  earlier: string | null
  latest: string | null
  changedAt: string | null
  sourceMessageId: ID | null
  sourceSubject: string | null
}

/** Result of the conversation resolution engine. */
export interface ResolutionResult {
  conversationId: ID
  confidence: ConfidenceLevel
  reason: string
  isNew: boolean
}
