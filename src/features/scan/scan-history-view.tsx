'use client'

import { useState } from 'react'
import { ChevronRight, History, RefreshCw, CheckCircle2, AlertTriangle, X, Loader2, PauseCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { formatRelative, formatDateTime } from '@/lib/format'
import { useScanJobs, useRetryScan } from '@/hooks/use-queries'
import type { ScanJobDTO, ScanStatus } from '@/lib/scan/types'

const TERMINAL: ScanStatus[] = ['completed', 'failed', 'cancelled']

function StatusPill({ status }: { status: ScanStatus }) {
  if (status === 'completed') return <Badge className="border-transparent bg-success/15 text-success">complete</Badge>
  if (status === 'failed') return <Badge variant="destructive">failed</Badge>
  if (status === 'cancelled') return <Badge variant="secondary">cancelled</Badge>
  if (status === 'paused') return <Badge className="border-transparent bg-warning/15 text-warning">paused</Badge>
  return <Badge className="border-transparent bg-primary/15 text-primary">{status}</Badge>
}

function StatusIcon({ status }: { status: ScanStatus }) {
  if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-success" />
  if (status === 'failed') return <AlertTriangle className="h-4 w-4 text-destructive" />
  if (status === 'cancelled') return <X className="h-4 w-4 text-muted-foreground" />
  if (status === 'paused') return <PauseCircle className="h-4 w-4 text-warning" />
  if (TERMINAL.includes(status)) return null
  return <Loader2 className="h-4 w-4 animate-spin text-primary" />
}

function Row({ job }: { job: ScanJobDTO }) {
  const [open, setOpen] = useState(false)
  const retry = useRetryScan()
  const r = job.results
  return (
    <li className="rounded-lg border border-border">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-accent/40" aria-expanded={open}>
        <StatusIcon status={job.status} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{job.config.scope} scan</p>
          <p className="truncate text-xs text-muted-foreground">{formatRelative(job.createdAt)} · {formatDateTime(job.createdAt)}</p>
        </div>
        <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
          <span>{r?.discovered ?? 0} found</span>
          <span className="text-success">{r?.imported ?? 0} in</span>
          {r && r.failed > 0 && <span className="text-destructive">{r.failed} fail</span>}
        </div>
        <StatusPill status={job.status} />
        <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-border p-3 text-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([['Discovered', r?.discovered], ['Imported', r?.imported], ['Duplicates', r?.duplicates], ['Failed', r?.failed]] as const).map(([l, v]) => (
              <div key={l} className="rounded-md border border-border bg-muted/30 p-2">
                <p className="text-base font-semibold">{(v ?? 0).toLocaleString()}</p>
                <p className="text-[11px] text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
          <Separator />
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Scope: <span className="text-foreground">{job.config.scope}</span></span>
            <span>·</span>
            <span>Preset: <span className="text-foreground">{job.config.dateRangePreset}</span></span>
            <span>·</span>
            <span>Job: <span className="text-foreground font-mono">{job.id.slice(0, 8)}</span></span>
            {job.completedAt && (<><span>·</span><span>Finished {formatRelative(job.completedAt)}</span></>)}
          </div>
          {job.errorMessage && <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">{job.errorMessage}</p>}
          {TERMINAL.includes(job.status) && (
            <Button size="sm" variant="outline" disabled={retry.isPending} onClick={() => retry.mutate(job.id)} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Retry scan
            </Button>
          )}
        </div>
      )}
    </li>
  )
}

/** Scan history list — past + active scan jobs. Each row expands inline to
 *  show result counts, config summary, and (for terminal jobs) a Retry
 *  button. Empty state is friendly. */
export function ScanHistoryView() {
  const { data: jobs, isLoading, isError } = useScanJobs()
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b border-border px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm"><History className="h-4 w-4 text-muted-foreground" /> Scan history</CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : isError ? (
          <p className="p-4 text-sm text-destructive">Couldn&apos;t load scan history.</p>
        ) : !jobs || jobs.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No scans yet. Start one from the top bar.</p>
        ) : (
          <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {jobs.map((j) => <Row key={j.id} job={j} />)}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
