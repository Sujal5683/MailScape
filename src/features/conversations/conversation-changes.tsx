'use client'

import { ArrowRight, ExternalLink } from 'lucide-react'
import { formatRelative } from '@/lib/format'
import { useUIStore } from '@/store/ui-store'
import { cn } from '@/lib/utils'
import type { ConversationChange } from '@/lib/conversations/types'

/**
 * "What changed?" view (§12) — renders detected field changes across the
 * conversation. Each row shows the field, the earlier value (struck through
 * and muted), the latest value (highlighted), when it changed, and a link
 * to the source message. When there are no changes, shows an empty hint.
 */
export function ConversationChanges({ changes }: { changes: ConversationChange[] }) {
  const navigate = useUIStore((s) => s.navigate)

  if (changes.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          No detected changes in this conversation.
        </p>
      </div>
    )
  }

  return (
    <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
      {changes.map((c, i) => {
        const key = `${c.field}-${c.sourceMessageId ?? i}`
        return (
          <li
            key={key}
            className="rounded-md border border-border/70 bg-card px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">{c.field}</span>
              {c.changedAt && (
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                  {formatRelative(c.changedAt)}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              {c.earlier ? (
                <span className="text-muted-foreground line-through decoration-muted-foreground/50">
                  {c.earlier}
                </span>
              ) : (
                <span className="italic text-muted-foreground/60">—</span>
              )}
              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              {c.latest ? (
                <span
                  className={cn(
                    'rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary',
                  )}
                >
                  {c.latest}
                </span>
              ) : (
                <span className="italic text-muted-foreground/60">—</span>
              )}
            </div>
            {c.sourceMessageId && (
              <button
                type="button"
                onClick={() => navigate('inbox', { contextEmailId: c.sourceMessageId! })}
                className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-primary"
              >
                <ExternalLink className="h-3 w-3" />
                <span className="truncate">
                  {c.sourceSubject ?? 'Open source message'}
                </span>
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
