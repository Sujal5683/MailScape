'use client'

import { useState } from 'react'
import { ChevronDown, MessagesSquare, GitCompare } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { ConversationDetail } from '@/lib/conversations/types'
import { ConversationStatusBadge } from './conversation-status-badge'
import { ConversationTimeline } from './conversation-timeline'
import { ConversationChanges } from './conversation-changes'

/**
 * Conversation intelligence panel — combines the status badge, the message
 * timeline, and the "What changed?" view into one collapsible card with a
 * Messages/Changes tab toggle. Used inside EmailDetail, below the body.
 *
 * Loading → inline skeleton. No conversation (or only one message) → null.
 */
export function ConversationPanel({
  conversation,
  isLoading,
  currentEmailId,
}: {
  conversation: ConversationDetail | null | undefined
  isLoading: boolean
  currentEmailId: string | null
}) {
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState<'messages' | 'changes'>('messages')

  if (isLoading) return <ConversationPanelSkeleton />
  if (!conversation || conversation.messageCount <= 1) return null

  const participantCount = conversation.participants.length || 1
  const changeCount = conversation.changes.length

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-6 overflow-hidden rounded-xl border bg-card">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-accent/40"
          aria-expanded={open}
        >
          <MessagesSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-semibold">Conversation</span>
          <span className="text-xs text-muted-foreground">
            {conversation.messageCount} message{conversation.messageCount === 1 ? '' : 's'} · {participantCount} participant{participantCount === 1 ? '' : 's'}
          </span>
          <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 border-t px-4 py-3">
          <ConversationStatusBadge
            status={conversation.status}
            followUpState={conversation.followUpState}
            importance={conversation.importance}
          />
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'messages' | 'changes')}>
            <TabsList className="h-8">
              <TabsTrigger value="messages" className="gap-1 px-2 text-xs">
                <MessagesSquare className="h-3.5 w-3.5" />
                Messages
              </TabsTrigger>
              <TabsTrigger value="changes" className="gap-1 px-2 text-xs">
                <GitCompare className="h-3.5 w-3.5" />
                Changes
                {changeCount > 0 && (
                  <span className="ml-0.5 rounded bg-primary/15 px-1 text-[10px] font-semibold text-primary">
                    {changeCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="messages" className="mt-3">
              <ConversationTimeline messages={conversation.messages} currentEmailId={currentEmailId} />
            </TabsContent>
            <TabsContent value="changes" className="mt-3">
              <ConversationChanges changes={conversation.changes} />
            </TabsContent>
          </Tabs>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function ConversationPanelSkeleton() {
  return (
    <div className="mb-6 space-y-3 rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="space-y-2 border-t pt-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-56" />
        <div className="space-y-1.5 pt-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
