'use client'

import { useSearch, useMarkRead, useStarEmail } from '@/hooks/use-queries'
import { EmailListSkeleton } from '@/components/common/skeletons'
import { NoSearchResults, ErrorState, EmptyState } from '@/components/common/states'
import { colorClass } from '@/lib/category-meta'
import { cn } from '@/lib/utils'
import { formatRelative } from '@/lib/format'
import type { SearchFilters, EmailListItem, CategorySummary } from '@/lib/types'
import { PaneScroll } from '@/components/ui/pane-scroll'
import { Badge } from '@/components/ui/badge'
import { filtersToChips } from './search-helpers'
import { Search, Star, Paperclip, Mail, MailOpen } from 'lucide-react'

export function SearchResultsList({
  filters,
  selectedId,
  onSelect,
  categories,
}: {
  filters: SearchFilters | null
  selectedId: string | null
  onSelect: (id: string) => void
  categories: CategorySummary[] | undefined
}) {
  const { data, isLoading, error, refetch } = useSearch(filters)

  // No search run yet
  if (!filters) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={Search}
          title="Search your mailbox"
          description="Use structured filters or describe what you need in natural language. Results appear here."
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-2">
        <EmailListSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-3">
        <ErrorState
          title="Search failed"
          description={error.message}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const chips = filtersToChips(filters, categories)

  return (
    <div className="flex h-full flex-col">
      {/* Summary header: result count + parsed filter chips */}
      <div className="shrink-0 border-b px-3 py-2">
        <p className="text-xs font-medium">
          {total} {total === 1 ? 'result' : 'results'}
        </p>
        {chips.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {chips.map((chip, i) => (
              <Badge
                key={i}
                variant="outline"
                className={cn(
                  'h-5 gap-1 px-1.5 text-[10px] font-medium',
                  chip.color && cn(colorClass(chip.color), 'cat-text cat-border-soft'),
                )}
              >
                {chip.color && (
                  <span className={cn('h-1.5 w-1.5 rounded-full cat-dot', colorClass(chip.color))} />
                )}
                {chip.label}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* List (scrollable) */}
      <PaneScroll>
        {items.length === 0 ? (
          <div className="p-3">
            <NoSearchResults query={filters.sender} />
          </div>
        ) : (
          <div className="space-y-0.5 p-2 pb-20 md:pb-2">
            {items.map((email) => (
              <SearchResultRow
                key={email.id}
                email={email}
                selected={email.id === selectedId}
                onSelect={onSelect}
              />
            ))}
            {data?.nextCursor && (
              <p className="py-3 text-center text-xs text-muted-foreground">
                Showing {items.length} of {total} · refine filters for more
              </p>
            )}
          </div>
        )}
      </PaneScroll>
    </div>
  )
}

/**
 * Compact search-result row. Mirrors the Inbox EmailRow UI (sender, subject,
 * snippet, category chip, time, attachment/star icons) but is driven by the
 * search results data rather than useEmails. Selecting marks-read for parity.
 */
function SearchResultRow({
  email,
  selected,
  onSelect,
}: {
  email: EmailListItem
  selected: boolean
  onSelect: (id: string) => void
}) {
  const markRead = useMarkRead()
  const star = useStarEmail()
  const cat = email.categories[0]
  const catColorClass = cat ? colorClass(cat.color) : 'cat-slate'

  const handleClick = () => {
    onSelect(email.id)
    if (!email.flags.isRead) markRead.mutate({ id: email.id, read: true })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'group relative flex w-full items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors',
        selected ? 'border-border bg-accent/60' : 'hover:bg-accent/40',
        !email.flags.isRead && 'bg-accent/20',
      )}
    >
      {/* Unread dot */}
      <span
        className={cn(
          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
          email.flags.isRead ? 'bg-transparent' : 'bg-primary',
        )}
      />

      {/* Category-tinted avatar */}
      <div
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold cat-bg-soft cat-text',
          catColorClass,
        )}
      >
        {(email.fromName ?? email.fromEmail).charAt(0).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              'break-words text-sm',
              email.flags.isRead ? 'font-medium' : 'font-semibold',
            )}
          >
            {email.fromName ?? email.fromEmail.split('@')[0]}
          </p>
          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
            {formatRelative(email.receivedAt)}
          </span>
        </div>
        <p
          className={cn(
            'break-words text-sm',
            email.flags.isRead ? 'text-muted-foreground' : 'font-medium text-foreground',
          )}
        >
          {email.subject ?? '(no subject)'}
        </p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{email.snippet}</p>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {cat && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium cat-bg-soft cat-text',
                catColorClass,
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full cat-dot', catColorClass)} />
              {cat.name}
            </span>
          )}
          {email.flags.isImportant && (
            <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
              Important
            </span>
          )}
          {email.hasAttachment && <Paperclip className="h-3 w-3 text-muted-foreground" />}
        </div>
      </div>

      {/* Star + read indicator */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            star.mutate({ id: email.id, starred: !email.flags.isStarred })
          }}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label={email.flags.isStarred ? 'Unstar email' : 'Star email'}
        >
          <Star
            className={cn('h-3.5 w-3.5', email.flags.isStarred && 'fill-warning text-warning')}
          />
        </button>
        {email.flags.isRead ? (
          <MailOpen className="h-3 w-3 text-muted-foreground/50" />
        ) : (
          <Mail className="h-3 w-3 text-primary/60" />
        )}
      </div>
    </button>
  )
}
