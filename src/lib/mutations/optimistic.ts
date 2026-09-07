'use client'

// Shared optimistic-mutation factory (architecture directive section 9).
//
// Builds a TanStack Query `useMutation` hook that:
//   1. onMutate — cancels in-flight queries for every prefix, snapshots the
//      current cache data, applies the optimistic change via setQueriesData,
//      and returns the snapshot for rollback.
//   2. onError — restores each snapshot so the UI reverts to its prior state.
//   3. onSuccess — invalidates every prefix (+ any extra keys) so the server
//      becomes the source of truth again, then fires an optional toast.
//
// The factory is generic over the mutation input (`TInput`) and the cached
// item shape (`TCacheItem`). It handles BOTH cache shapes used in this app:
//   • list caches — `{ items: TCacheItem[]; ... }` (applyOptimistic per item)
//   • detail caches — a single `TCacheItem` object (applyOptimistic directly)
//
// `queryKeys` are treated as PREFIX filters (TanStack default). Pass `['emails']`
// to match every `['emails', 'list', *]` and `['emails', 'detail', *]` cache.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'

export interface OptimisticMutationConfig<TInput, TCacheItem> {
  mutationFn: (input: TInput) => Promise<unknown>
  /** Query-key prefixes to optimistically update + invalidate. */
  queryKeys: unknown[][]
  /**
   * Locate the cached item to update. Called once per candidate item inside a
   * list cache, or once on a detail cache. Return `undefined` to skip.
   */
  findItem: (cache: unknown, input: TInput) => TCacheItem | undefined
  /** Return a NEW item with the optimistic change applied (immutable). */
  applyOptimistic: (item: TCacheItem, input: TInput) => TCacheItem
  /** Additional keys to invalidate on success (e.g. `['dashboard']`). */
  invalidateExtra?: unknown[][]
  onSuccessToast?: (input: TInput) => { title: string; description?: string }
  onErrorToast?: (input: TInput, error: Error) => { title: string; description?: string }
}

interface RollbackCtx {
  // Per-prefix snapshots: [originalKey, originalData] pairs. Keys are stored
  // as `readonly unknown[]` because TanStack's QueryKey is readonly; we pass
  // them back to setQueryData which accepts the readonly form.
  snapshots: Array<{
    prefix: unknown[]
    entries: Array<[readonly unknown[], unknown]>
  }>
}

// Apply the optimistic change to ANY cache shape (list `{ items: [] }` or
// detail object). Returns the same reference when nothing matched so React
// Query skips the cache write.
function applyToCache<TInput, TCacheItem>(
  cache: unknown,
  input: TInput,
  config: OptimisticMutationConfig<TInput, TCacheItem>,
): unknown {
  if (!cache || typeof cache !== 'object') return cache
  // List shape — `{ items: TCacheItem[]; ... }`.
  if (Array.isArray((cache as { items?: unknown }).items)) {
    const list = cache as { items: TCacheItem[]; [k: string]: unknown }
    let touched = false
    const nextItems = list.items.map((it) => {
      const found = config.findItem(it, input)
      if (!found) return it
      touched = true
      return config.applyOptimistic(found, input)
    })
    return touched ? { ...list, items: nextItems } : cache
  }
  // Detail shape — try findItem directly on the cache object.
  const found = config.findItem(cache, input)
  if (!found) return cache
  return config.applyOptimistic(found, input)
}

export function createOptimisticMutation<TInput, TCacheItem>(
  config: OptimisticMutationConfig<TInput, TCacheItem>,
) {
  return function useOptimisticMutation() {
    const qc = useQueryClient()
    const { toast } = useToast()
    return useMutation<unknown, Error, TInput, RollbackCtx>({
      mutationFn: config.mutationFn,
      onMutate: async (input) => {
        const snapshots: RollbackCtx['snapshots'] = []
        for (const prefix of config.queryKeys) {
          // Cancel in-flight refetches so they don't overwrite our optimistic write.
          await qc.cancelQueries({ queryKey: prefix })
          const entries = qc.getQueriesData({ queryKey: prefix })
          const snap: Array<[readonly unknown[], unknown]> = entries.map(([k, v]) => [k, v])
          snapshots.push({ prefix, entries: snap })
          qc.setQueriesData({ queryKey: prefix }, (old) => applyToCache(old, input, config))
        }
        return { snapshots }
      },
      onError: (error, input, context) => {
        // Rollback: restore every snapshotted key to its pre-mutation value.
        if (context?.snapshots) {
          for (const { entries } of context.snapshots) {
            for (const [key, value] of entries) qc.setQueryData(key, value)
          }
        }
        if (config.onErrorToast) {
          const t = config.onErrorToast(input, error)
          toast({ title: t.title, description: t.description, variant: 'destructive' })
        }
      },
      onSuccess: (_data, input) => {
        for (const prefix of config.queryKeys) qc.invalidateQueries({ queryKey: prefix })
        for (const extra of config.invalidateExtra ?? []) qc.invalidateQueries({ queryKey: extra })
        if (config.onSuccessToast) {
          const t = config.onSuccessToast(input)
          toast({ title: t.title, description: t.description })
        }
      },
    })
  }
}
