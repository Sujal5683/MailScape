// Frontend API client — typed fetch helpers consumed by TanStack Query hooks.
// All requests use relative paths (Caddy gateway handles routing).

import type {
  EmailListItem,
  EmailDetail,
  ThreadSummary,
  SenderSummary,
  CategorySummary,
  Rule,
  Notification,
  NotificationGroup,
  Deadline,
  ActionItem,
  DashboardData,
  SearchResult,
  SearchFilters,
  SavedSearch,
  AssistantConversationDTO,
  AssistantMessageDTO,
  AssistantActionDTO,
  AccountConnectionDTO,
  Draft,
  Recipient,
  AuditEventPage,
} from '@/lib/types'
import type { ConversationSummary, ConversationDetail } from '@/lib/conversations/types'

// Lightweight DTO for the latest persisted ClassificationResult of an email.
// Denormalizes the associated category so the detail footer can render without
// a second categories lookup. Defined here (not in types.ts) to keep the
// contract EmailDetail type untouched.
export interface ClassificationResultDTO {
  id: string
  emailId: string
  source: string
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
  categoryIcon: string | null
  confidence: number | null
  rationaleSummary: string | null
  createdAt: string
}

export class ApiClientError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!res.ok) {
    const msg = typeof data === 'object' && data && 'error' in data
      ? String((data as { error: string }).error)
      : `Request failed (${res.status})`
    throw new ApiClientError(msg, res.status)
  }
  return data as T
}

// ---------- Accounts ----------
export const api = {
  accounts: {
    list: () => req<AccountConnectionDTO[]>('/api/accounts'),
    sync: (accountId: string) =>
      req<{ ok: boolean; status: string }>(`/api/accounts/${accountId}/sync`, { method: 'POST' }),
    remove: (accountId: string) =>
      req<{ ok: boolean }>(`/api/accounts/${accountId}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirm: true }),
      }),
    // Connect triggers the NextAuth Google OAuth flow.
    // The actual linking is handled by the NextAuth signIn callback.
    // This function navigates to the Google sign-in page.
    connect: () => {
      import('next-auth/react').then(({ signIn }) => signIn('google'))
      return Promise.resolve({} as AccountConnectionDTO)
    },
  },

  emails: {
    list: (params: {
      cursor?: string
      limit?: number
      categoryId?: string
      senderId?: string
      unreadOnly?: boolean
      importantOnly?: boolean
      starredOnly?: boolean
      snoozedOnly?: boolean
      includeSnoozed?: boolean
      archivedOnly?: boolean
      // Coarse bucket filter (drafts | sent | spam | starred). Maps to a single
      // flag predicate on the server; see /api/emails/route.ts for the full
      // semantics. Used by the Drafts / Sent / Spam views.
      filter?: 'drafts' | 'sent' | 'spam' | 'starred'
    } = {}) => {
      const q = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
      })
      return req<{ items: EmailListItem[]; nextCursor: string | null; total: number }>(
        `/api/emails?${q.toString()}`,
      )
    },
    get: (id: string) => req<EmailDetail>(`/api/emails/${id}`),
    markRead: (id: string, read: boolean) =>
      req<{ ok: boolean }>(`/api/emails/${id}/read`, {
        method: 'POST',
        body: JSON.stringify({ read }),
      }),
    star: (id: string, starred: boolean) =>
      req<{ ok: boolean }>(`/api/emails/${id}/star`, {
        method: 'POST',
        body: JSON.stringify({ starred }),
      }),
    markImportant: (id: string, important: boolean) =>
      req<{ ok: boolean }>(`/api/emails/${id}/important`, {
        method: 'POST',
        body: JSON.stringify({ important }),
      }),
    snooze: (id: string, until: string | null) =>
      req<{ ok: boolean }>(`/api/emails/${id}/snooze`, {
        method: 'POST',
        body: JSON.stringify({ until }),
      }),
    classification: (id: string) =>
      req<ClassificationResultDTO | null>(`/api/emails/${id}/classification`),
    thread: (threadId: string) => req<ThreadSummary>(`/api/threads/${threadId}`),
    // Restore an archived email back to the inbox (clears isArchived).
    restore: (id: string) =>
      req<{ ok: boolean }>(`/api/emails/${id}/restore`, { method: 'POST' }),
    // HARD-DELETE an email and every tied record. Sensitive — confirm: true is
    // required by the route and supplied automatically here so callers can't
    // forget it. Irreversible.
    permanentDelete: (id: string) =>
      req<{ ok: boolean }>(`/api/emails/${id}/permanent-delete`, {
        method: 'DELETE',
        body: JSON.stringify({ confirm: true }),
      }),
  },

  // Archived emails — same shape as emails.list but always archivedOnly=true.
  // Kept as its own namespace so the Archive view has a self-documenting call
  // site and the query key can be invalidated independently of the inbox list.
  archivedEmails: {
    list: () =>
      req<{ items: EmailListItem[]; nextCursor: string | null; total: number }>(
        '/api/emails?archivedOnly=true',
      ),
  },

  // Drafts / Sent / Spam — self-documenting namespaces that delegate to the
  // unified /api/emails endpoint with the appropriate `filter` param. Kept as
  // their own namespaces so views have a clear call site, and so future
  // invalidations can target a specific bucket without blasting the inbox list.
  drafts: {
    list: () =>
      req<{ items: EmailListItem[]; nextCursor: string | null; total: number }>(
        '/api/emails?filter=drafts',
      ),
  },
  sentEmails: {
    list: () =>
      req<{ items: EmailListItem[]; nextCursor: string | null; total: number }>(
        '/api/emails?filter=sent',
      ),
  },
  spamEmails: {
    list: () =>
      req<{ items: EmailListItem[]; nextCursor: string | null; total: number }>(
        '/api/emails?filter=spam',
      ),
  },

  categories: {
    list: () => req<CategorySummary[]>('/api/categories'),
    create: (data: { name: string; description?: string; color?: string; icon?: string }) =>
      req<CategorySummary>('/api/categories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ name: string; description: string; color: string; icon: string }>) =>
      req<CategorySummary>(`/api/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) =>
      req<{ ok: boolean }>(`/api/categories/${id}`, { method: 'DELETE' }),
  },

  senders: {
    list: (q?: string) =>
      req<SenderSummary[]>(`/api/senders${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    get: (id: string) => req<SenderSummary>(`/api/senders/${id}`),
  },

  rules: {
    list: () => req<Rule[]>('/api/rules'),
    create: (data: { name: string; expression: unknown; actions: unknown; priority?: number; enabled?: boolean }) =>
      req<Rule>('/api/rules', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ name: string; expression: unknown; actions: unknown; priority: number; enabled: boolean }>) =>
      req<Rule>(`/api/rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => req<{ ok: boolean }>(`/api/rules/${id}`, { method: 'DELETE' }),
  },

  search: {
    structured: (filters: SearchFilters) =>
      req<SearchResult>('/api/search', { method: 'POST', body: JSON.stringify(filters) }),
    naturalLanguage: (query: string) =>
      req<{ parsed: SearchFilters; summary: string }>('/api/search/natural-language', {
        method: 'POST',
        body: JSON.stringify({ query }),
      }),
  },

  dashboard: () => req<DashboardData>('/api/dashboard'),

  notifications: {
    list: (filter?: 'all' | 'unread' | 'important') =>
      req<NotificationGroup[]>(`/api/notifications?filter=${filter ?? 'all'}`),
    markRead: (id: string) =>
      req<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: 'POST' }),
    markAllRead: () =>
      req<{ ok: boolean }>('/api/notifications/read-all', { method: 'POST' }),
    remove: (id: string) =>
      req<{ ok: boolean }>(`/api/notifications/${id}`, { method: 'DELETE' }),
    test: () =>
      req<{ ok: boolean; id: string }>('/api/notifications/test', { method: 'POST' }),
  },

  notificationPreferences: {
    list: () =>
      req<{
        channels: {
          channel: 'in_app' | 'web' | 'push'
          preferences: { categoryId: string | '__global__'; enabled: boolean }[]
        }[]
      }>('/api/notification-preferences'),
    update: (data: {
      channel: 'in_app' | 'web' | 'push'
      categoryId: string | null
      enabled: boolean
    }) =>
      req<{ ok: boolean }>('/api/notification-preferences', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  deadlines: (status?: 'open' | 'done' | 'missed' | 'all') =>
    req<Deadline[]>(`/api/deadlines${status ? `?status=${status}` : ''}`),
  actionItems: () => req<ActionItem[]>('/api/action-items'),

  assistant: {
    conversations: (opts?: { includeArchived?: boolean }) =>
      req<AssistantConversationDTO[]>(
        `/api/assistant/conversations${opts?.includeArchived ? '?includeArchived=true' : ''}`,
      ),
    createConversation: (data: { mode?: string; title?: string }) =>
      req<AssistantConversationDTO>('/api/assistant/conversations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    messages: (conversationId: string) =>
      req<AssistantMessageDTO[]>(`/api/assistant/conversations/${conversationId}/messages`),
    sendMessage: (
      conversationId: string,
      data: { content: string; mode?: string; attachments?: { filename: string; mimeType: string; data: string }[] },
    ) =>
      req<{ userMessage: AssistantMessageDTO; assistantMessage: AssistantMessageDTO }>(
        `/api/assistant/conversations/${conversationId}/messages`,
        { method: 'POST', body: JSON.stringify(data) },
      ),
    actions: (conversationId: string) =>
      req<AssistantActionDTO[]>(`/api/assistant/conversations/${conversationId}/actions`),
    revert: (actionId: string) =>
      req<{ ok: boolean; status: string }>(`/api/assistant/actions/${actionId}/revert`, { method: 'POST' }),
    // PATCH { title?, archived? } — rename and/or (un)archive a conversation.
    updateConversation: (
      id: string,
      data: { title?: string; archived?: boolean },
    ) =>
      req<AssistantConversationDTO>(`/api/assistant/conversations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    // HARD-DELETE a conversation + cascade (messages + actions). Irreversible.
    deleteConversation: (id: string) =>
      req<{ ok: boolean }>(`/api/assistant/conversations/${id}`, { method: 'DELETE' }),
  },

  compose: {
    saveDraft: (data: { accountId: string; to: Recipient[]; cc?: Recipient[]; subject?: string; body?: string }) =>
      req<Draft>('/api/compose/drafts', { method: 'POST', body: JSON.stringify(data) }),
    send: (data: { accountId: string; to: Recipient[]; cc?: Recipient[]; subject?: string; body?: string }) =>
      req<{ ok: boolean; messageId: string } & { confirmation?: boolean }>(
        '/api/compose/send',
        { method: 'POST', body: JSON.stringify(data) },
      ),
    recipients: (q: string) =>
      req<Recipient[]>(`/api/recipients/search?q=${encodeURIComponent(q)}`),
  },

  savedSearches: {
    list: () => req<SavedSearch[]>('/api/saved-searches'),
    create: (data: { name: string; filters: SearchFilters }) =>
      req<SavedSearch>('/api/saved-searches', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id: string) =>
      req<{ ok: boolean }>(`/api/saved-searches/${id}`, { method: 'DELETE' }),
  },

  auditEvents: {
    // Account-scoped audit log. `type` is a partial eventType match (e.g.
    // "EMAIL_" or "AI_RULE_CREATED"); `surface` filters by sourceSurface.
    // Cursor pagination by id; ordered by createdAt desc server-side.
    list: (params: {
      type?: string
      surface?: 'ui' | 'ai' | 'api' | 'system'
      cursor?: string
      limit?: number
    } = {}) => {
      const q = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
      })
      return req<AuditEventPage>(`/api/audit-events?${q.toString()}`)
    },
  },

  // ---------- Conversations ----------
  conversations: {
    list: (params: { status?: string; followUp?: string; limit?: number } = {}) => {
      const q = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, String(v)) })
      return req<ConversationSummary[]>(`/api/conversations?${q.toString()}`)
    },
    get: (id: string) => req<ConversationDetail>(`/api/conversations/${id}`),
    update: (id: string, data: Partial<{ status: string; followUpState: string; importance: string }>) =>
      req<{ ok: boolean }>(`/api/conversations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    forEmail: (emailId: string) => req<ConversationDetail | null>(`/api/emails/${emailId}/conversation`),
  },
}
