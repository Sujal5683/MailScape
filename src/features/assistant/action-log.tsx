'use client'

import * as React from 'react'
import { createElement } from 'react'
import {
  RotateCcw,
  ShieldCheck,
  Clock,
  AlertCircle,
  CheckCircle2,
  Wrench,
  Search,
  Mail,
  MailOpen,
  Star,
  FolderTree,
  Users,
  Bell,
  Sparkles,
  Filter,
  CalendarClock,
  FileText,
  Send,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useConversationActions, useRevertAction } from '@/hooks/use-queries'
import { formatRelative, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AssistantActionDTO } from '@/lib/types'
import { CollapsibleCode } from './message-renderer'

// ---------------------------------------------------------------------------
// Tool icon mapping — statically imported (no dynamic lookup at render time)
// ---------------------------------------------------------------------------

const TOOL_ICONS: Record<string, LucideIcon> = {
  search_emails: Search,
  get_email: Mail,
  list_categories: FolderTree,
  list_senders: Users,
  list_notifications: Bell,
  generate_summary: Sparkles,
  create_category: FolderTree,
  create_rule: Filter,
  mark_read: MailOpen,
  mark_unread: Mail,
  star_email: Star,
  create_deadline: CalendarClock,
  create_draft: FileText,
  send_email: Send,
  delete_rule: Trash2,
}

// Render a tool's icon by name. Uses createElement with the resolved
// LucideIcon so the lint rule about "components created during render"
// stays satisfied (same canonical pattern as `CategoryIcon`).
function ToolIcon({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const cmp = TOOL_ICONS[name] ?? Wrench
  return createElement(cmp, { className })
}

// Humanize a tool name like `search_emails` → `Search emails`.
function humanizeTool(name: string): string {
  return name
    .split('_')
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ')
}

// ---------------------------------------------------------------------------
// Status meta
// ---------------------------------------------------------------------------

interface StatusMeta {
  label: string
  className: string
  Icon: LucideIcon
}

function statusMeta(status: string): StatusMeta {
  switch (status) {
    case 'executed':
      return {
        label: 'Executed',
        className: 'border-success/40 bg-success/10 text-success',
        Icon: CheckCircle2,
      }
    case 'pending_confirmation':
    case 'pending':
      return {
        label: 'Pending',
        className: 'border-warning/40 bg-warning/10 text-warning',
        Icon: Clock,
      }
    case 'failed':
      return {
        label: 'Failed',
        className: 'border-destructive/40 bg-destructive/10 text-destructive',
        Icon: AlertCircle,
      }
    case 'reverted':
      return {
        label: 'Reverted',
        className: 'border-border bg-muted text-muted-foreground',
        Icon: RotateCcw,
      }
    default:
      return {
        label: status,
        className: 'border-border bg-muted text-muted-foreground',
        Icon: Clock,
      }
  }
}

function summarizeRecord(rec: Record<string, unknown> | null, max = 4): string {
  if (!rec) return ''
  const entries = Object.entries(rec).slice(0, max)
  return entries
    .map(([k, v]) => {
      const s = typeof v === 'string' ? v : JSON.stringify(v)
      return `${k}: ${s.length > 60 ? s.slice(0, 60) + '…' : s}`
    })
    .join('\n')
}

// ---------------------------------------------------------------------------
// Action timeline item
// ---------------------------------------------------------------------------

function ActionTimelineItem({ action }: { action: AssistantActionDTO }) {
  const revert = useRevertAction()
  const meta = statusMeta(action.status)
  const StatusIcon = meta.Icon
  const canRevert = action.reversible && action.status === 'executed'
  const reverting = revert.isPending && revert.variables === action.id
  const inputText = summarizeRecord(action.inputSummary)
  const resultText = summarizeRecord(action.resultSummary)

  return (
    <div className="relative pl-6">
      {/* Vertical timeline line */}
      <div className="absolute left-[7px] top-2 h-full w-px bg-border" aria-hidden="true" />
      {/* Timeline dot */}
      <div
        className={cn(
          'absolute left-0 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 bg-background',
          action.status === 'executed'
            ? 'border-success/60'
            : action.status === 'failed'
              ? 'border-destructive/60'
              : action.status === 'reverted'
                ? 'border-muted-foreground/40'
                : 'border-warning/60',
        )}
        aria-hidden="true"
      />

      <div className="rounded-lg border border-border/60 bg-card p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
              <ToolIcon name={action.toolName} className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {humanizeTool(action.toolName)}
              </div>
              <div
                className="text-xs text-muted-foreground"
                title={formatDateTime(action.createdAt)}
              >
                {formatRelative(action.createdAt)}
                {action.revertedAt && (
                  <span className="ml-1 text-muted-foreground/80">
                    · reverted {formatRelative(action.revertedAt)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn('shrink-0 gap-1 text-[10px]', meta.className)}
          >
            <StatusIcon className="h-3 w-3" />
            {meta.label}
          </Badge>
        </div>

        {action.errorMessage && (
          <div className="mt-2 rounded bg-destructive/5 px-2 py-1 text-xs text-destructive">
            {action.errorMessage}
          </div>
        )}

        {(inputText || resultText) && (
          <div className="mt-2 space-y-1">
            {inputText && (
              <CollapsibleCode label="Input" text={inputText} />
            )}
            {resultText && (
              <CollapsibleCode label="Result" text={resultText} />
            )}
          </div>
        )}

        <div className="mt-2 flex items-center gap-2">
          {action.reversible && action.status !== 'reverted' && (
            <Badge
              variant="outline"
              className="gap-1 border-success/30 text-[10px] text-success"
            >
              <ShieldCheck className="h-3 w-3" /> Reversible
            </Badge>
          )}
          {action.status === 'reverted' && (
            <Badge
              variant="outline"
              className="gap-1 border-border text-[10px] text-muted-foreground"
            >
              <RotateCcw className="h-3 w-3" /> Reverted
            </Badge>
          )}
          {canRevert && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto h-7 text-xs"
              disabled={reverting}
              onClick={() => revert.mutate(action.id)}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              {reverting ? 'Reverting…' : 'Revert'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Date grouping
// ---------------------------------------------------------------------------

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function dateBucket(iso: string): 'today' | 'yesterday' | 'earlier' {
  const d = new Date(iso)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isSameDay(d, now)) return 'today'
  if (isSameDay(d, yesterday)) return 'yesterday'
  return 'earlier'
}

const BUCKET_LABEL: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  earlier: 'Earlier',
}

function groupByDate(
  actions: AssistantActionDTO[],
): { bucket: string; items: AssistantActionDTO[] }[] {
  const groups: Record<string, AssistantActionDTO[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  }
  for (const a of actions) {
    groups[dateBucket(a.createdAt)].push(a)
  }
  return ['today', 'yesterday', 'earlier']
    .filter((b) => groups[b].length > 0)
    .map((b) => ({ bucket: b, items: groups[b] }))
}

// ---------------------------------------------------------------------------
// Empty / loading / error states
// ---------------------------------------------------------------------------

function EmptyActionsState({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Wrench className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main ActionLog export
// ---------------------------------------------------------------------------

export interface ActionLogProps {
  conversationId: string | null
}

export function ActionLog({ conversationId }: ActionLogProps) {
  const { data: actions, isLoading, isError } = useConversationActions(conversationId)

  if (!conversationId) {
    return <EmptyActionsState message="Select a conversation to see its action log." />
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-6 text-center text-sm text-destructive">
        Failed to load actions.
      </div>
    )
  }

  if (!actions || actions.length === 0) {
    return <EmptyActionsState message="No actions taken in this conversation yet." />
  }

  const groups = groupByDate(actions)

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-3">
        {groups.map((g) => (
          <div key={g.bucket} className="space-y-2">
            <div className="flex items-center gap-2">
              <Separator />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {BUCKET_LABEL[g.bucket]}
              </span>
              <Separator />
            </div>
            <div className="space-y-3">
              {g.items.map((a) => (
                <ActionTimelineItem key={a.id} action={a} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

// Small inline separator (avoids importing the shadcn Separator wrapper which
// uses orientation defaults that don't fit a flex-row context here).
function Separator() {
  return <div className="h-px flex-1 bg-border/60" aria-hidden="true" />
}
