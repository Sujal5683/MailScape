// Canonical domain types — single source of truth shared by API and frontend.
// Adapted from the spec's data model. Prisma rows are mapped into these shapes.

export type ID = string

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success'
export type ClassificationSource =
  | 'manual_rule'
  | 'user_override'
  | 'sender_rule'
  | 'ai'
  | 'system_default'

export type EmailFlags = {
  isRead: boolean
  isStarred: boolean
  isImportant: boolean
  isSpam: boolean
  isDraft: boolean
  isSent: boolean
  isArchived: boolean
  hasAttachment: boolean
}

export interface Recipient {
  name?: string
  email: string
}

export interface EmailAttachmentMeta {
  id: ID
  filename: string
  mimeType: string
  size: number
  previewable: boolean
}

export interface EmailLinkMeta {
  url: string
  title?: string
}

export interface CategoryRef {
  id: ID
  name: string
  color: string
  icon: string
  source: ClassificationSource
  confidence?: number
}

export interface EmailListItem {
  id: ID
  accountId: ID
  threadId: ID | null
  providerMessageId: string
  providerThreadId: string | null
  fromName: string | null
  fromEmail: string
  toRecipients: Recipient[]
  subject: string | null
  snippet: string | null
  receivedAt: string | null
  hasAttachment: boolean
  attachmentsCount: number
  categories: CategoryRef[]
  classificationSource: ClassificationSource | null
  classificationConfidence: number | null
  flags: EmailFlags
  labels: string[]
  snoozedUntil?: string | null
}

export interface EmailDetail extends EmailListItem {
  ccRecipients: Recipient[]
  bccRecipients: Recipient[]
  bodyText: string | null
  bodyHtmlSanitized: string | null
  extractedLinks: EmailLinkMeta[]
  attachments: EmailAttachmentMeta[]
  gmailUrl: string
}

export interface ThreadSummary {
  id: ID
  providerThreadId: string
  subject: string | null
  lastMessageAt: string | null
  messageCount: number
  emails: EmailListItem[]
}

export interface SenderSummary {
  id: ID
  accountId: ID
  senderEmail: string
  senderName: string | null
  domain: string | null
  firstSeenAt: string | null
  lastSeenAt: string | null
  messageCount: number
  discovered: boolean
  ruleStatus: 'none' | 'has_rule' | 'ignored'
  categories: { id: ID; name: string; count: number }[]
  recentSubjects: string[]
}

export interface CategorySummary {
  id: ID
  accountId: ID
  name: string
  description: string | null
  systemDefault: boolean
  sortOrder: number
  color: string
  icon: string
  totalCount: number
  unreadCount: number
  importantCount: number
  lastActivityAt: string | null
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export type ConditionField =
  | 'sender'
  | 'sender_name'
  | 'sender_email'
  | 'sender_domain'
  | 'to'
  | 'cc'
  | 'bcc'
  | 'subject'
  | 'contains_text'
  | 'not_contains_text'
  | 'has_attachment'
  | 'attachment_type'
  | 'date'
  | 'time'
  | 'labels'
  | 'keywords'
  | 'category'
  | 'is_read'
  | 'is_starred'
  | 'is_important'

export type ConditionOp =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'before'
  | 'after'
  | 'is_true'
  | 'is_false'

export interface Condition {
  field: ConditionField
  op: ConditionOp
  value: string | number | boolean | string[]
}

export interface ConditionGroup {
  combinator: 'AND' | 'OR'
  conditions: (Condition | ConditionGroup)[]
}

export type RuleActionType =
  | 'classify'
  | 'mark_important'
  | 'mark_read'
  | 'mark_unread'
  | 'star'
  | 'unstar'
  | 'add_label'
  | 'remove_label'
  | 'notify'
  | 'create_deadline'

export interface RuleAction {
  type: RuleActionType
  categoryId?: ID
  label?: string
  deadlineTitle?: string
}

export interface Rule {
  id: ID
  accountId: ID
  name: string
  expression: ConditionGroup
  actions: RuleAction[]
  priority: number
  enabled: boolean
  createdBy: 'user' | 'ai' | 'system'
  hitCount: number
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Deadlines, Action Items, Notifications
// ---------------------------------------------------------------------------

export interface Deadline {
  id: ID
  accountId: ID
  emailId: ID | null
  categoryId: ID | null
  title: string
  dueAt: string | null
  confidence: number | null
  status: 'open' | 'done' | 'missed'
  emailSubject?: string | null
  categoryName?: string | null
  categoryColor?: string | null
}

export interface ActionItem {
  id: ID
  accountId: ID
  emailId: ID | null
  title: string
  status: 'open' | 'done'
  dueAt: string | null
}

export interface Notification {
  id: ID
  accountId: ID
  emailId: ID | null
  categoryId: ID | null
  title: string
  body: string | null
  importance: 'normal' | 'important' | 'urgent'
  isRead: boolean
  createdAt: string
  categoryName?: string | null
  categoryColor?: string | null
}

export interface NotificationGroup {
  key: string
  label: string
  color: string
  icon: string
  count: number
  unreadCount: number
  items: Notification[]
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardData {
  totals: {
    emails: number
    unread: number
    important: number
    attachments: number
    senders: number
    categories: number
    deadlinesOpen: number
    notificationsUnread: number
  }
  categoryCounts: { id: ID; name: string; color: string; icon: string; count: number; unread: number }[]
  topSenders: { id: ID; name: string | null; email: string; count: number; domain: string | null }[]
  trend: { date: string; count: number }[]
  deadlines: Deadline[]
  actionItems: ActionItem[]
  recentActivity: { id: ID; subject: string | null; fromEmail: string; receivedAt: string | null; categoryName: string | null; categoryColor: string | null }[]
  aiBrief: {
    summary: string
    highlights: { label: string; value: string }[]
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchFilters {
  query?: string
  sender?: string
  categoryIds?: ID[]
  isRead?: boolean
  isStarred?: boolean
  isImportant?: boolean
  hasAttachment?: boolean
  attachmentType?: string
  dateFrom?: string
  dateTo?: string
  timeFrom?: string
  timeTo?: string
  labels?: string[]
  includeSpam?: boolean
  includeDrafts?: boolean
  includeSent?: boolean
  includeArchived?: boolean
  cursor?: string
  limit?: number
}

export interface SearchResult {
  items: EmailListItem[]
  nextCursor: string | null
  total: number
  parsedFilters?: SearchFilters
}

// ---------------------------------------------------------------------------
// AI Assistant
// ---------------------------------------------------------------------------

export type AssistantMode = 'direct' | 'thinking' | 'suggest'

export interface SourceRef {
  messageId: ID
  subject: string | null
  fromEmail: string
  receivedAt: string | null
  categoryName?: string | null
  gmailUrl?: string
}

export interface AssistantContentBlock {
  type: 'text' | 'summary' | 'table' | 'cards' | 'deadlines' | 'action_items' | 'sources' | 'confirmation' | 'warning' | 'tool_result' | 'chart'
  text?: string
  title?: string
  columns?: { key: string; label: string }[]
  rows?: Record<string, string | number | boolean | null>[]
  cards?: { title: string; subtitle?: string; value?: string; meta?: string; tone?: 'default' | 'success' | 'warning' | 'danger' }[]
  deadlines?: { title: string; date?: string; messageId?: ID }[]
  actionItems?: { title: string; dueAt?: string; messageId?: ID }[]
  sources?: SourceRef[]
  data?: { date: string; count: number }[]
  label?: string
  meta?: Record<string, unknown>
}

export interface AssistantMessageDTO {
  id: ID
  conversationId: ID
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: AssistantContentBlock[]
  attachments: { filename: string; mimeType: string; size: number }[]
  sources: SourceRef[]
  createdAt: string
}

export interface AssistantConversationDTO {
  id: ID
  userId: ID
  accountId: ID | null
  title: string | null
  mode: AssistantMode
  // Soft-delete flag — archived conversations are hidden from the default
  // rail list and shown with a muted style + Unarchive action when the user
  // explicitly opts in to viewing them.
  archived?: boolean
  createdAt: string
  expiresAt: string | null
  messageCount: number
}

export interface AssistantActionDTO {
  id: ID
  conversationId: ID
  toolName: string
  inputSummary: Record<string, unknown>
  resultSummary: Record<string, unknown> | null
  reversible: boolean
  status: 'pending' | 'executed' | 'failed' | 'reverted'
  errorMessage: string | null
  createdAt: string
  revertedAt: string | null
}

// ---------------------------------------------------------------------------
// Compose
// ---------------------------------------------------------------------------

export interface Draft {
  id: ID
  accountId: ID
  toRecipients: Recipient[]
  ccRecipients: Recipient[]
  subject: string | null
  body: string | null
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Accounts & Sync
// ---------------------------------------------------------------------------

export interface AccountConnectionDTO {
  id: ID
  userId: ID
  provider: string
  providerAccountId: string
  emailAddress: string
  displayName: string | null
  status: string
  syncState: {
    syncStatus: SyncStatus
    lastSyncedAt: string | null
    errorMessage: string | null
    retryCount: number
  } | null
  createdAt: string
}

export interface ApiError {
  error: string
  code?: string
  details?: unknown
}

export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
  total: number
}

// ---------------------------------------------------------------------------
// Saved Searches (filter presets)
// ---------------------------------------------------------------------------

export interface SavedSearch {
  id: ID
  accountId: ID
  name: string
  filters: SearchFilters
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Email Templates (compose presets)
// ---------------------------------------------------------------------------

export type EmailTemplateCategory =
  | 'general'
  | 'followup'
  | 'request'
  | 'announcement'
  | 'custom'

export interface EmailTemplate {
  id: ID
  accountId: ID
  name: string
  subject: string
  body: string
  category: EmailTemplateCategory
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Audit Events (account activity log)
// ---------------------------------------------------------------------------

export type AuditSourceSurface = 'ui' | 'ai' | 'api' | 'system'

export interface AuditEventDTO {
  id: ID
  eventType: string
  targetType: string | null
  targetId: string | null
  sourceSurface: AuditSourceSurface | null
  actionId: string | null
  // Parsed JSON metadata stored on the AuditEvent row. The API never includes
  // userId or raw email bodies here — only sanitized context (names, ids,
  // previous flag states, conversation refs, etc.).
  metadata: Record<string, unknown>
  createdAt: string
}

export interface AuditEventPage {
  items: AuditEventDTO[]
  nextCursor: string | null
  total: number
}
