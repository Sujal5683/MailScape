'use client'

import { useEmails, useMarkRead, useStarEmail } from '@/hooks/use-queries'
import { usePrefetchEmail } from '@/hooks/use-prefetch'
import { EmailListSkeleton } from '@/components/common/skeletons'
import { EmptyState } from '@/components/common/states'
import { colorClass } from '@/lib/category-meta'
import { cn } from '@/lib/utils'
import { Star, Paperclip, Mail, MailOpen } from 'lucide-react'
import type { EmailListItem } from '@/lib/types'
import { formatRelative } from '@/lib/format'
import { Checkbox } from '@/components/ui/checkbox'
import { SnoozedIndicator, isActivelySnoozed } from './snoozed-indicator'

// ---------------------------------------------------------------------------
// EmailList — preserved signature + new optional multi-select props.
//
//   selectedId?: string | null        — currently open email (highlighted row)
//   onSelect: (id) => void            — open the email detail
//   filter?: EmailListFilter (see below)
//
// The `filter` prop accepts the existing object shape (categoryId/senderId/
// unreadOnly/...) AND an optional coarse `filter` string ('drafts' | 'sent' |
// 'spam' | 'starred') that maps to a single flag predicate on the server. The
// string is forwarded as a URLSearchParams entry; the GET /api/emails handler
// resolves it to the appropriate Prisma where clause. This keeps the Drafts /
// Sent / Spam views DRY — they reuse EmailList instead of duplicating a row
// renderer.
//
// New (all optional — existing callers in organized/category-detail &
// search still work unchanged):
//
//   selectMode?: boolean                — when true, show checkboxes
//   selectedIds?: Set<string>           — ids currently selected
//   onToggleSelect?: (id) => void       — toggle a single row
//   onSelectAll?: () => void             — "Select all visible" header click
//   allSelected?: boolean               — controlled check state of the header
//
// When `selectMode` is false (or undefined), the list behaves exactly as before.
// ---------------------------------------------------------------------------

// Filter shape forwarded to api.emails.list. The optional `filter` string is
// a coarse bucket selector (drafts | sent | spam | starred); see
// /api/emails/route.ts for the server-side semantics. Mutually exclusive in
// practice with the boolean *Only flags (the server applies the bucket first,
// then layers the boolean flags on top).
export interface EmailListFilter {
  categoryId?: string
  senderId?: string
  unreadOnly?: boolean
  importantOnly?: boolean
  starredOnly?: boolean
  snoozedOnly?: boolean
  includeSnoozed?: boolean
  filter?: 'drafts' | 'sent' | 'spam' | 'starred'
}

export interface EmailListProps {
  selectedId: string | null
  onSelect: (id: string) => void
  filter?: EmailListFilter
  selectMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  onSelectAll?: () => void
  allSelected?: boolean
}

export function EmailList({
  selectedId,
  onSelect,
  filter,
  selectMode = false,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  allSelected = false,
}: EmailListProps) {
  const { data, isLoading, error, refetch } = useEmails(filter ?? {})

  if (isLoading) return <EmailListSkeleton />
  if (error)
    return (
      <EmptyState
        title="Couldn't load emails"
        description={error.message}
        action={
          <button
            onClick={() => refetch()}
            className="text-primary text-sm font-medium"
          >
            Retry
          </button>
        }
      />
    )
  if (!data || data.items.length === 0)
    return (
      <EmptyState icon={Mail} title="No emails here" description="Synced emails will appear in this view." />
    )

  // indeterminate-ish behavior: header is checked when all visible rows are
  // selected, unchecked when none are. In-between → still rendered as
  // checked=false (Radix checkbox has no native indeterminate without extra
  // work); the label text clarifies the partial state.
  const visibleIds = data.items.map((e) => e.id)
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds?.has(id)).length
  const partial = selectMode && selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length

  return (
    <div className="space-y-0.5">
      {/* "Select all visible" header — only rendered in select mode */}
      {selectMode && (
        <div
          className={cn(
            'mb-1 flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/40 px-3 py-2',
          )}
        >
          <Checkbox
            checked={allSelected}
            onCheckedChange={() => onSelectAll?.()}
            aria-label="Select all visible emails"
            id="email-list-select-all"
          />
          <label
            htmlFor="email-list-select-all"
            className="cursor-pointer select-none text-xs font-medium text-muted-foreground"
          >
            {partial
              ? `Select all visible (${selectedVisibleCount}/${visibleIds.length} selected)`
              : allSelected
                ? `All ${visibleIds.length} selected`
                : `Select all ${visibleIds.length} visible`}
          </label>
        </div>
      )}

      {data.items.map((email) => (
        <EmailRow
          key={email.id}
          email={email}
          selected={email.id === selectedId}
          onSelect={onSelect}
          selectMode={selectMode}
          isSelected={selectedIds?.has(email.id) ?? false}
          onToggleSelect={onToggleSelect}
        />
      ))}
      {data.nextCursor && (
        <p className="py-3 text-center text-xs text-muted-foreground">
          Showing {data.items.length} of {data.total} · refine via search for more
        </p>
      )}
    </div>
  )
}

interface EmailRowProps {
  email: EmailListItem
  selected: boolean
  onSelect: (id: string) => void
  selectMode: boolean
  isSelected: boolean
  onToggleSelect?: (id: string) => void
}

function EmailRow({
  email,
  selected,
  onSelect,
  selectMode,
  isSelected,
  onToggleSelect,
}: EmailRowProps) {
  const markRead = useMarkRead()
  const star = useStarEmail()
  const prefetchEmail = usePrefetchEmail()
  const cat = email.categories[0]
  const catColorClass = cat ? colorClass(cat.color) : 'cat-slate'

  const handleClick = () => {
    // In select mode the row body itself still opens the detail — clicking
    // the checkbox is a separate target and stops propagation (see below).
    onSelect(email.id)
    if (!email.flags.isRead) markRead.mutate({ id: email.id, read: true })
  }

  // Accessibility: "Select email from <Sender> about <Subject>"
  const senderLabel = email.fromName ?? email.fromEmail.split('@')[0]
  const subjectLabel = email.subject ?? '(no subject)'
  const checkboxAriaLabel = `Select email from ${senderLabel} about ${subjectLabel}`

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onMouseEnter={() => prefetchEmail(email.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
      aria-pressed={selected}
      aria-label={`Open email from ${senderLabel} about ${subjectLabel}`}
      className={cn(
        'group relative flex w-full cursor-pointer items-start gap-2 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-border bg-accent/60' : 'hover:bg-accent/40',
        !email.flags.isRead && 'bg-accent/20',
        isSelected && 'border-primary/40 ring-1 ring-primary/30',
      )}
    >
      {/* Selection checkbox — rendered as a SIBLING at the start of the row
          (before the unread dot). stopPropagation on click + keydown so it
          doesn't bubble up to the row's open-detail handlers. */}
      {selectMode && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect?.(email.id)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            // Prevent Space/Enter on the checkbox from also triggering the
            // row's open-detail keydown handler (the row listens for the same
            // keys to support keyboard navigation).
            if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
          }}
          aria-label={checkboxAriaLabel}
          className="mt-1"
          tabIndex={0}
        />
      )}

      {/* Unread indicator */}
      <span
        className={cn(
          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
          email.flags.isRead ? 'bg-transparent' : 'bg-primary',
        )}
      />

      {/* Avatar / category dot */}
      <div
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold cat-bg-soft cat-text',
          catColorClass,
        )}
      >
        {(email.fromName ?? email.fromEmail).charAt(0).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p
            className={cn(
              'min-w-0 truncate text-sm',
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
            'min-w-0 truncate text-sm',
            email.flags.isRead ? 'text-muted-foreground' : 'text-foreground font-medium',
          )}
        >
          {email.subject ?? '(no subject)'}
        </p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{email.snippet}</p>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {cat && (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium cat-bg-soft cat-text',
                catColorClass,
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full cat-dot', catColorClass)} />
              {cat.name}
            </span>
          )}
          {email.flags.isImportant && (
            <span className="shrink-0 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
              Important
            </span>
          )}
          {isActivelySnoozed(email.snoozedUntil) && (
            <SnoozedIndicator snoozedUntil={email.snoozedUntil as string} />
          )}
          {email.hasAttachment && <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />}
        </div>
      </div>

      {/* Star + read icon — compact column */}
      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation()
            star.mutate({ id: email.id, starred: !email.flags.isStarred })
          }}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label={email.flags.isStarred ? 'Unstar' : 'Star'}
        >
          <Star className={cn('h-3.5 w-3.5', email.flags.isStarred && 'fill-warning text-warning')} />
        </button>
        {email.flags.isRead ? (
          <MailOpen className="h-3 w-3 text-muted-foreground/40" />
        ) : (
          <Mail className="h-3 w-3 text-primary/50" />
        )}
      </div>
    </div>
  )
}
