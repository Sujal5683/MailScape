'use client'

import { useState } from 'react'
import { RefreshCw, History, ChevronDown, Pause, Play } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { useSyncStatus, useRunSync, usePauseSync, useResumeSync } from '@/hooks/use-queries'
import { useScanDialogStore } from './scan-dialog-store'
import { ScanHistoryView } from './scan-history-view'
import { cn } from '@/lib/utils'

/** Scan & sync controls rendered below the accounts list in Settings.
 *  Wraps an auto-sync toggle, a Sync now button, pause/resume, and an
 *  expandable Scan history panel. */
export function ScanSyncSettings() {
  const { data: sync } = useSyncStatus()
  const runSync = useRunSync()
  const pause = usePauseSync()
  const resume = useResumeSync()
  const openScan = useScanDialogStore((s) => s.openDialog)
  const [autoSync, setAutoSync] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const paused = sync?.status === 'paused'
  const busy = sync?.status === 'syncing' || runSync.isPending

  const onTogglePause = () => (paused ? resume.mutate() : pause.mutate())
  const onToggleAuto = (v: boolean) => {
    setAutoSync(v)
    if (v && paused) resume.mutate()
    else if (!v && !paused) pause.mutate()
  }

  return (
    <div className="mt-4 space-y-4">
      <Separator />
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Label htmlFor="auto-sync" className="text-sm font-medium">Auto-sync</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Periodically pull new mail in the background. Pause to stop syncing without disconnecting.
            </p>
          </div>
          <Switch id="auto-sync" checked={autoSync && !paused} onCheckedChange={onToggleAuto} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={openScan} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Scan Gmail
          </Button>
          <Button size="sm" variant="default" disabled={busy} onClick={() => runSync.mutate()} className="gap-1.5">
            <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} /> Sync now
          </Button>
          <Button size="sm" variant="ghost" disabled={pause.isPending || resume.isPending} onClick={onTogglePause} className="gap-1.5">
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowHistory((s) => !s)}
            className="ml-auto gap-1.5"
            aria-expanded={showHistory}
          >
            <History className="h-3.5 w-3.5" /> Scan history
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showHistory && 'rotate-180')} />
          </Button>
        </div>

        {showHistory && <ScanHistoryView />}
      </div>
    </div>
  )
}
