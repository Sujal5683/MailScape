'use client'

import { RefreshCw, Download, CheckCircle2, AlertTriangle, PauseCircle, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSyncStatus, useRunSync } from '@/hooks/use-queries'
import { useScanDialogStore } from './scan-dialog-store'
import { formatRelative } from '@/lib/format'
import type { SyncStatusDTO } from '@/lib/scan/types'

type SyncState = SyncStatusDTO['status']

const STATUS_META: Record<SyncState, { label: string; tone: string; icon: typeof CheckCircle2; spin?: boolean }> = {
  success: { label: 'Up to date', tone: 'text-success', icon: CheckCircle2 },
  syncing: { label: 'Syncing', tone: 'text-primary', icon: RefreshCw, spin: true },
  idle: { label: 'Idle', tone: 'text-muted-foreground', icon: CheckCircle2 },
  paused: { label: 'Paused', tone: 'text-warning', icon: PauseCircle },
  error: { label: 'Error', tone: 'text-destructive', icon: AlertTriangle },
}

/** Compact dashboard sync-status widget. Surfaces the live sync state, the
 *  last sync time, and how many new messages are pending. "Scan now" opens
 *  the ScanDialog; "Sync now" triggers a sync run. */
export function SyncStatusWidget() {
  const { data, isLoading, isError } = useSyncStatus(true)
  const runSync = useRunSync()
  const openScan = useScanDialogStore((s) => s.openDialog)

  if (isLoading) return <Card className="gap-0 py-0"><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>

  const status: SyncState = data?.status ?? 'idle'
  const meta = STATUS_META[status] ?? STATUS_META.idle
  const Icon = meta.icon
  const newCount = data?.newMessageCount ?? 0
  const lastSynced = data?.lastSyncedAt ? formatRelative(data.lastSyncedAt) : 'never'

  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <span className={`flex size-9 items-center justify-center rounded-full bg-muted ${meta.tone}`}>
            <Icon className={`h-4 w-4 ${meta.spin ? 'animate-spin' : ''}`} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{meta.label}{isError ? ' — offline' : ''}</p>
            <p className="truncate text-xs text-muted-foreground">
              Last synced {lastSynced}
              {newCount > 0 && <> · <span className="font-medium text-foreground">{newCount}</span> new</>}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={openScan} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Scan now
          </Button>
          <Button
            size="sm"
            variant="default"
            disabled={runSync.isPending || status === 'syncing'}
            onClick={() => runSync.mutate()}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${runSync.isPending ? 'animate-spin' : ''}`} /> Sync now
          </Button>
        </div>
        {data?.errorMessage && (
          <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">{data.errorMessage}</p>
        )}
      </CardContent>
    </Card>
  )
}

// Re-export so callers can grab the spinning icon without re-importing lucide.
export const SyncSpinnerIcon = Loader2
