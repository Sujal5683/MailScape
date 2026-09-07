'use client'

import * as React from 'react'
import { createElement } from 'react'
import {
  Bell,
  CalendarClock,
  FileEdit,
  FileText,
  Folder,
  Layers,
  ListTodo,
  Mail,
  Search,
  ShieldCheck,
  Sparkles,
  User,
  Workflow,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { formatRelative, formatDateTime } from '@/lib/format'
import type { AuditEventDTO, AuditSourceSurface } from '@/lib/types'

// Statically-imported prefix → icon map. Looked up by `iconForEventType`,
// rendered via createElement (never `const Icon = lookup(); <Icon/>`).
const ICON_BY_PREFIX: { prefix: string; icon: LucideIcon }[] = [
  { prefix: 'EMAIL_', icon: Mail },
  { prefix: 'AI_', icon: Sparkles },
  { prefix: 'RULE_', icon: Workflow },
  { prefix: 'CATEGORY_', icon: Folder },
  { prefix: 'NOTIFICATION_', icon: Bell },
  { prefix: 'DEADLINE_', icon: CalendarClock },
  { prefix: 'ACCOUNT_', icon: User },
  { prefix: 'ACTION_ITEM_', icon: ListTodo },
  { prefix: 'SAVED_SEARCH_', icon: Search },
  { prefix: 'TEMPLATE_', icon: FileText },
  { prefix: 'DRAFT_', icon: FileEdit },
  { prefix: 'BULK_', icon: Layers },
]
const DEFAULT_ICON: LucideIcon = ShieldCheck

function iconForEventType(eventType: string): LucideIcon {
  return ICON_BY_PREFIX.find((p) => eventType.startsWith(p.prefix))?.icon ?? DEFAULT_ICON
}

function humanizeEventType(eventType: string): string {
  return eventType
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const SURFACE_BADGE: Record<AuditSourceSurface, { label: string; className: string }> = {
  ui: { label: 'UI', className: 'bg-primary/15 text-primary border-transparent' },
  ai: { label: 'AI', className: 'cat-violet cat-bg-soft cat-text border-transparent' },
  api: { label: 'API', className: 'bg-muted text-muted-foreground border-transparent' },
  system: { label: 'System', className: 'bg-muted text-muted-foreground border-transparent' },
}

function hasReadableMetadata(meta: Record<string, unknown>): boolean {
  return Object.keys(meta).length > 0
}

export function AuditEventRow({ event }: { event: AuditEventDTO }) {
  const cmp = iconForEventType(event.eventType)
  const [open, setOpen] = React.useState(false)
  const surface = event.sourceSurface ? SURFACE_BADGE[event.sourceSurface] : null
  const hasMeta = hasReadableMetadata(event.metadata)

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="group relative rounded-lg border border-border/60 bg-card p-3 transition-colors hover:bg-accent/30 data-[state=open]:bg-accent/30"
    >
      {/* Timeline dot + connector */}
      <span
        aria-hidden
        className="absolute -left-[1.125rem] top-4 size-2.5 rounded-full border-2 border-background bg-primary ring-1 ring-border"
      />
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          {createElement(cmp, { className: 'size-4', 'aria-hidden': true })}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-medium text-foreground">
              {humanizeEventType(event.eventType)}
            </p>
            {surface ? (
              <Badge variant="outline" className={cn('h-5 px-1.5 text-[10px] font-medium', surface.className)}>
                {surface.label}
              </Badge>
            ) : null}
            <span className="ml-auto text-xs text-muted-foreground" title={formatDateTime(event.createdAt)}>
              {formatRelative(event.createdAt)}
            </span>
          </div>
          {(event.targetType || event.targetId) && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {event.targetType ? <span>{event.targetType}</span> : null}
              {event.targetType && event.targetId ? <span> · </span> : null}
              {event.targetId ? <span className="font-mono">{event.targetId}</span> : null}
            </p>
          )}
          {hasMeta ? (
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <ChevronRight
                  className={cn('size-3.5 transition-transform', open && 'rotate-90')}
                  aria-hidden
                />
                {open ? 'Hide details' : 'Show details'}
              </button>
            </CollapsibleTrigger>
          ) : null}
        </div>
      </div>
      {hasMeta ? (
        <CollapsibleContent>
          <pre className="mt-2 overflow-x-auto rounded-md border border-border/60 bg-muted/40 p-2.5 font-mono text-xs leading-relaxed text-foreground">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  )
}
