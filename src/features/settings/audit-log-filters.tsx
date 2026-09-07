'use client'

import * as React from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AuditSourceSurface } from '@/lib/types'

// Common event-type prefixes exposed as quick filters. The API does a partial
// `contains` match, so selecting "EMAIL_" matches EMAIL_MARKED_READ,
// EMAIL_STARRED, etc. Derived from the event types emitted across the codebase.
const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '__all', label: 'All events' },
  { value: 'EMAIL_', label: 'Email actions' },
  { value: 'AI_', label: 'AI actions' },
  { value: 'RULE_', label: 'Rules' },
  { value: 'CATEGORY_', label: 'Categories' },
  { value: 'DEADLINE_', label: 'Deadlines' },
  { value: 'ACTION_ITEM_', label: 'Action items' },
  { value: 'NOTIFICATION_', label: 'Notifications' },
  { value: 'SAVED_SEARCH_', label: 'Saved searches' },
  { value: 'TEMPLATE_', label: 'Templates' },
  { value: 'DRAFT_', label: 'Drafts' },
  { value: 'ACCOUNT_', label: 'Accounts' },
]

const SURFACE_OPTIONS: { value: string; label: string }[] = [
  { value: '__all', label: 'All surfaces' },
  { value: 'ui', label: 'UI' },
  { value: 'ai', label: 'AI' },
  { value: 'api', label: 'API' },
  { value: 'system', label: 'System' },
]

export interface AuditLogFilterState {
  type: string
  surface: AuditSourceSurface | 'all'
  search: string
}

interface Props {
  value: AuditLogFilterState
  onChange: (next: AuditLogFilterState) => void
}

export function AuditLogFilters({ value, onChange }: Props) {
  const update = React.useCallback(
    (patch: Partial<AuditLogFilterState>) => onChange({ ...value, ...patch }),
    [value, onChange],
  )

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Select
        value={value.type || '__all'}
        onValueChange={(v) => update({ type: v === '__all' ? '' : v })}
      >
        <SelectTrigger className="w-full sm:w-44" size="sm" aria-label="Filter by event type">
          <SelectValue placeholder="All events" />
        </SelectTrigger>
        <SelectContent>
          {TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.surface || '__all'}
        onValueChange={(v) =>
          update({ surface: (v === '__all' ? 'all' : v) as AuditSourceSurface | 'all' })
        }
      >
        <SelectTrigger className="w-full sm:w-36" size="sm" aria-label="Filter by surface">
          <SelectValue placeholder="All surfaces" />
        </SelectTrigger>
        <SelectContent>
          {SURFACE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={value.search}
          onChange={(e) => update({ search: e.target.value })}
          placeholder="Search event type or target…"
          className="h-8 pl-8 text-sm"
          aria-label="Search audit events"
        />
      </div>
    </div>
  )
}
