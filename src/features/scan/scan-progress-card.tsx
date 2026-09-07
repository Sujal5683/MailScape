'use client'

import { Loader2, X, Search, Download, Shuffle, Tags, CheckCircle2, AlertTriangle, PauseCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { useScanJob, useCancelScan } from '@/hooks/use-queries'
import type { ScanPhase, ScanStatus } from '@/lib/scan/types'

const PHASE_META: Record<ScanPhase, { label: string; icon: typeof Search; tone: string }> = {
  discovering: { label: 'Discovering', icon: Search, tone: 'text-primary' },
  fetching: { label: 'Fetching', icon: Download, tone: 'text-primary' },
  normalizing: { label: 'Normalizing', icon: Shuffle, tone: 'text-primary' },
  classifying: { label: 'Classifying', icon: Tags, tone: 'text-primary' },
  indexing: { label: 'Indexing', icon: Tags, tone: 'text-primary' },
}

const TERMINAL: ScanStatus[] = ['completed', 'failed', 'cancelled']

function statusLabel(s: ScanStatus): { label: string; icon: typeof CheckCircle2; tone: string } {
  switch (s) {
    case 'completed': return { label: 'Complete', icon: CheckCircle2, tone: 'text-success' }
    case 'failed': return { label: 'Failed', icon: AlertTriangle, tone: 'text-destructive' }
    case 'cancelled': return { label: 'Cancelled', icon: X, tone: 'text-muted-foreground' }
    case 'paused': return { label: 'Paused', icon: PauseCircle, tone: 'text-warning' }
    case 'queued': return { label: 'Queued', icon: Loader2, tone: 'text-muted-foreground' }
    default: return { label: 'Running', icon: Loader2, tone: 'text-primary' }
  }
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex flex-col">
      <span className={`text-base font-semibold leading-none ${tone ?? ''}`}>{value.toLocaleString()}</span>
      <span className="mt-1 text-[11px] text-muted-foreground">{label}</span>
    </div>
  )
}

/** Live scan-progress card. Polls the active job every 3s while a scan is
 *  running; auto-stops polling once the status becomes terminal
 *  (completed / failed / cancelled). The Cancel button is hidden once the
 *  scan reaches a terminal state. */
export function ScanProgressCard({ jobId, onDone }: { jobId: string; onDone?: () => void }) {
  const { data: job } = useScanJob(jobId, true)
  const cancel = useCancelScan()
  if (!job) return null

  const status = job.status
  const meta = statusLabel(status)
  const Icon = meta.icon
  const isRunning = !TERMINAL.includes(status)
  const phaseMeta = job.progress?.phase ? PHASE_META[job.progress.phase] : undefined
  const total = job.progress?.total ?? 0
  const current = job.progress?.current ?? 0
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0
  const r = job.results

  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''} ${meta.tone}`} />
          <p className="text-sm font-medium">{meta.label}{phaseMeta ? ` · ${phaseMeta.label}` : ''}</p>
          <Badge variant="secondary" className="ml-auto text-[11px]">
            {current.toLocaleString()} / {total.toLocaleString()}
          </Badge>
        </div>
        <Progress value={pct} />
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Discovered" value={r?.discovered ?? 0} />
          <Stat label="Imported" value={r?.imported ?? 0} tone="text-success" />
          <Stat label="Duplicates" value={r?.duplicates ?? 0} />
          <Stat label="Failed" value={r?.failed ?? 0} tone={r && r.failed > 0 ? 'text-destructive' : undefined} />
        </div>
        {job.errorMessage && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">{job.errorMessage}</p>
        )}
        <Separator />
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button size="sm" variant="outline" onClick={() => cancel.mutate(job.id)} disabled={cancel.isPending} className="gap-1.5">
              <X className="h-3.5 w-3.5" /> Cancel scan
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={onDone} className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Dismiss
            </Button>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground">Job {job.id.slice(0, 8)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
