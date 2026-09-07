'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUpdateAssistantConversation } from '@/hooks/use-queries'
import type { AssistantConversationDTO } from '@/lib/types'

// RenameDialog — a small, focused dialog for editing a conversation's title.
//
// The dialog is controlled: the parent owns the `conversation` (or null) and
// renders us only when a rename is in progress. We keep a local copy of the
// title in state so the user can type freely without round-tripping to the
// server on every keystroke; the save button calls useUpdateAssistantConversation
// with the trimmed value.
export function RenameDialog({
  conversation,
  onOpenChange,
}: {
  conversation: AssistantConversationDTO | null
  onOpenChange: (open: boolean) => void
}) {
  const update = useUpdateAssistantConversation()
  const [title, setTitle] = React.useState('')

  // Sync local state when a new conversation is passed in. This is a
  // derived-state-from-props pattern (the lint-safe alternative to
  // setState-in-effect): we only re-seed when the conversation id changes.
  const [seededFor, setSeededFor] = React.useState<string | null>(null)
  if (conversation && conversation.id !== seededFor) {
    setSeededFor(conversation.id)
    setTitle(conversation.title ?? '')
  }
  if (!conversation && seededFor !== null) {
    setSeededFor(null)
    setTitle('')
  }

  const trimmed = title.trim()
  const canSave = trimmed.length > 0 && trimmed.length <= 120 && !update.isPending

  async function handleSave() {
    if (!conversation || !canSave) return
    try {
      await update.mutateAsync({ id: conversation.id, title: trimmed })
      onOpenChange(false)
    } catch {
      // toast handled by the hook's onSuccess; the mutate will surface
      // errors via the hook's error state, which we deliberately swallow
      // here so the dialog stays open for retry.
    }
  }

  return (
    <Dialog open={!!conversation} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename conversation</DialogTitle>
          <DialogDescription>
            Give this conversation a clearer name. You can change it again anytime.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Conversation title"
            maxLength={120}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSave) {
                e.preventDefault()
                void handleSave()
              }
            }}
            aria-label="Conversation title"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            {title.length}/120 characters
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={update.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
