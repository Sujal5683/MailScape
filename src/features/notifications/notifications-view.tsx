'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { NotificationGroupSkeleton } from '@/components/common/skeletons'
import { EmptyState, ErrorState } from '@/components/common/states'
import { CheckCheck, Bell, BellOff } from 'lucide-react'
import {
  useNotifications,
  useMarkAllNotificationsRead,
} from '@/hooks/use-queries'
import { useToast } from '@/hooks/use-toast'
import { SleekSeparator } from '@/components/common/separator'
import { NotificationGroupSection } from './notification-group'
import { Fragment } from 'react'

type Filter = 'all' | 'unread' | 'important'

export function NotificationsView() {
  const [filter, setFilter] = useState<Filter>('all')

  // Active filter drives the visible list.
  const { data, isLoading, error, refetch } = useNotifications(filter)
  // Always-on 'all' query so we can tell "no notifications at all" apart
  // from "this filter is empty but others exist". Deduped by TanStack when
  // filter === 'all'.
  const allQuery = useNotifications('all')

  const markAllRead = useMarkAllNotificationsRead()
  const { toast } = useToast()

  const groups = data ?? []
  const visibleItems = groups.reduce((acc, g) => acc + g.count, 0)
  const globalUnread = (allQuery.data ?? []).reduce(
    (acc, g) => acc + g.unreadCount,
    0,
  )
  const totalAllItems = (allQuery.data ?? []).reduce(
    (acc, g) => acc + g.count,
    0,
  )

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => toast({ title: 'All notifications marked as read' }),
    })
  }

  const showEmptyState = !isLoading && !error && visibleItems === 0
  const noNotificationsAtAll = totalAllItems === 0

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 p-4 pb-20 md:pb-6">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              Notifications
            </h1>
            <p className="text-xs text-muted-foreground">
              Grouped alerts across your inbox
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markAllRead.isPending || globalUnread === 0}
            className="shrink-0"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        </header>

        {/* Filter tabs */}
        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as Filter)}
          className="gap-3"
        >
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="important">Important</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Body */}
        {isLoading ? (
          <NotificationGroupSkeleton />
        ) : error ? (
          <ErrorState
            title="Couldn't load notifications"
            description={error.message}
            onRetry={() => refetch()}
          />
        ) : showEmptyState ? (
          noNotificationsAtAll ? (
            <EmptyState
              icon={Bell}
              title="No notifications"
              description="You're all caught up."
            />
          ) : filter === 'unread' ? (
            <EmptyState
              icon={BellOff}
              title="No unread notifications"
              description="You've read everything in this view."
            />
          ) : (
            <EmptyState
              icon={BellOff}
              title="No important notifications"
              description="Nothing flagged as important right now."
            />
          )
        ) : (
          <section className="space-y-3">
            {groups.map((group, idx) => (
              <Fragment key={group.key}>
                <NotificationGroupSection group={group} />
                {idx < groups.length - 1 && <SleekSeparator />}
              </Fragment>
            ))}
          </section>
        )}
      </div>
    </div>
  )
}
