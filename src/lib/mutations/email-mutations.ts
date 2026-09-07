'use client'

// Email-specific optimistic mutations built on `createOptimisticMutation`.
//
// Each hook updates the matching email in EVERY cache that holds emails:
//   • `['emails']`  — covers `['emails', 'list', *]` (inbox + mailbox buckets
//                     like drafts/sent/spam/starred) AND `['emails', 'detail', id]`.
//   • `['archived']` — the Archive view's separate list cache.
//   • `['search']`   — every Search-results cache (one per filter set).
//
// On success we additionally invalidate `['dashboard']` (read/important counts)
// and `['notifications']` (read state affects notification badges), matching
// the prior non-optimistic behaviour of useMarkRead / useMarkImportant.
//
// No success toast is fired — the instant UI flip IS the feedback, per the
// existing product behaviour. A subtle destructive toast IS shown on rollback
// so the user understands why their click "didn't stick".

import { createOptimisticMutation } from '@/lib/mutations/optimistic'
import { api } from '@/lib/api-client'
import type { EmailListItem } from '@/lib/types'

// All email-bearing query-key prefixes. Passed to setQueriesData so the
// optimistic change lands in every surface simultaneously.
const EMAIL_CACHE_PREFIXES: unknown[][] = [['emails'], ['archived'], ['search']]

// Extra keys invalidated on success (after the server confirms) so derived
// aggregates recompute. Read/important affect dashboard counts; read affects
// notification badges.
const REVALIDATE_ON_READ = [['dashboard'], ['notifications']]
const REVALIDATE_ON_IMPORTANT = [['dashboard']]

// `findItem` shared by every email mutation — match by id. Works for both
// `EmailListItem` (list rows) and `EmailDetail` (which extends EmailListItem).
function findEmailById(cache: unknown, input: { id: string }): EmailListItem | undefined {
  if (!cache || typeof cache !== 'object') return undefined
  const maybe = cache as { id?: unknown }
  return maybe.id === input.id ? (cache as EmailListItem) : undefined
}

export const useOptimisticMarkRead = createOptimisticMutation<
  { id: string; read: boolean },
  EmailListItem
>({
  mutationFn: ({ id, read }) => api.emails.markRead(id, read),
  queryKeys: EMAIL_CACHE_PREFIXES,
  invalidateExtra: REVALIDATE_ON_READ,
  findItem: findEmailById,
  applyOptimistic: (item, { read }) => ({
    ...item,
    flags: { ...item.flags, isRead: read },
  }),
  onErrorToast: ({ read }) => ({
    title: read ? 'Could not mark as read' : 'Could not mark as unread',
    description: 'Reverted — please try again.',
  }),
})

export const useOptimisticStar = createOptimisticMutation<
  { id: string; starred: boolean },
  EmailListItem
>({
  mutationFn: ({ id, starred }) => api.emails.star(id, starred),
  queryKeys: EMAIL_CACHE_PREFIXES,
  findItem: findEmailById,
  applyOptimistic: (item, { starred }) => ({
    ...item,
    flags: { ...item.flags, isStarred: starred },
  }),
  onErrorToast: ({ starred }) => ({
    title: starred ? 'Could not star email' : 'Could not unstar email',
    description: 'Reverted — please try again.',
  }),
})

export const useOptimisticImportant = createOptimisticMutation<
  { id: string; important: boolean },
  EmailListItem
>({
  mutationFn: ({ id, important }) => api.emails.markImportant(id, important),
  queryKeys: EMAIL_CACHE_PREFIXES,
  invalidateExtra: REVALIDATE_ON_IMPORTANT,
  findItem: findEmailById,
  applyOptimistic: (item, { important }) => ({
    ...item,
    flags: { ...item.flags, isImportant: important },
  }),
  onErrorToast: ({ important }) => ({
    title: important ? 'Could not mark as important' : 'Could not remove important flag',
    description: 'Reverted — please try again.',
  }),
})
