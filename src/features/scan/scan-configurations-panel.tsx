'use client'

import { Play, Trash2, Clock, Bookmark } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useScanConfigurations, useRunScanConfiguration, useDeleteScanConfiguration } from '@/hooks/use-queries'
import { formatRelative } from '@/lib/format'
import type { ScanConfigurationDTO } from '@/lib/scan/types'

function Row({ cfg }: { cfg: ScanConfigurationDTO }) {
  const run = useRunScanConfiguration()
  const del = useDeleteScanConfiguration()
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{cfg.name}</p>
          {cfg.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{cfg.description}</p>}
        </div>
        <Badge variant="secondary" className="shrink-0 text-[10px]">{cfg.config.scope}</Badge>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {cfg.updatedAt ? `updated ${formatRelative(cfg.updatedAt)}` : 'new'}</span>
        <span>·</span>
        <span>{cfg.enabled ? 'enabled' : 'disabled'}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate(cfg.id)} className="gap-1.5">
          <Play className="h-3.5 w-3.5" /> Run
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete saved scan?</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="font-medium text-foreground">{cfg.name}</span> will be permanently removed. Past scan jobs are retained.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); del.mutate(cfg.id) }}
                className="bg-destructive text-white hover:bg-destructive/90"
                disabled={del.isPending}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  )
}

/** Saved scan configurations panel. Each row exposes Run / Delete; the
 *  scope badge + last-updated time + enabled state give users a one-glance
 *  summary of each saved scan. */
export function ScanConfigurationsPanel() {
  const { data, isLoading, isError } = useScanConfigurations()
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b border-border px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Bookmark className="h-4 w-4 text-muted-foreground" /> Saved scan configurations
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : isError ? (
          <p className="p-4 text-sm text-destructive">Couldn&apos;t load configurations.</p>
        ) : !data || data.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No saved scans yet. Save one from the scan dialog.</p>
        ) : (
          <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {data.map((c) => <Row key={c.id} cfg={c} />)}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
