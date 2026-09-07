'use client'

import { useState } from 'react'
import { Download, Play } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Accordion } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { useCreateScan } from '@/hooks/use-queries'
import { useToast } from '@/hooks/use-toast'
import { DEFAULT_SCAN_PROCESSING, type ScanConfig } from '@/lib/scan/types'
import { ScanDialogSections } from './scan-dialog-sections'

const DEFAULT: ScanConfig = {
  scope: 'new_only',
  dateRangePreset: 'last_30_days',
  processing: { ...DEFAULT_SCAN_PROCESSING },
}

/** Main scan configuration dialog — multi-section panel with collapsible
 *  sections (account / scope / time / filters / processing / review). The
 *  Dialog content is capped at 90vh and scrolls internally so the footer
 *  with the "Start scan" action stays reachable. */
export function ScanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateScan()
  const { toast } = useToast()
  const [cfg, setCfg] = useState<ScanConfig>(DEFAULT)
  const set = (p: Partial<ScanConfig>) => setCfg((c) => ({ ...c, ...p }))

  const start = () =>
    create.mutate(cfg, {
      onSuccess: (j) => {
        toast({ title: 'Scan started', description: `Job ${j.id.slice(0, 8)} queued.` })
        onOpenChange(false)
      },
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4" /> Scan Gmail
          </DialogTitle>
          <DialogDescription>Configure a one-off mailbox scan. Sections below collapse.</DialogDescription>
        </DialogHeader>

        <Accordion type="multiple" defaultValue={['scope']} className="px-5">
          <ScanDialogSections cfg={cfg} set={set} setCfg={setCfg} />
        </Accordion>

        <DialogFooter className="border-t border-border px-5 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={start} disabled={create.isPending} className="gap-1.5">
            <Play className="h-4 w-4" />
            {create.isPending ? 'Starting…' : 'Start scan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
