'use client'

import { useState } from 'react'
import { ArchivedList } from './archived-list'
import { ArchivedDetail } from './archived-detail'
import { useArchivedEmails } from '@/hooks/use-queries'
import { PaneScroll } from '@/components/ui/pane-scroll'
import { SleekSeparator } from '@/components/common/separator'
import { Archive, AlertTriangle } from 'lucide-react'
import { MasterDetailLayout } from '@/components/layout/master-detail-layout'

// ---------------------------------------------------------------------------
// ArchivedView — orchestrator for the Archive tab.
//
// Layout mirrors the inbox: master-detail on desktop (list left, detail right),
// stacked on mobile (only one of the two is visible at a time, driven by
// `selectedId`). The header carries the title, the live archived count, and a
// warning banner explaining that archived emails are hidden from the inbox
// and that permanent deletion is irreversible.
//
// This file is intentionally thin — it owns the layout + selection state and
// delegates the list (rows + restore/delete) to ArchivedList and the detail
// (toolbar + reused EmailDetail) to ArchivedDetail.
// ---------------------------------------------------------------------------
export function ArchivedView() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data } = useArchivedEmails()
  const total = data?.total ?? 0

  return (
    <div className="flex h-full flex-col">
      {/* ===== Header ===== */}
      <div className="shrink-0 border-b border-border bg-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Archive className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold leading-tight tracking-tight md:text-xl">
                Archive
              </h1>
              <p className="text-xs text-muted-foreground">
                {total === 0
                  ? 'No archived emails'
                  : `${total} archived ${total === 1 ? 'email' : 'emails'}`}
              </p>
            </div>
          </div>

          {/* Warning banner — explains archive semantics + irreversibility. */}
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <p className="text-warning-foreground">
              <span className="font-medium">Archived emails are hidden from your inbox.</span>{' '}
              Permanently deleted emails cannot be recovered — their deadlines, action
              items, and notifications are also removed.
            </p>
          </div>

          <SleekSeparator className="mt-4" />
        </div>
      </div>

      {/* ===== Master-detail body ===== */}
      <div className="min-h-0 flex-1">
        <MasterDetailLayout
          selectedId={selectedId}
          onBack={() => setSelectedId(null)}
          masterMinWidth={300}
          masterDefaultWidth={400}
          masterMaxWidth={500}
          storageKey="archived-layout"
          master={
            <PaneScroll>
              <div className="p-2 pb-20 md:pb-2">
                <ArchivedList selectedId={selectedId} onSelect={setSelectedId} />
              </div>
            </PaneScroll>
          }
          detail={<ArchivedDetail emailId={selectedId} onBack={() => setSelectedId(null)} />}
        />
      </div>
    </div>
  )
}
