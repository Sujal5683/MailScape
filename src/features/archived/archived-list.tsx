'use client'

import { useState } from 'react'
import { useArchivedEmails, useRestoreEmail, usePermanentDeleteEmail } from '@/hooks/use-queries'
import { EmailListSkeleton } from '@/components/common/skeletons'
import { EmptyState, ErrorState } from '@/components/common/states'
import { colorClass } from '@/lib/category-meta'
import { cn } from '@/lib/utils'
import { formatRelative } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Archive, RotateCcw, Trash2, Paperclip } from 'lucide-react'
import type { EmailListItem } from '@/lib/types'
import { PermanentDeleteDialog } from './permanent-delete-dialog'

// ---------------------------------------------------------------------------
// ArchivedList — the master column of the Archive view.
//
// Renders every archived email as a row (mirrors the inbox email-list row but
// simpler — no multi-select, no star toggle). Each row carries two actions:
//   • Restore  (RotateCcw, primary-tinted)  → POST /api/emails/:id/restore
//   • Delete   (Trash2, destructive)        → opens PermanentDeleteDialog
//
// Clicking the row body selects it (opens the detail pane). The action
// buttons stop propagation so they don't also select the row.
// ---------------------------------------------------------------------------
export function ArchivedList({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { data, isLoading, error, refetch } = useArchivedEmails()

  if (isLoading) return <EmailListSkeleton />
  if (error)
    return (
      <ErrorState
        title="Couldn't load archived emails"
        description={error.message}
        onRetry={() => refetch()}
      />
    )
  if (!data || data.items.length === 0)
    return (
      <EmptyState
        icon={Archive}
        title="No archived emails"
        description="Archive emails from the inbox using the Archive action. They'll appear here, hidden from your inbox until you restore or permanently delete them."
      />
    )

  return (
    <div className="space-y-0.5">
      {data.items.map((email) => (
        <ArchivedRow
          key={email.id}
          email={email}
          selected={email.id === selectedId}
          onSelect={onSelect}
        />
      ))}
      {data.nextCursor && (
        <p className="py-3 text-center text-xs text-muted-foreground">
          Showing {data.items.length} of {data.total} archived emails
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row — owns its own restore + delete state. Restore fires immediately; delete
// opens the shared PermanentDeleteDialog. Both call the typed hooks so cache
// invalidation + toasts happen automatically.
// ---------------------------------------------------------------------------
function ArchivedRow({
  email,
  selected,
  onSelect,
}: {
  email: EmailListItem
  selected: boolean
  onSelect: (id: string) => void
}) {
  const restore = useRestoreEmail()
  const permanentDelete = usePermanentDeleteEmail()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const cat = email.categories[0]
  const catColorClass = cat ? colorClass(cat.color) : 'cat-slate'
  const senderLabel = email.fromName ?? email.fromEmail.split('@')[0]
  const subjectLabel = email.subject ?? '(no subject)'

  const handleRowClick = () => onSelect(email.id)

  const handleRestoreClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    restore.mutate(email.id)
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteOpen(true)
  }

  const confirmDelete = () => {
    permanentDelete.mutate(email.id, {
      onSettled: () => setDeleteOpen(false),
    })
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleRowClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleRowClick()
          }
        }}
        aria-pressed={selected}
        aria-label={`Open archived email from ${senderLabel} about ${subjectLabel}`}
        className={cn(
          'group relative flex w-full cursor-pointer items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
          selected ? 'border-border bg-accent/60' : 'hover:bg-accent/40',
        )}
      >
        {/* Category-tinted sender avatar */}
        <div
          className={cn(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold cat-bg-soft cat-text',
            catColorClass,
          )}
          aria-hidden
        >
          {(email.fromName ?? email.fromEmail).charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{senderLabel}</p>
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
              {formatRelative(email.receivedAt)}
            </span>
          </div>
          <p className="truncate text-sm text-foreground font-medium">{subjectLabel}</p>
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
            {email.hasAttachment && <Paperclip className="h-3 w-3 text-muted-foreground" />}
          </div>
        </div>

        {/* Row actions — stopPropagation so they don't trigger row select. */}
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary"
                onClick={handleRestoreClick}
                disabled={restore.isPending}
                aria-label={`Restore ${subjectLabel} to inbox`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Restore to inbox</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDeleteClick}
                disabled={permanentDelete.isPending}
                aria-label={`Permanently delete ${subjectLabel}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete permanently…</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <PermanentDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={confirmDelete}
        pending={permanentDelete.isPending}
        subject={email.subject}
      />
    </>
  )
}
