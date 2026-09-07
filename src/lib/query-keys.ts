// TanStack Query key factory — stable, namespaced keys per the spec's query strategy.

export const qk = {
  accounts: ['accounts'] as const,
  emails: (params: Record<string, unknown> = {}) => ['emails', 'list', params] as const,
  email: (id: string) => ['emails', 'detail', id] as const,
  // Archived emails — separate namespace so restore/permanent-delete can
  // invalidate the archive list without also blasting the inbox list cache.
  archived: () => ['archived', 'list'] as const,
  thread: (id: string) => ['threads', id] as const,
  categories: () => ['categories'] as const,
  senders: (q?: string) => ['senders', q ?? 'all'] as const,
  sender: (id: string) => ['senders', 'detail', id] as const,
  rules: () => ['rules'] as const,
  dashboard: () => ['dashboard'] as const,
  notifications: (filter: string) => ['notifications', filter] as const,
  deadlines: () => ['deadlines'] as const,
  actionItems: () => ['action-items'] as const,
  search: (filters: unknown) => ['search', filters] as const,
  assistantConversations: () => ['assistant', 'conversations'] as const,
  assistantMessages: (id: string) => ['assistant', 'messages', id] as const,
  assistantActions: (id: string) => ['assistant', 'actions', id] as const,
  savedSearches: () => ['saved-searches'] as const,
  templates: (category?: string) => ['templates', category ?? 'all'] as const,
  auditEvents: (filters: unknown) => ['audit-events', filters] as const,
}
