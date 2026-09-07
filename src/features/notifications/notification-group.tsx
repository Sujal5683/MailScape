'use client'

import { useState } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'
import { CategoryIcon } from '@/components/common/category-icon'
import { colorClass } from '@/lib/category-meta'
import { cn } from '@/lib/utils'
import type { NotificationGroup } from '@/lib/types'
import { NotificationItem } from './notification-item'

export function NotificationGroupSection({ group }: { group: NotificationGroup }) {
  // Default expanded when there are unread items in this group.
  const [open, setOpen] = useState(group.unreadCount > 0)
  const catColor = colorClass(group.color)

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        'overflow-hidden rounded-xl border bg-card',
        catColor,
        'cat-border-soft',
      )}
    >
      <CollapsibleTrigger className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full cat-bg-soft cat-text',
            catColor,
          )}
        >
          <CategoryIcon icon={group.icon} color={group.color} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {group.label}
            </p>
            {group.unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                {group.unreadCount} unread
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {group.count} {group.count === 1 ? 'notification' : 'notifications'}
          </p>
        </div>

        <ChevronRight
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-90',
          )}
          aria-hidden
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="max-h-96 space-y-1.5 overflow-y-auto border-t border-border/60 p-2">
          {group.items.map((item) => (
            <NotificationItem key={item.id} notification={item} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
