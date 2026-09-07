'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/common/states'
import { useAuditEvents, type AuditEventFilters } from '@/hooks/use-queries'
import { AuditEventRow } from './audit-event-row'
import type { AuditEventDTO } from '@/lib/types'

interface Props {
  filters: AuditEventFilters & { search?: string }
}

function matchesSearch(event: AuditEventDTO, q: string): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  if (event.eventType.toLowerCase().includes(needle)) return true
  if (event.targetType && event.targetType.toLowerCase().includes(needle)) return true
  return false
}

export function AuditLogTimeline({ filters }: Props) {
  const { search = '', ...apiFilters } = filters
  const { data, isLoading, isError, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useAuditEvents(apiFilters)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
            <Skeleton className="size-8 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load audit log"
        description={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
      />
    )
  }

  const allItems = data?.pages.flatMap((p) => p.items) ?? []
  const total = data?.pages[0]?.total ?? 0
  const filtered = allItems.filter((e) => matchesSearch(e, search))

  if (filtered.length === 0) {
    return (
      <EmptyState
        title={search ? 'No matching events' : 'No audit events yet'}
        description={
          search
            ? 'Try a different search term or clear your filters.'
            : "Actions you take will appear here. Try starring an email or creating a rule."
        }
      />
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {filtered.length} shown{hasNextPage ? ` of ${total}` : ''} · {total} total
      </p>
      <ol className="relative space-y-2 border-l border-border/60 pl-4" role="list">
        {filtered.map((event) => (
          <li key={event.id} role="listitem">
            <AuditEventRow event={event} />
          </li>
        ))}
      </ol>
      {hasNextPage ? (
        <div className="pt-1">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading…
              </>
            ) : (
              'Load more'
            )}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
