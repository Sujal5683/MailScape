'use client'

import { useState } from 'react'
import { ChevronDown, Paperclip, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatRelative } from '@/lib/format'
import { useUIStore } from '@/store/ui-store'
import { MESSAGE_TYPE_META } from './conversation-message-types'
import type { ConversationMessage } from '@/lib/conversations/types'

/**
 * Interactive conversation timeline (§9, §10, §11). Each message is a single
 * compact row: dot + sender + subject + time + type label. Clicking a row
 * navigates to that email via useUIStore.navigate. The currently-open email
 * is highlighted. Latest message expanded (snippet shown) by default; an
 * "Expand all" toggle reveals snippets for every message.
 */
export function ConversationTimeline({
  messages,
  currentEmailId,
}: {
  messages: ConversationMessage[]
  currentEmailId: string | null
}) {
  const [allExpanded, setAllExpanded] = useState(false)
  const navigate = useUIStore((s) => s.navigate)
  const latestId = messages[messages.length - 1]?.id ?? null
  const isExpanded = (id: string) => allExpanded || id === latestId

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px] text-muted-foreground"
          onClick={() => setAllExpanded((v) => !v)}
        >
          <ChevronDown className={cn('h-3 w-3 transition-transform', allExpanded && 'rotate-180')} />
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </Button>
      </div>
      <ol className="max-h-80 space-y-0.5 overflow-y-auto pr-1">
        {messages.map((m, i) => {
          const meta = MESSAGE_TYPE_META[m.messageType]
          const isOpen = m.emailId === currentEmailId
          const expanded = isExpanded(m.id)
          const isLast = i === messages.length - 1
          return (
            <li key={m.id} className="relative pl-5">
              {!isLast && <span className="absolute left-[5px] top-3 h-full w-px bg-border" aria-hidden />}
              <span
                className={cn(
                  'absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-background',
                  meta.dot,
                )}
                aria-hidden
              />
              <button
                type="button"
                onClick={() => navigate('inbox', { contextEmailId: m.emailId })}
                aria-current={isOpen ? 'true' : undefined}
                className={cn(
                  'group w-full rounded-md px-2 py-1.5 text-left transition-colors',
                  isOpen ? 'bg-accent' : 'hover:bg-accent/50',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn('truncate text-xs font-medium', m.isRead ? 'text-foreground/90' : 'text-foreground')}>
                    {m.fromName ?? m.fromEmail}
                  </span>
                  {m.isImportant && <Star className="h-3 w-3 shrink-0 fill-warning text-warning" aria-label="Important" />}
                  {m.hasAttachment && <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Has attachment" />}
                  {!m.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{formatRelative(m.receivedAt)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className={cn('truncate text-[11px]', m.isRead ? 'text-muted-foreground' : 'font-medium text-foreground/80')}>
                    {m.subject ?? '(no subject)'}
                  </p>
                  <span className={cn('ml-auto shrink-0 text-[10px] font-medium uppercase tracking-wide', meta.text)}>
                    {meta.label}
                  </span>
                </div>
                {expanded && m.snippet && (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{m.snippet}</p>
                )}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
