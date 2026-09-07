'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, CheckCheck, Trash2 } from 'lucide-react'
import { useMarkNotificationRead, useDeleteNotification } from '@/hooks/use-queries'
import { useUIStore } from '@/store/ui-store'
import { useToast } from '@/hooks/use-toast'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Notification } from '@/lib/types'

type ImportanceMeta = {
  label: string
  variant?: 'destructive' | 'secondary'
  className?: string
}

const IMPORTANCE_META: Record<Notification['importance'], ImportanceMeta> = {
  urgent: { label: 'Urgent', variant: 'destructive' },
  important: {
    label: 'Important',
    className: 'border-transparent bg-warning/15 text-warning',
  },
  normal: {
    label: 'Normal',
    variant: 'secondary',
    className: 'border-transparent bg-muted text-muted-foreground',
  },
}

export function NotificationItem({ notification }: { notification: Notification }) {
  const markRead = useMarkNotificationRead()
  const del = useDeleteNotification()
  const navigate = useUIStore((s) => s.navigate)
  const { toast } = useToast()

  const importance = IMPORTANCE_META[notification.importance]
  const unread = !notification.isRead

  const handleOpen = () => {
    if (notification.emailId) {
      navigate('inbox', { contextEmailId: notification.emailId })
    }
  }

  const handleMarkRead = () => {
    markRead.mutate(notification.id, {
      onSuccess: () => toast({ title: 'Marked as read' }),
    })
  }

  const handleDelete = () => {
    del.mutate(notification.id, {
      onSuccess: () => toast({ title: 'Notification deleted' }),
    })
  }

  return (
    <article
      className={cn(
        'relative rounded-lg border border-border/60 bg-card p-3 transition-colors hover:bg-accent/40',
        unread && 'border-l-2 border-l-primary bg-primary/5 pl-[11px]',
      )}
      aria-label={notification.title}
    >
      <div className="flex items-start gap-2">
        {unread && (
          <span
            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
            aria-label="Unread"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                'text-sm leading-snug',
                unread ? 'font-semibold text-foreground' : 'font-medium text-foreground',
              )}
            >
              {notification.title}
            </p>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {formatRelative(notification.createdAt)}
            </span>
          </div>

          {notification.body && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {notification.body}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant={importance.variant} className={importance.className}>
              {importance.label}
            </Badge>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1">
            {notification.emailId && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleOpen}
                className="h-7 gap-1 px-2 text-xs"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleMarkRead}
              disabled={!unread || markRead.isPending}
              className="h-7 gap-1 px-2 text-xs"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark read
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              disabled={del.isPending}
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </article>
  )
}
