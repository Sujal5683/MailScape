'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ---------------------------------------------------------------------------
// PermanentDeleteDialog — shared confirmation used by both the archive list
// rows and the archive detail toolbar. The destructive action is irreversible
// (the route hard-deletes the email and cascades every tied record), so the
// copy is intentionally explicit and the confirm button uses destructive
// styling. Kept as a controlled component so the caller decides when to open
// it (e.g. from an inline Trash2 trigger).
// ---------------------------------------------------------------------------
export function PermanentDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
  subject,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  pending?: boolean
  subject?: string | null
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently delete this email?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <span className="space-y-2">
              <span className="block">
                This email will be permanently deleted and cannot be recovered.
                All associated deadlines, action items, and notifications will
                also be removed.
              </span>
              {subject && (
                <span className="block rounded-md border border-border/70 bg-muted/40 px-2.5 py-1.5 text-xs font-medium text-foreground">
                  {subject}
                </span>
              )}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Prevent Radix from auto-closing before the mutation fires —
              // the caller closes the dialog in its onSuccess/finally.
              e.preventDefault()
              onConfirm()
            }}
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {pending ? 'Deleting…' : 'Delete permanently'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
