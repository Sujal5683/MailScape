'use client'

import { useState } from 'react'
import { useEmail, useRestoreEmail, usePermanentDeleteEmail } from '@/hooks/use-queries'
import { EmailDetail } from '@/features/inbox/email-detail'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react'
import { PermanentDeleteDialog } from './permanent-delete-dialog'

// ---------------------------------------------------------------------------
// ArchivedDetail — slim wrapper around the inbox EmailDetail.
//
// The inbox EmailDetail already renders subject, sender card, sanitized HTML
// body, attachments, threads, smart replies, etc. We reuse it verbatim (no
// `onBack` so its toolbar skips the Back button) and prepend a tiny toolbar
// with the two archive-specific actions:
//
//   • Restore           → POST /api/emails/:id/restore (clears isArchived)
//   • Delete permanently → DELETE /api/emails/:id/permanent-delete (hard delete)
//
// On a successful restore / permanent-delete the email leaves the archive, so
// we close the detail pane via `onBack`. The email's subject (for the delete
// dialog) comes from the live `useEmail` query — same cache the EmailDetail
// uses, so this is a zero-cost read.
// ---------------------------------------------------------------------------
export function ArchivedDetail({
  emailId,
  onBack,
}: {
  emailId: string | null
  onBack: () => void
}) {
  const restore = useRestoreEmail()
  const permanentDelete = usePermanentDeleteEmail()
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Same cache the EmailDetail below uses — no extra request. We only read
  // the subject here so the delete dialog can show what's being deleted.
  const { data: email } = useEmail(emailId)

  const handleRestore = () => {
    if (!emailId) return
    restore.mutate(emailId, {
      onSuccess: () => onBack(),
    })
  }

  const handleDeleteClick = () => setDeleteOpen(true)

  const confirmDelete = () => {
    if (!emailId) return
    permanentDelete.mutate(emailId, {
      onSuccess: () => {
        setDeleteOpen(false)
        onBack()
      },
      onSettled: () => setDeleteOpen(false),
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Archive-specific toolbar */}
      <div className="shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center gap-1 px-3 py-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to archive</span>
            <span className="sm:hidden">Back</span>
          </Button>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRestore}
                disabled={!emailId || restore.isPending}
                className="text-primary hover:bg-primary/10 hover:text-primary"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">Restore to inbox</span>
                <span className="sm:hidden">Restore</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move this email back to your inbox</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteClick}
                disabled={!emailId || permanentDelete.isPending}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Delete permanently</span>
                <span className="sm:hidden">Delete</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Permanently delete — cannot be undone</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Reused inbox detail (subject, sender, body, attachments, …).
          No `onBack` so its toolbar skips its own Back button — our toolbar
          above is the single source of navigation for the archive view. */}
      <div className="min-h-0 flex-1">
        <EmailDetail emailId={emailId} />
      </div>

      <PermanentDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={confirmDelete}
        pending={permanentDelete.isPending}
        subject={email?.subject}
      />
    </div>
  )
}
