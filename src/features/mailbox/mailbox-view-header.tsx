'use client'

import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// MailboxViewHeader — small presentational header for the shared
// MailboxFilterView. Renders an icon in a tinted circle, the view title,
// a count badge (when `count` is provided), the description, and an optional
// trailing action (e.g. a "New draft" button). Stateless — the parent owns
// all interaction logic. Kept under 60 lines on purpose; the orchestrator
// (mailbox-filter-view.tsx) handles loading/empty states and master-detail.
// ---------------------------------------------------------------------------

export interface MailboxViewHeaderProps {
  icon: LucideIcon
  title: string
  description?: string
  count?: number
  /** Tint class for the icon circle (e.g. 'cat-amber', 'text-muted-foreground'). Defaults to muted. */
  iconTint?: string
  /** Optional trailing action — typically a Button (New draft, Empty spam, etc.). */
  action?: React.ReactNode
  className?: string
}

export function MailboxViewHeader({
  icon: Icon,
  title,
  description,
  count,
  iconTint = 'text-muted-foreground',
  action,
  className,
}: MailboxViewHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 border-b border-border px-4 py-3',
        className,
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted',
          iconTint,
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold leading-tight">{title}</h2>
          {typeof count === 'number' && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-medium">
              {count}
            </Badge>
          )}
        </div>
        {description && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </div>
  )
}
