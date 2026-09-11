'use client'

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type ClassificationResultDTO } from '@/lib/api-client'
import { qk } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import { formatDateTime } from '@/lib/format'
import type {
  SearchFilters,
  SavedSearch,
  EmailTemplate,
  EmailTemplateCategory,
  AssistantMode,
  Recipient,
  AuditSourceSurface,
} from '@/lib/types'
import type {
  ScanJobDTO,
  ScanConfig,
  ScanConfigurationDTO,
  SyncStatusDTO,
} from '@/lib/scan/types'
import type { WeeklyDigest } from '@/app/api/assistant/digest/route'
import type { SmartRepliesResult } from '@/app/api/emails/[messageId]/smart-replies/route'
import {
  useOptimisticMarkRead,
  useOptimisticStar,
  useOptimisticImportant,
} from '@/lib/mutations/email-mutations'

// ---------- Accounts ----------
export function useAccounts() {
  return useQuery({ queryKey: qk.accounts, queryFn: api.accounts.list })
}
export function useSyncAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (accountId: string) => api.accounts.sync(accountId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.accounts })
      qc.invalidateQueries({ queryKey: ['emails'] })
      qc.invalidateQueries({ queryKey: qk.dashboard() })
      qc.invalidateQueries({ queryKey: qk.categories() })
    },
  })
}

// ---------- Emails ----------
export function useEmails(params: Parameters<typeof api.emails.list>[0] = {}) {
  return useQuery({
    queryKey: qk.emails(params),
    queryFn: () => api.emails.list(params),
    placeholderData: (prev) => prev,
  })
}
export function useEmail(id: string | null) {
  return useQuery({
    queryKey: id ? qk.email(id) : ['emails', 'detail', 'none'],
    queryFn: () => api.emails.get(id!),
    enabled: !!id,
  })
}
// Mark an email read/unread with an OPTIMISTIC update across every email
// cache (inbox + mailbox buckets + detail + archived + search results) and
// rollback on error. See `src/lib/mutations/email-mutations.ts` for the shared
// optimistic strategy. The hook keeps the legacy `{ id, read }` signature so
// every existing caller (inbox-view, email-detail, search-results, email-list,
// keyboard shortcuts) works unchanged.
export function useMarkRead() {
  return useOptimisticMarkRead()
}
// Star/unstar — same optimistic strategy as useMarkRead.
export function useStarEmail() {
  return useOptimisticStar()
}
export function useThread(threadId: string | null) {
  return useQuery({
    queryKey: threadId ? qk.thread(threadId) : ['threads', 'none'],
    queryFn: () => api.emails.thread(threadId!),
    enabled: !!threadId,
  })
}
export function useMarkImportant() {
  return useOptimisticImportant()
}
export function useClassificationResults(emailId: string | null) {
  return useQuery({
    queryKey: emailId
      ? ['emails', 'detail', emailId, 'classification']
      : ['emails', 'detail', 'none', 'classification'],
    queryFn: () => api.emails.classification(emailId!) as Promise<ClassificationResultDTO | null>,
    enabled: !!emailId,
  })
}

// Snooze an email until a later time (or unsnooze with `until: null`).
// On success: invalidates the email list + the open email detail (so the
// toolbar reflects the new state) + the dashboard, and shows a toast that
// varies by direction so the user gets clear feedback either way.
export function useSnoozeEmail() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ id, until }: { id: string; until: string | null }) =>
      api.emails.snooze(id, until),
    onSuccess: (_d, { id, until }) => {
      qc.invalidateQueries({ queryKey: qk.email(id) })
      qc.invalidateQueries({ queryKey: ['emails'] })
      qc.invalidateQueries({ queryKey: qk.dashboard() })
      if (until) {
        toast({
          title: 'Snoozed until',
          description: formatDateTime(until),
        })
      } else {
        toast({ title: 'Email unsnoozed' })
      }
    },
  })
}

// ---------- Archived emails ----------
// The Archive view's three hooks. Restore + permanent-delete invalidate the
// inbox list (['emails']), the archive list (qk.archived()), and the dashboard
// so every surface that aggregates counts stays consistent after a mutation.

// List of archived emails (isArchived=true), ordered by updatedAt desc.
export function useArchivedEmails() {
  return useQuery({
    queryKey: qk.archived(),
    queryFn: () => api.archivedEmails.list(),
    placeholderData: (prev) => prev,
  })
}

// Restore an archived email back to the inbox (clears isArchived).
export function useRestoreEmail() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (id: string) => api.emails.restore(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: qk.email(id) })
      qc.invalidateQueries({ queryKey: ['emails'] })
      qc.invalidateQueries({ queryKey: qk.archived() })
      qc.invalidateQueries({ queryKey: qk.dashboard() })
      toast({ title: 'Email restored to inbox' })
    },
  })
}

// Permanently delete an email (HARD delete — irreversible). The api-client
// supplies { confirm: true } automatically; the route rejects anything else.
export function usePermanentDeleteEmail() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (id: string) => api.emails.permanentDelete(id),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: qk.email(id) })
      qc.invalidateQueries({ queryKey: ['emails'] })
      qc.invalidateQueries({ queryKey: qk.archived() })
      qc.invalidateQueries({ queryKey: qk.dashboard() })
      qc.invalidateQueries({ queryKey: qk.notifications('all') })
      qc.invalidateQueries({ queryKey: qk.deadlines() })
      qc.invalidateQueries({ queryKey: qk.actionItems() })
      toast({ title: 'Email permanently deleted' })
    },
  })
}

// ---------- Drafts / Sent / Spam (mailbox bucket views) ----------
// Three thin hooks that reuse the unified useEmails machinery by passing a
// `filter` param. The bucket param is forwarded to the api-client, which adds
// it as a URLSearchParams entry; the GET /api/emails handler maps each value
// to the appropriate Prisma where clause (isDraft / isSent / isSpam = true,
// isArchived = false). Each hook lives next to useEmails so call sites read
// consistently with the rest of the mailbox code.
export function useDrafts() {
  return useEmails({ filter: 'drafts' })
}
export function useSentEmails() {
  return useEmails({ filter: 'sent' })
}
export function useSpamEmails() {
  return useEmails({ filter: 'spam' })
}

// ---------- Categories ----------
export function useCategories() {
  return useQuery({ queryKey: qk.categories(), queryFn: api.categories.list })
}
export function useCreateCategory() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: api.categories.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.categories() })
      toast({ title: 'Section created' })
    },
  })
}
export function useDeleteCategory() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: api.categories.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.categories() })
      toast({ title: 'Section deleted' })
    },
  })
}

// ---------- Senders ----------
export function useSenders(q?: string) {
  return useQuery({ queryKey: qk.senders(q), queryFn: () => api.senders.list(q) })
}
export function useSender(id: string | null) {
  return useQuery({
    queryKey: id ? qk.sender(id) : ['senders', 'detail', 'none'],
    queryFn: () => api.senders.get(id!),
    enabled: !!id,
  })
}

// ---------- Rules ----------
export function useRules() {
  return useQuery({ queryKey: qk.rules(), queryFn: api.rules.list })
}
export function useCreateRule() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: api.rules.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.rules() })
      toast({ title: 'Rule created' })
    },
  })
}
export function useUpdateRule() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ id, ...data }: Parameters<typeof api.rules.update>[1] & { id: string }) =>
      api.rules.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.rules() })
      toast({ title: 'Rule updated' })
    },
  })
}
export function useDeleteRule() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: api.rules.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.rules() })
      toast({ title: 'Rule deleted' })
    },
  })
}

// ---------- Dashboard ----------
export function useDashboard() {
  return useQuery({ queryKey: qk.dashboard(), queryFn: api.dashboard })
}

// ---------- Notifications ----------
export function useNotifications(filter: 'all' | 'unread' | 'important' = 'all') {
  return useQuery({ queryKey: qk.notifications(filter), queryFn: () => api.notifications.list(filter) })
}
export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.notifications.markRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.notifications.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
export function useDeleteNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.notifications.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
export function useTestNotification() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: api.notifications.test,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: qk.notifications('all') })
      qc.invalidateQueries({ queryKey: qk.dashboard() })
      toast({ title: 'Test notification sent — check the Notifications view' })
    },
    onError: () => {
      toast({ title: 'Failed to send test notification', variant: 'destructive' })
    },
  })
}

// ---------- Notification preferences (per-category) ----------
export type NotificationPrefChannel = 'in_app' | 'web' | 'push'
export interface NotificationPrefsData {
  channels: {
    channel: NotificationPrefChannel
    preferences: { categoryId: string | '__global__'; enabled: boolean }[]
  }[]
}
export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => api.notificationPreferences.list() as Promise<NotificationPrefsData>,
    placeholderData: (prev) => prev,
  })
}
export function useUpdateNotificationPreference() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: api.notificationPreferences.update,
    // Optimistic update so the Switch animates instantly — the refetched
    // data on settle reconciles any drift.
    onMutate: async ({ channel, categoryId, enabled }) => {
      await qc.cancelQueries({ queryKey: ['notification-preferences'] })
      const prev = qc.getQueryData<NotificationPrefsData>(['notification-preferences'])
      const key = categoryId ?? '__global__'
      if (prev) {
        const next: NotificationPrefsData = {
          ...prev,
          channels: prev.channels.map((c) =>
            c.channel === channel
              ? {
                  ...c,
                  preferences: c.preferences.map((p) =>
                    p.categoryId === key ? { ...p, enabled } : p,
                  ),
                }
              : c,
          ),
        }
        qc.setQueryData<NotificationPrefsData>(['notification-preferences'], next)
      }
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData<NotificationPrefsData>(['notification-preferences'], ctx.prev)
      }
      toast({ title: 'Failed to update preference', variant: 'destructive' })
    },
    onSuccess: () => {
      toast({ title: 'Notification preference updated' })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notification-preferences'] })
    },
  })
}

// ---------- Deadlines / Action items ----------
export function useDeadlines(status?: 'open' | 'done' | 'missed' | 'all') {
  return useQuery({ queryKey: [...qk.deadlines(), status ?? 'all'], queryFn: () => api.deadlines(status) })
}
export function useActionItems() {
  return useQuery({ queryKey: qk.actionItems(), queryFn: api.actionItems })
}
export function useUpdateDeadline() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'open' | 'done' | 'missed' }) =>
      fetch(`/api/deadlines/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.deadlines() })
      qc.invalidateQueries({ queryKey: qk.dashboard() })
      toast({ title: 'Deadline updated' })
    },
  })
}
export function useDeleteDeadline() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/deadlines/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.deadlines() })
      qc.invalidateQueries({ queryKey: qk.dashboard() })
      toast({ title: 'Deadline removed' })
    },
  })
}
export function useUpdateActionItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'open' | 'done' }) =>
      fetch(`/api/action-items/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.actionItems() })
      qc.invalidateQueries({ queryKey: qk.dashboard() })
    },
  })
}

// ---------- Search ----------
export function useSearch(filters: SearchFilters | null) {
  return useQuery({
    queryKey: filters ? qk.search(filters) : ['search', 'none'],
    queryFn: () => api.search.structured(filters!),
    enabled: !!filters,
  })
}
export function useNaturalLanguageSearch() {
  return useMutation({ mutationFn: api.search.naturalLanguage })
}

// ---------- Assistant ----------
export function useConversations(opts?: { includeArchived?: boolean }) {
  return useQuery({
    queryKey: qk.assistantConversations(),
    queryFn: () => api.assistant.conversations(opts),
  })
}
export function useConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: conversationId ? qk.assistantMessages(conversationId) : ['assistant', 'messages', 'none'],
    queryFn: () => api.assistant.messages(conversationId!),
    enabled: !!conversationId,
  })
}
export function useConversationActions(conversationId: string | null) {
  return useQuery({
    queryKey: conversationId ? qk.assistantActions(conversationId) : ['assistant', 'actions', 'none'],
    queryFn: () => api.assistant.actions(conversationId!),
    enabled: !!conversationId,
  })
}
export function useSendMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, content, mode, confirmedActionId, model }: { conversationId: string; content: string; mode?: AssistantMode; confirmedActionId?: string; model?: string }) =>
      api.assistant.sendMessage(conversationId, { content, mode, ...(confirmedActionId ? { confirmedActionId } : {}), ...(model ? { model } : {}) }),
    onSuccess: (_d, { conversationId }) => {
      qc.invalidateQueries({ queryKey: qk.assistantMessages(conversationId) })
      qc.invalidateQueries({ queryKey: qk.assistantActions(conversationId) })
      qc.invalidateQueries({ queryKey: qk.assistantConversations() })
      qc.invalidateQueries({ queryKey: ['emails'] })
      qc.invalidateQueries({ queryKey: qk.dashboard() })
    },
  })
}
export function useRevertAction() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: api.assistant.revert,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assistant'] })
      qc.invalidateQueries({ queryKey: ['emails'] })
      toast({ title: 'Action reverted' })
    },
  })
}
export function useCreateConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.assistant.createConversation,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.assistantConversations() }),
  })
}
// Open the printable/export view for a conversation in a new tab.
// Returns a mutation that triggers `window.open` (client-only). Use it for the
// "Export" button — the actual printable HTML is rendered server-side by
// GET /api/assistant/conversations/[id]/export.
export function useExportConversation() {
  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (typeof window === 'undefined') return false
      window.open(
        `/api/assistant/conversations/${conversationId}/export`,
        '_blank',
        'noopener',
      )
      return true
    },
  })
}

// PATCH { title?, archived? } — rename and/or (un)archive a conversation.
// Toasts a contextual message based on which field changed (title vs
// archived). Invalidates the conversation list cache so the rail re-renders.
export function useUpdateAssistantConversation() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ id, title, archived }: { id: string; title?: string; archived?: boolean }) =>
      api.assistant.updateConversation(id, { ...(title !== undefined ? { title } : {}), ...(archived !== undefined ? { archived } : {}) }),
    onSuccess: (_d, { title, archived }) => {
      qc.invalidateQueries({ queryKey: qk.assistantConversations() })
      // Prefer the more-specific toast when both fields were supplied.
      if (archived !== undefined) {
        toast({ title: archived ? 'Conversation archived' : 'Conversation unarchived' })
      } else if (title !== undefined) {
        toast({ title: 'Conversation renamed' })
      }
    },
  })
}

// HARD-DELETE a conversation + cascade. Toasts "Conversation deleted".
export function useDeleteConversation() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (id: string) => api.assistant.deleteConversation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.assistantConversations() })
      qc.invalidateQueries({ queryKey: ['assistant'] })
      toast({ title: 'Conversation deleted' })
    },
  })
}

// Convenience wrapper around useUpdateConversation for the archive/unarchive
// toggle. Same invalidation + toast behaviour, but with a narrower
// `{ id, archived }` signature so call sites (the context menu) stay clean.
export function useArchiveConversation() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api.assistant.updateConversation(id, { archived }),
    onSuccess: (_d, { archived }) => {
      qc.invalidateQueries({ queryKey: qk.assistantConversations() })
      toast({ title: archived ? 'Conversation archived' : 'Conversation unarchived' })
    },
  })
}

// ---------- Compose ----------
export function useRecipients(q: string) {
  return useQuery({
    queryKey: ['recipients', q],
    queryFn: () => api.compose.recipients(q),
    enabled: q.length > 1,
  })
}
export function useSendEmail() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (data: { to: Recipient[]; cc?: Recipient[]; subject?: string; body?: string; confirm?: boolean }) =>
      api.compose.send({ accountId: '', ...data }),
    onSuccess: (data) => {
      if (data.ok) toast({ title: 'Email sent' })
      qc.invalidateQueries({ queryKey: ['emails'] })
    },
  })
}
export function useSaveDraft() {
  const { toast } = useToast()
  return useMutation({
    mutationFn: (data: { to: Recipient[]; cc?: Recipient[]; subject?: string; body?: string }) =>
      api.compose.saveDraft({ accountId: '', ...data }),
    onSuccess: () => toast({ title: 'Draft saved' }),
  })
}

// ---------- Bulk email actions ----------
// Multi-select bulk operations on the inbox list. Posts to /api/emails/bulk
// which enforces per-account ownership and writes a single summarizing audit
// event. On success: invalidates the email list + dashboard (and notifications,
// since read/unread state changes affect notification badges) and surfaces a
// success toast. The hook itself does NOT clear the selection — the caller
// (InboxView) is responsible for clearing `selectedIds` after a successful op
// so the UI can optimistically dismiss the bulk-action bar.
export type BulkEmailAction =
  | 'read'
  | 'unread'
  | 'star'
  | 'unstar'
  | 'important'
  | 'unimportant'
  | 'archive'
  | 'delete'

export function useBulkEmailAction() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: BulkEmailAction }) =>
      fetch('/api/emails/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action }),
      }).then((r) => r.json() as Promise<{ ok: boolean; affected: number }>),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['emails'] })
      qc.invalidateQueries({ queryKey: qk.dashboard() })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      const n = data.affected ?? 0
      toast({
        title: n === 1 ? '1 email updated' : `${n} emails updated`,
      })
    },
  })
}

// ---------- Saved Searches (filter presets) ----------
// Saved searches are account-scoped persisted filter presets. The list is
// fetched once and cached under qk.savedSearches(); create/delete mutations
// invalidate that key so the panel re-renders with the new set immediately.
export function useSavedSearches() {
  return useQuery({
    queryKey: qk.savedSearches(),
    queryFn: api.savedSearches.list,
  })
}
export function useCreateSavedSearch() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (data: { name: string; filters: SearchFilters }) =>
      api.savedSearches.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.savedSearches() })
      toast({ title: 'Search saved' })
    },
    onError: () => {
      toast({ title: 'Failed to save search', variant: 'destructive' })
    },
  })
}
export function useDeleteSavedSearch() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (id: string) => api.savedSearches.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.savedSearches() })
      toast({ title: 'Search removed' })
    },
    onError: () => {
      toast({ title: 'Failed to remove search', variant: 'destructive' })
    },
  })
}

// ---------- Weekly digest ----------
// On-demand AI weekly digest. POSTs to /api/assistant/digest which gathers
// real 7-day mailbox stats and synthesizes a structured digest via the LLM
// (with a deterministic fallback if the LLM call fails). The digest is NOT
// persisted — every call regenerates it against the latest state so the user
// always sees fresh data. Errors surface a destructive toast; the calling
// component reads mutation.isPending for the loading state and mutation.data
// for the digest payload.
export function useWeeklyDigest() {
  const { toast } = useToast()
  return useMutation({
    mutationFn: async (): Promise<WeeklyDigest> => {
      const res = await fetch('/api/assistant/digest', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const msg = body && typeof body === 'object' && 'error' in body
          ? String((body as { error: string }).error)
          : `Failed to generate digest (${res.status})`
        throw new Error(msg)
      }
      return (await res.json()) as WeeklyDigest
    },
    onError: () => {
      toast({ title: 'Failed to generate digest', variant: 'destructive' })
    },
  })
}

export type { SavedSearch }

// ---------- Smart Replies ----------
// On-demand AI smart reply suggestions for a single email. POSTs to
// /api/emails/[id]/smart-replies which loads the email account-scoped, builds
// a prompt asking the LLM for 3 reply options (formal / brief / clarifying),
// and parses the model's JSON. On any failure the route returns a
// deterministic fallback, so the mutation resolves successfully either way.
// The result is NOT cached/persisted — every call regenerates against the
// latest email content. Errors surface a destructive toast; the calling
// component reads mutation.isPending for the loading state and mutation.data
// for the replies payload.
export function useSmartReplies() {
  const { toast } = useToast()
  return useMutation({
    mutationFn: async (emailId: string): Promise<SmartRepliesResult> => {
      const res = await fetch(`/api/emails/${emailId}/smart-replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const msg =
          body && typeof body === 'object' && 'error' in body
            ? String((body as { error: string }).error)
            : `Failed to generate smart replies (${res.status})`
        throw new Error(msg)
      }
      return (await res.json()) as SmartRepliesResult
    },
    onError: () => {
      toast({ title: 'Failed to generate smart replies', variant: 'destructive' })
    },
  })
}

// ---------- Email Templates (compose presets) ----------
// Account-scoped email templates persisted so the user can reuse common
// replies/announcements. The list is fetched once per category (default
// 'all') and cached under qk.templates(category). Mutations invalidate the
// whole 'templates' family (any category key) so the panel always reflects
// the latest set after a create/update/delete.
export function useTemplates(category?: EmailTemplateCategory) {
  return useQuery({
    queryKey: qk.templates(category),
    queryFn: async () => {
      const qs = category ? `?category=${encodeURIComponent(category)}` : ''
      const res = await fetch(`/api/templates${qs}`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const msg =
          body && typeof body === 'object' && 'error' in body
            ? String((body as { error: string }).error)
            : `Failed to load templates (${res.status})`
        throw new Error(msg)
      }
      return (await res.json()) as EmailTemplate[]
    },
  })
}

export type TemplateInput = {
  name: string
  subject?: string
  body?: string
  category?: EmailTemplateCategory
}

export function useCreateTemplate() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: async (data: TemplateInput): Promise<EmailTemplate> => {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const msg =
          body && typeof body === 'object' && 'error' in body
            ? String((body as { error: string }).error)
            : `Failed to save template (${res.status})`
        throw new Error(msg)
      }
      return (await res.json()) as EmailTemplate
    },
    onSuccess: () => {
      // Invalidate every category variant of the templates key.
      qc.invalidateQueries({ queryKey: ['templates'] })
      toast({ title: 'Template saved' })
    },
    onError: () => {
      toast({ title: 'Failed to save template', variant: 'destructive' })
    },
  })
}

export function useUpdateTemplate() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: TemplateInput & { id: string }): Promise<EmailTemplate> => {
      const res = await fetch(`/api/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const msg =
          body && typeof body === 'object' && 'error' in body
            ? String((body as { error: string }).error)
            : `Failed to update template (${res.status})`
        throw new Error(msg)
      }
      return (await res.json()) as EmailTemplate
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      toast({ title: 'Template updated' })
    },
    onError: () => {
      toast({ title: 'Failed to update template', variant: 'destructive' })
    },
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: async (id: string): Promise<{ ok: boolean }> => {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const msg =
          body && typeof body === 'object' && 'error' in body
            ? String((body as { error: string }).error)
            : `Failed to delete template (${res.status})`
        throw new Error(msg)
      }
      return (await res.json()) as { ok: boolean }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      toast({ title: 'Template deleted' })
    },
    onError: () => {
      toast({ title: 'Failed to delete template', variant: 'destructive' })
    },
  })
}

export type { EmailTemplate, EmailTemplateCategory }

// ---------- Audit Events (account activity log) ----------
// useInfiniteQuery drives the Audit Log timeline. Each page fetches one
// cursor-paginated batch from /api/audit-events; the timeline component
// concatenates page.items and exposes a "Load more" button as long as
// hasNextPage is true. The query key includes the filter object so changing
// the event-type / surface / search input resets to page 1 automatically.
export interface AuditEventFilters {
  type?: string
  surface?: AuditSourceSurface
  limit?: number
}

export function useAuditEvents(filters: AuditEventFilters = {}) {
  return useInfiniteQuery({
    queryKey: qk.auditEvents(filters),
    queryFn: ({ pageParam }) => api.auditEvents.list({ ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

// ---------- Conversations ----------
export function useEmailConversations(params: { status?: string; followUp?: string } = {}) {
  return useQuery({
    queryKey: ['conversations', 'list', params],
    queryFn: () => api.conversations.list(params),
  })
}
export function useEmailConversationDetail(id: string | null) {
  return useQuery({
    queryKey: ['conversations', 'detail', id],
    queryFn: () => api.conversations.get(id!),
    enabled: !!id,
  })
}
export function useEmailConversation(emailId: string | null) {
  return useQuery({
    queryKey: ['conversations', 'for-email', emailId],
    queryFn: () => api.conversations.forEmail(emailId!),
    enabled: !!emailId,
  })
}
export function useUpdateEmailConversation() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<{ status: string; followUpState: string; importance: string }>) =>
      api.conversations.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] })
      toast({ title: 'Conversation updated' })
    },
  })
}

// ---------- Scan & Sync Control Plane (Task 17) ----------
// All hooks hit the relative Next.js API routes the backend task exposes
// (POST /api/scans, GET /api/scans, GET /api/scans/[id], …). The TanStack
// cache is namespaced under `['scan', …]` / `['sync', …]` so invalidations
// stay scoped. The progress card polls the active job every 3s via the
// `refetchInterval` option on `useScanJob`.

async function scanReq<T>(path: string, init?: RequestInit): Promise<T> {
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
    const msg =
      typeof data === 'object' && data && 'error' in data
        ? String((data as { error: string }).error)
        : `Request failed (${res.status})`
    throw new Error(msg)
  }
  return data as T
}

export function useScanJobs() {
  return useQuery<ScanJobDTO[]>({
    queryKey: ['scan', 'jobs'],
    queryFn: () => scanReq<ScanJobDTO[]>('/api/scans'),
  })
}

export function useScanJob(id: string | null, poll = false) {
  return useQuery<ScanJobDTO>({
    queryKey: ['scan', 'job', id],
    queryFn: () => scanReq<ScanJobDTO>(`/api/scans/${id}`),
    enabled: !!id,
    refetchInterval: poll ? 3000 : false,
  })
}

export function useCreateScan() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    // Backend POST /api/scans expects a flat ScanConfig body (not wrapped in
    // `{ config }`) — see src/app/api/scans/route.ts.
    mutationFn: (config: ScanConfig) =>
      scanReq<ScanJobDTO>('/api/scans', { method: 'POST', body: JSON.stringify(config) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scan', 'jobs'] })
      qc.invalidateQueries({ queryKey: ['sync', 'status'] })
    },
    onError: (e: unknown) =>
      toast({
        title: 'Scan failed to start',
        description: e instanceof Error ? e.message : 'Try again in a moment',
        variant: 'destructive',
      }),
  })
}

export function useCancelScan() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (id: string) =>
      scanReq<{ ok: boolean }>(`/api/scans/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scan', 'jobs'] })
      qc.invalidateQueries({ queryKey: ['sync', 'status'] })
      toast({ title: 'Scan cancelled' })
    },
  })
}

export function useRetryScan() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (id: string) =>
      scanReq<ScanJobDTO>(`/api/scans/${id}/retry`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scan', 'jobs'] })
      toast({ title: 'Scan queued for retry' })
    },
  })
}

export function useScanConfigurations() {
  return useQuery<ScanConfigurationDTO[]>({
    queryKey: ['scan', 'configurations'],
    queryFn: () => scanReq<ScanConfigurationDTO[]>('/api/scan-configurations'),
  })
}

export function useCreateScanConfiguration() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (payload: { name: string; description?: string; config: ScanConfig }) =>
      scanReq<ScanConfigurationDTO>('/api/scan-configurations', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scan', 'configurations'] })
      toast({ title: 'Configuration saved' })
    },
  })
}

export function useDeleteScanConfiguration() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (id: string) =>
      scanReq<{ ok: boolean }>(`/api/scan-configurations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scan', 'configurations'] })
      toast({ title: 'Configuration deleted' })
    },
  })
}

export function useRunScanConfiguration() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (id: string) =>
      scanReq<ScanJobDTO>(`/api/scan-configurations/${id}/run`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scan', 'jobs'] })
      qc.invalidateQueries({ queryKey: ['sync', 'status'] })
      toast({ title: 'Saved scan started' })
    },
  })
}

export function useSyncStatus(poll = false) {
  return useQuery<SyncStatusDTO>({
    queryKey: ['sync', 'status'],
    queryFn: () => scanReq<SyncStatusDTO>('/api/sync/status'),
    refetchInterval: poll ? 5000 : false,
  })
}

export function useRunSync() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: () => scanReq<{ ok: boolean }>('/api/sync/run', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sync', 'status'] })
      qc.invalidateQueries({ queryKey: ['scan', 'jobs'] })
      toast({ title: 'Sync started' })
    },
  })
}

export function usePauseSync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => scanReq<{ ok: boolean }>('/api/sync/pause', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sync', 'status'] }),
  })
}

export function useResumeSync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => scanReq<{ ok: boolean }>('/api/sync/resume', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sync', 'status'] }),
  })
}

/** Read the user-level global auto-sync interval. */
export function useGlobalSyncInterval() {
  return useQuery({
    queryKey: ['user', 'sync-interval'],
    queryFn: () => scanReq<{ autoSyncInterval: string }>('/api/user/sync-interval'),
    staleTime: 60_000,
  })
}

/** Update the user-level global auto-sync interval. */
export function useUpdateSyncInterval() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ autoSyncInterval }: { autoSyncInterval: string; accountId?: string }) =>
      scanReq<{ ok: boolean; autoSyncInterval: string }>('/api/user/sync-interval', {
        method: 'PATCH',
        body: JSON.stringify({ autoSyncInterval }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'sync-interval'] })
      qc.invalidateQueries({ queryKey: qk.accounts })
    },
  })
}
