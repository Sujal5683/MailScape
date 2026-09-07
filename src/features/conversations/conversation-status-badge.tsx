'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ConversationStatus, FollowUpState } from '@/lib/conversations/types'

/**
 * Conversation status + follow-up badge (§53).
 * Renders a compact row of colored badges using semantic tokens only:
 * awaiting → warning, follow_up_due → destructive, updated → primary,
 * resolved → success, active/archived → muted.
 */

const STATUS_META: Record<
  ConversationStatus,
  { label: string; className: string }
> = {
  active: { label: 'Active', className: 'border-border bg-muted text-muted-foreground' },
  awaiting_user: {
    label: 'Awaiting you',
    className: 'border-warning/30 bg-warning/15 text-warning',
  },
  awaiting_other: {
    label: 'Awaiting reply',
    className: 'border-warning/30 bg-warning/15 text-warning',
  },
  follow_up_due: {
    label: 'Follow-up due',
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  updated: {
    label: 'Updated',
    className: 'border-primary/30 bg-primary/10 text-primary',
  },
  resolved: {
    label: 'Resolved',
    className: 'border-success/30 bg-success/10 text-success',
  },
  archived: {
    label: 'Archived',
    className: 'border-border bg-muted text-muted-foreground',
  },
}

const FOLLOWUP_META: Record<
  FollowUpState,
  { label: string; className: string } | null
> = {
  none: null,
  recommended: {
    label: 'Follow-up suggested',
    className: 'border-primary/30 bg-primary/10 text-primary',
  },
  due: {
    label: 'Follow-up due',
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  awaiting_response: {
    label: 'Awaiting response',
    className: 'border-warning/30 bg-warning/15 text-warning',
  },
  resolved: {
    label: 'Follow-up resolved',
    className: 'border-success/30 bg-success/10 text-success',
  },
}

export function ConversationStatusBadge({
  status,
  followUpState,
  importance,
  className,
}: {
  status: ConversationStatus
  followUpState: FollowUpState
  importance?: 'normal' | 'important'
  className?: string
}) {
  const statusMeta = STATUS_META[status]
  const followUpMeta = FOLLOWUP_META[followUpState]
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <Badge
        variant="outline"
        className={cn('px-1.5 py-0 text-[10px] font-medium', statusMeta.className)}
      >
        {statusMeta.label}
      </Badge>
      {followUpMeta && (
        <Badge
          variant="outline"
          className={cn('px-1.5 py-0 text-[10px] font-medium', followUpMeta.className)}
        >
          {followUpMeta.label}
        </Badge>
      )}
      {importance === 'important' && (
        <Badge
          variant="outline"
          className="border-warning/30 bg-warning/15 px-1.5 py-0 text-[10px] font-medium text-warning"
        >
          Important
        </Badge>
      )}
    </div>
  )
}
