'use client'

import * as React from 'react'
import { ShieldCheck } from 'lucide-react'
import { SettingsSection } from './section-wrapper'
import { AuditLogFilters, type AuditLogFilterState } from './audit-log-filters'
import { AuditLogTimeline } from './audit-log-timeline'

// AuditLogSection — orchestrates the audit log viewer inside Settings.
// Owns the filter state (event type / surface / search), passes the active
// filters to AuditLogTimeline which fetches the matching events via
// useAuditEvents + useInfiniteQuery and renders the vertical timeline.
//
// The section is appended to the SECTIONS registry in settings-view.tsx so it
// appears as a tab on desktop and a stacked card on mobile.
const DEFAULT_FILTERS: AuditLogFilterState = { type: '', surface: 'all', search: '' }

export function AuditLogSection() {
  const [filters, setFilters] = React.useState<AuditLogFilterState>(DEFAULT_FILTERS)

  // Map UI filter state → useAuditEvents params. `search` is applied
  // client-side in the timeline (matches eventType + targetType across all
  // loaded pages); `type` and `surface` are passed to the API.
  const apiFilters = {
    type: filters.type || undefined,
    surface: filters.surface === 'all' ? undefined : filters.surface,
    search: filters.search,
    limit: 30,
  }

  return (
    <SettingsSection
      icon={ShieldCheck}
      title="Audit Log"
      description="Account activity history — every action taken in this mailbox, by you or the AI."
    >
      <div className="flex flex-col gap-4">
        <AuditLogFilters value={filters} onChange={setFilters} />
        <AuditLogTimeline filters={apiFilters} />
      </div>
    </SettingsSection>
  )
}
