'use client'

import { useState, useMemo } from 'react'
import { useDeadlines, useActionItems, useUpdateDeadline, useDeleteDeadline, useUpdateActionItem } from '@/hooks/use-queries'
import { useUIStore } from '@/store/ui-store'
import { CategoryIcon } from '@/components/common/category-icon'
import { colorClass } from '@/lib/category-meta'
import { formatDate, formatRelative, daysUntil } from '@/lib/format'
import { EmptyState } from '@/components/common/states'
import { SleekSeparator } from '@/components/common/separator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { PaneScroll } from '@/components/ui/pane-scroll'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CalendarClock, Check, Clock, AlertTriangle, Trash2, Inbox, ChevronRight, ListChecks, CircleDot, X } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { Deadline, ActionItem } from '@/lib/types'

type FilterKey = 'all' | 'open' | 'done' | 'missed'

export function DeadlinesView() {
  const [filter, setFilter] = useState<FilterKey>('all')
  const { data: deadlines, isLoading, error } = useDeadlines('all')
  const { data: actionItems } = useActionItems()

  const stats = useMemo(() => {
    const list = deadlines ?? []
    const now = Date.now()
    const open = list.filter((d) => d.status === 'open')
    const overdue = open.filter((d) => {
      if (!d.dueAt) return false
      return new Date(d.dueAt).getTime() < now
    })
    const weekFromNow = new Date(now + 7 * 24 * 60 * 60 * 1000)
    const dueThisWeek = open.filter((d) => {
      if (!d.dueAt) return false
      const t = new Date(d.dueAt).getTime()
      return t >= now && t <= weekFromNow.getTime()
    })
    return { total: open.length, overdue: overdue.length, dueThisWeek: dueThisWeek.length, done: list.filter((d) => d.status === 'done').length }
  }, [deadlines])

  const filtered = useMemo(() => {
    const list = deadlines ?? []
    if (filter === 'all') return list
    return list.filter((d) => d.status === filter)
  }, [deadlines, filter])

  const grouped = useMemo(() => {
    const open = filtered.filter((d) => d.status === 'open').sort((a, b) => {
      if (!a.dueAt) return 1
      if (!b.dueAt) return -1
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    })
    const done = filtered.filter((d) => d.status === 'done')
    const missed = filtered.filter((d) => d.status === 'missed')
    return { open, done, missed }
  }, [filtered])

  return (
    <PaneScroll>
      <div className="mx-auto max-w-6xl p-4 pb-20 md:p-6 md:pb-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Deadlines &amp; Action Items</h2>
            <p className="text-sm text-muted-foreground">
              Tracked deadlines extracted from your institutional emails, with action items from the AI assistant.
            </p>
          </div>
        </div>

        {/* Summary stat cards */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <StatCard icon={CalendarClock} label="Open deadlines" value={stats.total} tone="default" />
          <StatCard icon={AlertTriangle} label="Overdue" value={stats.overdue} tone={stats.overdue > 0 ? 'danger' : 'default'} />
          <StatCard icon={Clock} label="Due this week" value={stats.dueThisWeek} tone={stats.dueThisWeek > 0 ? 'warning' : 'default'} />
        </div>

        <SleekSeparator className="mb-5" />

        {/* Filter segmented control */}
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          {(['all', 'open', 'done', 'missed'] as FilterKey[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors',
                filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {f === 'all' ? `All (${(deadlines ?? []).length})` : f === 'open' ? `Open (${stats.total})` : f === 'done' ? `Done (${stats.done})` : 'Missed'}
            </button>
          ))}
        </div>

        <SleekSeparator className="mb-6" />

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Deadlines column */}
          <div className="space-y-4">
            {isLoading ? (
              <DeadlineSkeleton />
            ) : error ? (
              <EmptyState title="Couldn't load deadlines" description={error.message} />
            ) : (deadlines ?? []).length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="No deadlines tracked yet"
                description="The system extracts deadlines from emails containing phrases like 'submit by', 'due in 10 days', 'register by Friday'. Ask the AI assistant to track a specific deadline."
              />
            ) : (
              <>
                {grouped.open.length > 0 && (filter === 'all' || filter === 'open') && (
                  <DeadlineSection title="Open" items={grouped.open} defaultOpen />
                )}
                {filter === 'all' && grouped.open.length > 0 && grouped.missed.length > 0 && (
                  <SleekSeparator />
                )}
                {grouped.missed.length > 0 && (filter === 'all' || filter === 'missed') && (
                  <DeadlineSection title="Missed" items={grouped.missed} tone="warning" />
                )}
                {filter === 'all' && grouped.missed.length > 0 && grouped.done.length > 0 && (
                  <SleekSeparator />
                )}
                {grouped.done.length > 0 && (filter === 'all' || filter === 'done') && (
                  <DeadlineSection title="Done" items={grouped.done} tone="success" />
                )}
                {filter !== 'all' && filtered.length === 0 && (
                  <EmptyState icon={CalendarClock} title={`No ${filter} deadlines`} description="Try a different filter." />
                )}
              </>
            )}
          </div>

          {/* Action items column */}
          <div>
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ListChecks className="h-4 w-4 text-muted-foreground" /> Action Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ActionItemsList items={actionItems ?? []} isLoading={!actionItems} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PaneScroll>
  )
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof CalendarClock; label: string; value: number; tone: 'default' | 'warning' | 'danger' }) {
  return (
    <div className={cn(
      'rounded-xl border p-3',
      tone === 'danger' ? 'border-destructive/30 bg-destructive/5' : tone === 'warning' ? 'border-warning/30 bg-warning/5' : 'border-border/60 bg-card',
    )}>
      <div className="flex items-center gap-2">
        <div className={cn(
          'flex h-7 w-7 items-center justify-center rounded-lg',
          tone === 'danger' ? 'bg-destructive/15 text-destructive' : tone === 'warning' ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground',
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function DeadlineSection({ title, items, tone = 'default', defaultOpen = true }: { title: string; items: Deadline[]; tone?: 'default' | 'warning' | 'success'; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="mb-2 flex w-full items-center gap-2 text-sm font-medium"
      >
        <CircleDot className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
        <span>{title}</span>
        <Badge variant="secondary" className="ml-1 text-xs">{items.length}</Badge>
      </button>
      {open && (
        <div className="space-y-2">
          {items.map((d, i) => (
            <DeadlineItem key={d.id} deadline={d} index={i} tone={tone} />
          ))}
        </div>
      )}
    </div>
  )
}

function DeadlineItem({ deadline: d, index, tone }: { deadline: Deadline; index: number; tone: 'default' | 'warning' | 'success' }) {
  const update = useUpdateDeadline()
  const del = useDeleteDeadline()
  const navigate = useUIStore((s) => s.navigate)
  const reduce = useReducedMotion()
  const catColor = d.categoryName ? 'cat-slate' : 'cat-slate'
  const due = d.dueAt ? daysUntil(d.dueAt) : null
  const isOverdue = d.status === 'open' && due !== null && due < 0
  const isDueSoon = d.status === 'open' && due !== null && due >= 0 && due <= 3
  const isDone = d.status === 'done'
  const isMissed = d.status === 'missed'

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduce ? 0 : Math.min(index * 0.04, 0.3), duration: 0.2 }}
      className={cn(
        'group relative flex items-start gap-3 rounded-lg border p-3 transition-colors',
        isOverdue ? 'border-destructive/30 bg-destructive/5' : isDueSoon ? 'border-warning/30 bg-warning/5' : 'border-border/60 bg-card hover:bg-accent/40',
        isDone && 'opacity-60',
      )}
    >
      {/* Timeline dot */}
      <div className="mt-0.5 flex flex-col items-center">
        <span className={cn(
          'h-2.5 w-2.5 rounded-full ring-2 ring-background',
          isOverdue ? 'bg-destructive' : isDueSoon ? 'bg-warning' : isDone ? 'bg-success' : isMissed ? 'bg-muted-foreground' : 'bg-primary',
        )} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <button
            onClick={() => d.emailId && navigate('inbox', { contextEmailId: d.emailId })}
            className={cn('min-w-0 flex-1 text-left text-sm font-medium hover:text-primary', isDone && 'line-through')}
            disabled={!d.emailId}
          >
            {d.title}
          </button>
          <div className="flex shrink-0 items-center gap-1">
            {isOverdue && <Badge variant="destructive" className="text-[10px]">{Math.abs(due!)}d overdue</Badge>}
            {due === 0 && d.status === 'open' && <Badge variant="destructive" className="text-[10px]">Due today</Badge>}
            {isDueSoon && due! > 0 && <Badge variant="secondary" className="bg-warning/15 text-warning text-[10px]">in {due}d</Badge>}
            {d.status === 'open' && due !== null && due > 3 && <Badge variant="secondary" className="text-[10px]">in {due}d</Badge>}
            {d.status === 'open' && due === null && <Badge variant="secondary" className="text-[10px]">No date</Badge>}
            {isMissed && <Badge variant="secondary" className="text-[10px]">Missed</Badge>}
          </div>
        </div>

        {d.emailSubject && (
          <p className="truncate text-xs text-muted-foreground">{d.emailSubject}</p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {d.dueAt && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              {formatDate(d.dueAt)}
            </span>
          )}
          {d.categoryName && (
            <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 cat-bg-soft cat-text', colorClass(d.categoryColor ?? 'slate'))}>
              <CategoryIcon icon="folder" color={d.categoryColor ?? 'slate'} className="h-3 w-3" />
              {d.categoryName}
            </span>
          )}
          {d.confidence != null && (
            <span className="inline-flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">{(d.confidence * 100).toFixed(0)}% confidence</span>
                  </TooltipTrigger>
                  <TooltipContent>Extraction confidence from the source email</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        {d.status === 'open' && (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-success"
                    onClick={() => update.mutate({ id: d.id, status: 'done' })}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mark done</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-warning"
                    onClick={() => update.mutate({ id: d.id, status: 'missed' })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mark missed</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
        {d.status !== 'open' && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => update.mutate({ id: d.id, status: 'open' })}
          >
            Reopen
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this deadline?</AlertDialogTitle>
              <AlertDialogDescription>
                "{d.title}" will be permanently removed. The source email is not affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => del.mutate(d.id)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </motion.div>
  )
}

function ActionItemsList({ items, isLoading }: { items: ActionItem[]; isLoading: boolean }) {
  const update = useUpdateActionItem()
  const navigate = useUIStore((s) => s.navigate)
  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />)}</div>
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No action items"
        description="The AI assistant extracts action items from your emails when you ask."
        className="border-0 p-4"
      />
    )
  }
  return (
    <div className="space-y-2">
      {items.map((a) => (
        <div key={a.id} className="flex items-start gap-3 rounded-md p-2 hover:bg-accent/40">
          <Checkbox
            checked={a.status === 'done'}
            onCheckedChange={() => update.mutate({ id: a.id, status: a.status === 'done' ? 'open' : 'done' })}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <button
              onClick={() => a.emailId && navigate('inbox', { contextEmailId: a.emailId })}
              className={cn('block text-left text-sm hover:text-primary', a.status === 'done' && 'line-through text-muted-foreground')}
              disabled={!a.emailId}
            >
              {a.title}
            </button>
            {a.dueAt && (
              <p className="text-[11px] text-muted-foreground">Due {formatDate(a.dueAt)}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function DeadlineSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
          <div className="h-2.5 w-2.5 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-muted" />
            <div className="h-3 w-1/3 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}
