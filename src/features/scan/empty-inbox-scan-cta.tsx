'use client'

import { Download, Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useScanJobs } from '@/hooks/use-queries'
import { useScanDialogStore } from './scan-dialog-store'
import { EmptyState } from '@/components/common/states'
import type { ScanJobDTO, ScanStatus } from '@/lib/scan/types'

const RUNNING: ScanStatus[] = ['queued', 'scanning', 'importing', 'classifying']

function isRunning(j?: ScanJobDTO | null): j is ScanJobDTO {
  return !!j && RUNNING.includes(j.status)
}
function isDone(j?: ScanJobDTO | null): j is ScanJobDTO {
  return !!j && j.status === 'completed'
}

/** Intelligent empty-inbox scan CTA. When the inbox is empty, the copy +
 *  action adapts to the scan lifecycle:
 *    - no scans yet     → "Your mailbox has not been scanned yet"
 *    - scan running     → "Scanning Gmail… Found N messages"
 *    - scan complete    → "Mailbox synchronized. N emails imported"
 *  When the inbox is not empty, returns null (no CTA needed). */
export function EmptyInboxScanCta({ isEmpty }: { isEmpty: boolean }) {
  const { data: jobs } = useScanJobs()
  const openScan = useScanDialogStore((s) => s.openDialog)
  if (!isEmpty) return null

  const active = jobs?.find(isRunning)
  const lastDone = jobs?.find(isDone)

  if (active) {
    const found = active.results?.discovered ?? 0
    return (
      <Card className="border-dashed bg-muted/30 py-6">
        <EmptyState
          illustration="inbox"
          title="Scanning Gmail…"
          description={found > 0 ? `Found ${found.toLocaleString()} messages so far. We'll import them as the scan progresses.` : 'Discovering messages in your mailbox. This may take a moment.'}
          action={<Button variant="outline" onClick={openScan} className="gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> View progress</Button>}
        />
      </Card>
    )
  }

  if (lastDone) {
    const imported = lastDone.results?.imported ?? 0
    return (
      <Card className="border-dashed bg-muted/30 py-6">
        <EmptyState
          illustration="inbox"
          title="Mailbox synchronized"
          description={`${imported.toLocaleString()} email${imported === 1 ? '' : 's'} imported. Try a fresh scan to pull newer messages.`}
          action={<Button onClick={openScan} className="gap-1.5"><Download className="h-4 w-4" /> Scan again</Button>}
        />
      </Card>
    )
  }

  return (
    <Card className="border-dashed bg-muted/30 py-6">
      <EmptyState
        illustration="inbox"
        title="Your mailbox has not been scanned yet"
        description="Connect and scan your Gmail account to import messages and unlock categorization, deadlines, and AI summaries."
        action={<Button onClick={openScan} className="gap-1.5"><Download className="h-4 w-4" /> Scan Gmail</Button>}
      />
    </Card>
  )
}

/** Lightweight inline CTA — used when a parent already renders a custom
 *  empty state but still wants the "Scan Gmail" affordance. */
export function ScanGmailCtaButton() {
  const openScan = useScanDialogStore((s) => s.openDialog)
  return (
    <Button onClick={openScan} className="gap-1.5">
      <Mail className="h-4 w-4" /> Scan Gmail
    </Button>
  )
}
