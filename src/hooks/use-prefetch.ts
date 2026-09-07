'use client'

// Email + thread prefetch helpers. prefetchQuery is a no-op when the data is
// already fresh, so callers can invoke these freely from hover/select handlers
// without worrying about redundant requests or re-renders. `useQueryClient`
// returns a stable client, so the returned callbacks are safe to use inside
// event handlers and effects.

import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { qk } from '@/lib/query-keys'

// Prefetch a single email detail into the cache (1-min freshness window —
// long enough that opening the row feels instant, short enough to stay fresh).
export function usePrefetchEmail() {
  const qc = useQueryClient()
  return (emailId: string) => {
    qc.prefetchQuery({
      queryKey: qk.email(emailId),
      queryFn: () => api.emails.get(emailId),
      staleTime: 60_000,
    })
  }
}

// Prefetch a thread summary (used by the email detail's thread panel).
export function usePrefetchThread() {
  const qc = useQueryClient()
  return (threadId: string) => {
    qc.prefetchQuery({
      queryKey: qk.thread(threadId),
      queryFn: () => api.emails.thread(threadId),
      staleTime: 60_000,
    })
  }
}
