'use client'

import * as React from 'react'
import { MoreHorizontal, Pencil, Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { useDeleteConversation, useArchiveConversation } from '@/hooks/use-queries'
import type { AssistantConversationDTO } from '@/lib/types'

// ConversationContextMenu — per-row ⋯ dropdown for the conversation rail.
//
// Renders a compact, touch-friendly (28px) MoreHorizontal trigger that the
// parent row surfaces on hover/focus (desktop) or always (mobile). The menu
// exposes Rename / Archive|Unarchive / Delete, where Delete opens an inline
// AlertDialog confirmation before hard-deleting. All pointer/keyboard events
// on the trigger stopPropagation so opening the menu never selects the row.
export function ConversationContextMenu({
  conversation,
  onRename,
  onDeleted,
}: {
  conversation: AssistantConversationDTO
  onRename: (c: AssistantConversationDTO) => void
  onDeleted?: (id: string) => void
}) {
  const archive = useArchiveConversation()
  const del = useDeleteConversation()
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  const isArchived = !!conversation.archived

  // Block the parent row's onClick from firing when the user interacts with
  // the ⋯ trigger. stopPropagation on both the trigger button and the wrapper
  // covers mouse, keyboard, and touch paths.
  function stop(e: React.SyntheticEvent) {
    e.stopPropagation()
    e.preventDefault()
  }

  async function handleDelete() {
    try {
      await del.mutateAsync(conversation.id)
      onDeleted?.(conversation.id)
    } catch {
      // toast handled by hook's onSuccess; on error we keep the row in place.
    } finally {
      setDeleteOpen(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            // 28px keeps the touch target above the 24px min for mobile while
            // staying compact enough to overlay the row's trailing timestamp.
            className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground"
            onPointerDown={stop}
            onClick={stop}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') stop(e)
            }}
            aria-label={`Actions for ${conversation.title ?? 'conversation'}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onSelect={() => onRename(conversation)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={archive.isPending}
            onSelect={() => archive.mutate({ id: conversation.id, archived: !isArchived })}
          >
            {isArchived ? (
              <ArchiveRestore className="mr-2 h-4 w-4" />
            ) : (
              <Archive className="mr-2 h-4 w-4" />
            )}
            {isArchived ? 'Unarchive' : 'Archive'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              // Prevent the dropdown from auto-closing so the AlertDialog
              // can layer on top cleanly.
              e.preventDefault()
              setDeleteOpen(true)
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the conversation and every message +
              action tied to it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={del.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {del.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
