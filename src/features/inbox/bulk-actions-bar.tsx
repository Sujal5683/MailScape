'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import {
  Mail,
  MailOpen,
  Star,
  StarOff,
  Flag,
  FlagOff,
  Archive,
  Trash2,
  X,
  MoreVertical,
  Loader2,
} from 'lucide-react'
import type { BulkEmailAction } from '@/hooks/use-queries'

// ---------------------------------------------------------------------------
// BulkActionsBar — floating sticky bar shown at the bottom of the inbox list
// column when ≥1 email is selected.
//
//   count: number            — number of selected emails
//   onAction: (a) => void    — fires one of the 8 bulk actions
//   onClear: () => void      — clears the current selection (does NOT exit
//                              select mode — caller decides)
//   pending?: boolean        — disables all action triggers while a bulk
//                              mutation is in flight
//
// Layout: a sticky bar pinned to the bottom of the list column on desktop,
// and to the viewport bottom (above the mobile bottom-nav) on mobile. The
// bar uses backdrop-blur + border + shadow per spec.
//
// Responsive: the bar wraps cleanly. On all sizes we always show: count badge,
// the three most-used primary actions (Mark read, Star, Archive), an overflow
// dropdown (MoreVertical) for the less-common actions (Mark unread, Unstar,
// Mark important, Mark unimportant) and the destructive Delete (which opens
// an AlertDialog before firing), and a Clear-selection button. On lg screens
// the less-common primary actions also appear inline as icon buttons.
//
// Delete is SENSITIVE: a shadcn AlertDialog confirms before firing. The same
// dialog is used by the overflow-menu delete entry on mobile.
// ---------------------------------------------------------------------------

interface BulkActionsBarProps {
  count: number
  onAction: (action: BulkEmailAction) => void
  onClear: () => void
  pending?: boolean
}

// Static icon map for actions → no `const Icon = lookup(name)` pattern.
// Each entry holds the LucideIcon component reference directly (lint-safe).
const ACTION_ICON: Record<BulkEmailAction, typeof Mail> = {
  read: MailOpen,
  unread: Mail,
  star: Star,
  unstar: StarOff,
  important: Flag,
  unimportant: FlagOff,
  archive: Archive,
  delete: Trash2,
}

const ACTION_LABEL: Record<BulkEmailAction, string> = {
  read: 'Mark read',
  unread: 'Mark unread',
  star: 'Star',
  unstar: 'Unstar',
  important: 'Mark important',
  unimportant: 'Mark unimportant',
  archive: 'Archive',
  delete: 'Delete',
}

// Compact icon-only action button with a Radix tooltip for desktop hover.
// `tone` opts into destructive styling for delete-like entries.
function ActionButton({
  action,
  onAction,
  pending,
  tone = 'default',
  labelOverride,
}: {
  action: BulkEmailAction
  onAction: (a: BulkEmailAction) => void
  pending?: boolean
  tone?: 'default' | 'destructive'
  labelOverride?: string
}) {
  const Icon = ACTION_ICON[action]
  const label = labelOverride ?? ACTION_LABEL[action]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onAction(action)}
          disabled={pending}
          aria-label={label}
          className={cn(
            'h-8 w-8 shrink-0',
            tone === 'destructive' &&
              'text-destructive hover:bg-destructive/10 hover:text-destructive',
          )}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function BulkActionsBar({ count, onAction, onClear, pending = false }: BulkActionsBarProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  const fireDelete = useCallback(() => {
    setDeleteOpen(false)
    onAction('delete')
  }, [onAction])

  return (
    <>
      <div
        role="toolbar"
        aria-label="Bulk email actions"
        className={cn(
          // The bar is rendered as a flex child at the bottom of the inbox
          // list column (sibling of the ScrollArea, NOT inside it). The list
          // column is a `flex flex-col` with `h-full`, so a non-sticky child
          // placed after the `flex-1` ScrollArea naturally lands at the bottom
          // of the column. On mobile the column is offset 56px above the
          // viewport bottom by the main's `pb-14` (room for the bottom-nav),
          // so the bar floats just above the bottom-nav — matching the spec.
          // On desktop the column has its own scroll-height so the bar sits
          // at the bottom of the list column.
          'flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-background/90 p-1.5 shadow-lg backdrop-blur-md',
          'mx-2 mb-2',
        )}
      >
        {/* Selected count */}
        <Badge
          variant="secondary"
          className="h-8 shrink-0 gap-1.5 px-2.5 font-medium"
          aria-live="polite"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          <span aria-label={`${count} selected`}>
            {count} selected
          </span>
        </Badge>

        <Separator orientation="vertical" className="mx-0.5 h-6" />

        {/* Primary actions — always visible */}
        <ActionButton action="read" onAction={onAction} pending={pending} />
        <ActionButton action="star" onAction={onAction} pending={pending} />
        <ActionButton action="archive" onAction={onAction} pending={pending} />

        {/* Secondary actions — only inline on desktop, in overflow on mobile */}
        <div className="hidden lg:contents">
          <ActionButton action="unread" onAction={onAction} pending={pending} />
          <ActionButton action="unstar" onAction={onAction} pending={pending} />
          <ActionButton action="important" onAction={onAction} pending={pending} />
          <ActionButton action="unimportant" onAction={onAction} pending={pending} />
        </div>

        {/* Delete — AlertDialog confirmation, always inline on desktop */}
        <div className="hidden lg:block">
          <ActionButton
            action="delete"
            onAction={() => setDeleteOpen(true)}
            pending={pending}
            tone="destructive"
          />
        </div>

        {/* Overflow dropdown (mobile + tablet) — secondary actions + delete */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  aria-label="More actions"
                  className="h-8 w-8 shrink-0 lg:hidden"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>More actions</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
              More actions
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => onAction('unread')}>
              <Mail className="h-4 w-4" />
              <span>Mark unread</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAction('unstar')}>
              <StarOff className="h-4 w-4" />
              <span>Unstar</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAction('important')}>
              <Flag className="h-4 w-4" />
              <span>Mark important</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAction('unimportant')}>
              <FlagOff className="h-4 w-4" />
              <span>Mark unimportant</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setDeleteOpen(true)}
              variant="destructive"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="mx-0.5 h-6" />

        {/* Clear selection — always visible */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={pending}
              className="h-8 shrink-0 gap-1.5 px-2.5"
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear selection</TooltipContent>
        </Tooltip>
      </div>

      {/* Delete confirmation — shared between the inline desktop button and
          the mobile overflow-menu entry. */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {count} email{count === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {count === 1 ? 'the selected email' : 'the selected emails'} from your
              inbox. In this demo, messages are archived (not hard-deleted) so the data is preserved
              and can be restored. This action cannot be undone from the bulk bar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={fireDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
