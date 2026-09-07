'use client'

// =============================================================================
// DashboardView — operational command center for the Institutional Email
// Intelligence app. Enhanced dashboard with animated KPI cards + sparklines,
// a gradient 14-day trend chart, a category distribution donut, top-sender
// bars, a deadline timeline, a deterministic "needs attention" panel, a recent
// activity stream, an AI brief with mini stat cards, and an action-items
// checklist. All sections hydrate behind skeletons via the single
// useDashboard() query (returns DashboardData).
// =============================================================================

import {
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import {
  Mail,
  MailOpen,
  Star,
  Paperclip,
  Users,
  CalendarClock,
  Bell,
  Sparkles,
  Clock,
  AlertTriangle,
  Inbox,
  ArrowUpRight,
  ArrowRight,
  CheckCircle2,
  Circle,
  Plus,
  type LucideIcon,
} from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useMemo, useState } from 'react'

import { useDashboard, useAccounts } from '@/hooks/use-queries'
import { useUIStore } from '@/store/ui-store'
import type { DashboardData, Deadline } from '@/lib/types'
import { formatDate, formatRelative, daysUntil } from '@/lib/format'
import { colorClass } from '@/lib/category-meta'
import { cn } from '@/lib/utils'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardAction,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { CategoryDot, CategoryIcon } from '@/components/common/category-icon'
import { SleekSeparator } from '@/components/common/separator'
import { StatsSkeleton, ChartSkeleton } from '@/components/common/skeletons'
import { ErrorState, EmptyState } from '@/components/common/states'
import { WeeklyDigestCard } from './weekly-digest-card'
import { SyncStatusWidget } from '@/features/scan/sync-status-widget'

// -----------------------------------------------------------------------------
// Constants — the ONE allowed inline color usage (data-viz category colors).
// Maps a category color name (from category-meta) to an oklch string for
// recharts <Cell fill>. Everything else uses semantic Tailwind tokens.
// -----------------------------------------------------------------------------

const OKLCH_COLOR_MAP: Record<string, string> = {
  amber: 'oklch(0.75 0.16 75)',
  blue: 'oklch(0.62 0.17 245)',
  violet: 'oklch(0.62 0.2 300)',
  teal: 'oklch(0.65 0.13 180)',
  rose: 'oklch(0.65 0.2 15)',
  red: 'oklch(0.62 0.22 25)',
  orange: 'oklch(0.7 0.17 55)',
  fuchsia: 'oklch(0.65 0.22 330)',
  green: 'oklch(0.65 0.16 150)',
  slate: 'oklch(0.6 0.02 250)',
}

function oklchFor(color: string | null | undefined): string {
  if (!color) return OKLCH_COLOR_MAP.slate!
  return OKLCH_COLOR_MAP[color] ?? OKLCH_COLOR_MAP.slate!
}

// -----------------------------------------------------------------------------
// Shared helpers
// -----------------------------------------------------------------------------

type Tone = 'default' | 'warning' | 'destructive' | 'success'

function toneTextClass(tone: Tone): string {
  switch (tone) {
    case 'warning':
      return 'text-warning'
    case 'destructive':
      return 'text-destructive'
    case 'success':
      return 'text-success'
    default:
      return 'text-foreground'
  }
}

function toneBadgeClass(tone: Tone): string {
  switch (tone) {
    case 'warning':
      return 'bg-warning/15 text-warning border-warning/30'
    case 'destructive':
      return 'bg-destructive/15 text-destructive border-destructive/30'
    case 'success':
      return 'bg-success/15 text-success border-success/30'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

function toneIconWrapClass(tone: Tone): string {
  switch (tone) {
    case 'warning':
      return 'bg-warning/10 text-warning'
    case 'destructive':
      return 'bg-destructive/10 text-destructive'
    case 'success':
      return 'bg-success/10 text-success'
    default:
      return 'bg-primary/10 text-primary'
  }
}

/** Parse a YYYY-MM-DD trend date label into a short "Mon D" string. */
function formatTrendDate(iso: string): string {
  // Append T00:00:00 to avoid UTC-shifted day display.
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function getInitial(name: string | null, email: string): string {
  const src = (name ?? email).trim()
  return src ? src[0]!.toUpperCase() : '?'
}

/** Build a categoryId → color lookup so deadlines can render the right dot. */
function buildCategoryColorMap(data: DashboardData | undefined): Map<string, string> {
  if (!data) return new Map()
  return new Map(data.categoryCounts.map((c) => [c.id, c.color]))
}

/** Rotate through the category color names for sender bars (no per-sender category in summary). */
function senderColorAt(index: number, colors: string[]): string {
  if (colors.length === 0) return 'slate'
  return colors[index % colors.length]!
}

// -----------------------------------------------------------------------------
// Motion variants — respect prefers-reduced-motion.
// -----------------------------------------------------------------------------

function useStaggerVariants() {
  const prefersReducedMotion = useReducedMotion()
  return useMemo(
    () => ({
      container: {
        hidden: { opacity: prefersReducedMotion ? 1 : 0 },
        show: {
          opacity: 1,
          transition: { staggerChildren: prefersReducedMotion ? 0 : 0.05 },
        },
      },
      item: {
        hidden: { opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : 8 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.3, ease: 'easeOut' as const },
        },
      },
    }),
    [prefersReducedMotion],
  )
}

// -----------------------------------------------------------------------------
// Main view
// -----------------------------------------------------------------------------

export function DashboardView() {
  const { data, isLoading, isError, refetch } = useDashboard()
  const { data: accounts } = useAccounts()
  const navigate = useUIStore((s) => s.navigate)
  const variants = useStaggerVariants()

  // Category name → color map, passed to the WeeklyDigestCard so its deadline
  // swatches match the rest of the dashboard. Derived from the dashboard's
  // categoryCounts (already fetched) so no extra query is needed.
  const categoryColors = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {}
    for (const c of data?.categoryCounts ?? []) m[c.name] = c.color
    return m
  }, [data])

  // ── No-accounts landing state ──────────────────────────────────────────────
  // When a user first logs in they have zero Google accounts connected.
  // Show a welcoming hero instead of empty/broken charts.
  const hasNoAccounts = !isLoading && Array.isArray(accounts) && accounts.length === 0
  if (hasNoAccounts) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background p-8">
        <div className="flex max-w-md flex-col items-center gap-6 text-center">
          {/* Animated mail icon */}
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
            <Mail className="h-10 w-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome to MailScape</h1>
            <p className="text-sm text-muted-foreground">
              Connect your Google account to start syncing your inbox, organising emails into
              smart categories, and getting AI-powered insights.
            </p>
          </div>

          {/* CTA */}
          <Button
            size="lg"
            className="gap-2"
            onClick={() => {
              // Trigger NextAuth Google OAuth flow
              // Import is dynamic to avoid loading next-auth on server
              import('next-auth/react').then(({ signIn }) => signIn('google'))
            }}
          >
            <Plus className="h-4 w-4" />
            Connect Google Account
          </Button>

          <p className="text-xs text-muted-foreground">
            Or go to{' '}
            <button
              className="underline underline-offset-2 hover:text-foreground"
              onClick={() => navigate('settings')}
            >
              Settings → Connected Accounts
            </button>{' '}
            to manage your mailboxes.
          </p>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="h-full overflow-y-auto bg-background">
        <div className="mx-auto max-w-3xl p-6 pb-20 md:pb-6">
          <ErrorState
            title="Couldn't load the dashboard"
            description="The aggregated overview failed to load. You can try again."
            onRetry={() => refetch()}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-7xl space-y-6 p-4 pb-20 md:p-6 md:pb-6">
        {/* ----------------------------------------------------------------- */}
        {/* Header                                                            */}
        {/* ----------------------------------------------------------------- */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Operational overview of your inbox — synced in real time.
            </p>
          </div>
          <Button onClick={() => navigate('assistant')} className="self-start sm:self-auto">
            <Sparkles className="h-4 w-4" />
            Ask AI
          </Button>
        </header>

        {/* ----------------------------------------------------------------- */}
        {/* KPI row — animated stagger                                        */}
        {/* ----------------------------------------------------------------- */}
        <section aria-label="Key metrics">
          {isLoading || !data ? (
            <StatsSkeleton count={8} />
          ) : (
            <motion.div
              variants={variants.container}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
            >
              <KpiGrid data={data} variants={variants.item} />
            </motion.div>
          )}
        </section>

        {/* Sync status widget — surfaces live sync health + new-message count
            and gives a one-click "Scan now" / "Sync now" entry point. Placed
            beside the KPI row so users see mailbox sync state at a glance. */}
        <section aria-label="Sync status" className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <SyncStatusWidget />
          </div>
        </section>

        <SleekSeparator />

        {/* ----------------------------------------------------------------- */}
        {/* AI Brief + Needs attention (top-right)                            */}
        {/* ----------------------------------------------------------------- */}
        <section className="grid gap-4 lg:grid-cols-3" aria-label="Brief and attention">
          <div className="lg:col-span-2">
            {isLoading || !data ? <BriefSkeleton /> : <AiBriefCard data={data} />}
          </div>
          <div>
            {isLoading || !data ? (
              <NeedsAttentionSkeleton />
            ) : (
              <NeedsAttentionCard data={data} />
            )}
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Weekly digest — on-demand AI synthesis of the last 7 days         */}
        {/* (richer than the deterministic AI Brief; generated via the LLM)   */}
        {/* ----------------------------------------------------------------- */}
        <section aria-label="Weekly digest">
          <WeeklyDigestCard categoryColors={categoryColors} />
        </section>

        <SleekSeparator />

        {/* ----------------------------------------------------------------- */}
        {/* Middle section — trend chart (span 2) + donut (span 1)            */}
        {/* ----------------------------------------------------------------- */}
        <section className="grid gap-4 lg:grid-cols-3" aria-label="Activity and sections">
          <div className="lg:col-span-2">
            {isLoading || !data ? (
              <ChartSkeleton />
            ) : (
              <TrendCard trend={data.trend} />
            )}
          </div>
          <div>
            {isLoading || !data ? (
              <DonutSkeleton />
            ) : (
              <CategoryDonutCard data={data} />
            )}
          </div>
        </section>

        <SleekSeparator />

        {/* ----------------------------------------------------------------- */}
        {/* Three column lists: senders, deadlines, recent activity           */}
        {/* ----------------------------------------------------------------- */}
        <section className="grid gap-4 lg:grid-cols-3" aria-label="Lists">
          <TopSendersCard data={data} loading={isLoading} />
          <DeadlinesCard data={data} loading={isLoading} />
          <RecentActivityCard data={data} loading={isLoading} />
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Action items (if any)                                             */}
        {/* ----------------------------------------------------------------- */}
        <section aria-label="Action items">
          {isLoading || !data ? null : data.actionItems.length > 0 ? (
            <>
              <SleekSeparator />
              <ActionItemsCard data={data} />
            </>
          ) : null}
        </section>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// KPI grid + sparkline
// -----------------------------------------------------------------------------

interface KpiDef {
  key: string
  label: string
  icon: LucideIcon
  value: number
  context: string
  tone: Tone
  spark?: number[]
  delta?: string
  onClick?: () => void
}

function buildKpis(data: DashboardData, navigate: (view: 'inbox' | 'notifications', ctx?: { contextSearchQuery?: string }) => void): KpiDef[] {
  const t = data.totals
  const trendCounts = data.trend.map((d) => d.count)
  const todayCount = trendCounts[trendCounts.length - 1] ?? 0
  return [
    {
      key: 'emails',
      label: 'Total Emails',
      icon: Mail,
      value: t.emails,
      context: `${t.categories} sections`,
      tone: 'default',
      spark: trendCounts,
    },
    {
      key: 'unread',
      label: 'Unread',
      icon: MailOpen,
      value: t.unread,
      context: t.unread > 0 ? 'needs attention' : 'all caught up',
      tone: t.unread > 0 ? 'warning' : 'success',
      delta: t.unread > 0 ? `+${todayCount} today` : 'inbox zero',
      onClick: () => navigate('inbox', { contextSearchQuery: 'is:unread' }),
    },
    {
      key: 'important',
      label: 'Important',
      icon: Star,
      value: t.important,
      context: t.important > 0 ? 'flagged' : 'none flagged',
      tone: 'default',
      delta: t.important > 0 ? `${t.important} flagged` : 'none flagged',
      onClick: () => navigate('inbox', { contextSearchQuery: 'is:important' }),
    },
    {
      key: 'attachments',
      label: 'Attachments',
      icon: Paperclip,
      value: t.attachments,
      context: 'emails with files',
      tone: 'default',
      delta: `${t.attachments} files`,
    },
    {
      key: 'senders',
      label: 'Senders',
      icon: Users,
      value: t.senders,
      context: 'active contacts',
      tone: 'default',
      delta: `${t.senders} contacts`,
    },
    {
      key: 'deadlines',
      label: 'Open Deadlines',
      icon: CalendarClock,
      value: t.deadlinesOpen,
      context: t.deadlinesOpen > 0 ? 'pending action' : 'none open',
      tone: t.deadlinesOpen > 0 ? 'warning' : 'success',
      delta: t.deadlinesOpen > 0 ? `${t.deadlinesOpen} open` : 'all clear',
    },
    {
      key: 'notifications',
      label: 'Unread Alerts',
      icon: Bell,
      value: t.notificationsUnread,
      context: t.notificationsUnread > 0 ? 'new notifications' : 'inbox quiet',
      tone: t.notificationsUnread > 0 ? 'destructive' : 'success',
      delta: t.notificationsUnread > 0 ? `${t.notificationsUnread} new` : 'all read',
      onClick: () => navigate('notifications'),
    },
    {
      key: 'sections',
      label: 'Sections',
      icon: Inbox,
      value: t.categories,
      context: 'organized buckets',
      tone: 'default',
      delta: `${t.categories} sections`,
    },
  ]
}

function KpiGrid({ data, variants }: { data: DashboardData; variants: any }) {
  const navigate = useUIStore((s) => s.navigate)
  const kpis = buildKpis(data, (view, ctx) => navigate(view, ctx))
  return (
    <>
      {kpis.map((k) => (
        <motion.div key={k.key} variants={variants}>
          <KpiCard def={k} />
        </motion.div>
      ))}
    </>
  )
}

function KpiCard({ def }: { def: KpiDef }) {
  const Icon = def.icon
  return (
    <Card
      className={cn(
        'gap-0 py-4 transition-transform hover:-translate-y-0.5',
        def.onClick && 'cursor-pointer',
      )}
      onClick={def.onClick}
      role={def.onClick ? 'button' : undefined}
      tabIndex={def.onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (def.onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          def.onClick()
        }
      }}
    >
      <CardContent className="space-y-2 px-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium text-muted-foreground">
            {def.label}
          </span>
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
              toneIconWrapClass(def.tone),
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className={cn('text-2xl font-semibold tabular-nums leading-none', toneTextClass(def.tone))}>
          {def.value.toLocaleString()}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] text-muted-foreground">{def.context}</span>
          {def.spark && def.spark.length > 1 ? (
            <Sparkline data={def.spark} />
          ) : def.delta ? (
            <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
              {def.delta}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function Sparkline({ data, color = 'var(--color-primary)' }: { data: number[]; color?: string }) {
  const chartData = data.map((v, i) => ({ i, v }))
  return (
    <div className="h-6 w-20 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 1, right: 1, bottom: 1, left: 1 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// -----------------------------------------------------------------------------
// AI brief — summary + 4 mini stat cards with icons + Ask AI button
// -----------------------------------------------------------------------------

const HIGHLIGHT_ICONS: LucideIcon[] = [MailOpen, CalendarClock, Star, Users]

function AiBriefCard({ data }: { data: DashboardData }) {
  const navigate = useUIStore((s) => s.navigate)
  const brief = data.aiBrief
  return (
    <Card className="h-full gap-0 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          AI Brief
        </CardTitle>
        <CardDescription className="sr-only">
          Auto-generated summary of your inbox state
        </CardDescription>
        <CardAction>
          <Button size="sm" variant="outline" onClick={() => navigate('assistant')}>
            <Sparkles className="h-3.5 w-3.5" />
            Ask AI
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-foreground">{brief.summary}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {brief.highlights.slice(0, 4).map((h, i) => {
            const Icon = HIGHLIGHT_ICONS[i % HIGHLIGHT_ICONS.length]!
            return (
              <div
                key={h.label}
                className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2"
              >
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-[11px] uppercase tracking-wide">{h.label}</span>
                </div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                  {h.value}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function BriefSkeleton() {
  return (
    <Card className="h-full gap-0">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border/60 p-2 space-y-1.5">
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// "Needs your attention" — deterministic smart panel
// -----------------------------------------------------------------------------

interface AttentionItem {
  key: string
  label: string
  count: number
  tone: Tone
  icon: LucideIcon
  onClick?: () => void
}

function buildAttentionItems(data: DashboardData, navigate: (view: any, ctx?: any) => void): AttentionItem[] {
  const items: AttentionItem[] = []
  if (data.totals.important > 0) {
    items.push({
      key: 'important',
      label: 'Important emails need replies',
      count: data.totals.important,
      tone: 'warning',
      icon: Star,
      onClick: () => navigate('inbox', { contextSearchQuery: 'is:important' }),
    })
  }
  const overdue = data.deadlines.filter((d) => {
    const days = daysUntil(d.dueAt)
    return days !== null && days < 0
  })
  if (overdue.length > 0) {
    items.push({
      key: 'overdue',
      label: 'Deadline overdue',
      count: overdue.length,
      tone: 'destructive',
      icon: CalendarClock,
      onClick: () =>
        navigate('inbox', { contextEmailId: overdue[0]!.emailId ?? null }),
    })
  }
  if (data.totals.notificationsUnread > 0) {
    items.push({
      key: 'notifications',
      label: 'Unread urgent notifications',
      count: data.totals.notificationsUnread,
      tone: 'destructive',
      icon: Bell,
      onClick: () => navigate('notifications'),
    })
  }
  if (data.totals.unread > 0 && data.totals.important === 0) {
    items.push({
      key: 'unread',
      label: 'Unread emails waiting',
      count: data.totals.unread,
      tone: 'warning',
      icon: MailOpen,
      onClick: () => navigate('inbox', { contextSearchQuery: 'is:unread' }),
    })
  }
  return items
}

function buildRecommendation(data: DashboardData): string {
  const parts: string[] = []
  if (data.totals.important > 0) {
    parts.push(`${data.totals.important} important email${data.totals.important === 1 ? '' : 's'} need${data.totals.important === 1 ? 's' : ''} replies`)
  }
  const overdue = data.deadlines.filter((d) => {
    const days = daysUntil(d.dueAt)
    return days !== null && days < 0
  })
  if (overdue.length > 0) {
    parts.push(`${overdue.length} deadline${overdue.length === 1 ? '' : 's'} overdue`)
  }
  if (data.totals.notificationsUnread > 0) {
    parts.push(`${data.totals.notificationsUnread} unread alert${data.totals.notificationsUnread === 1 ? '' : 's'}`)
  }
  if (parts.length === 0) {
    return 'Inbox is calm — nothing needs your attention right now.'
  }
  return `${parts.join(' · ')} · Review now`
}

function NeedsAttentionCard({ data }: { data: DashboardData }) {
  const navigate = useUIStore((s) => s.navigate)
  const items = buildAttentionItems(data, navigate)
  const recommendation = buildRecommendation(data)
  const calm = items.length === 0
  return (
    <Card className="h-full gap-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          Needs your attention
        </CardTitle>
        <CardDescription className="sr-only">
          Smart synthesis of items needing action
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-relaxed text-foreground">{recommendation}</p>
        {calm ? (
          <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2.5 text-sm text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>You&apos;re on track — no pressing items.</span>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {items.map((it) => {
              const Icon = it.icon
              return (
                <li key={it.key}>
                  <button
                    type="button"
                    onClick={it.onClick}
                    className="group flex w-full items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                        toneIconWrapClass(it.tone),
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {it.label}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn('shrink-0 tabular-nums', toneBadgeClass(it.tone))}
                    >
                      {it.count}
                    </Badge>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function NeedsAttentionSkeleton() {
  return (
    <Card className="h-full gap-0">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
        <div className="space-y-2 pt-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// Trend chart v2 — gradient area + custom tooltip + delta header
// -----------------------------------------------------------------------------

function TrendTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { date: string; count: number } }> }) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0]!.payload
  return (
    <Card className="gap-0 py-2 shadow-md">
      <CardContent className="px-3 py-0">
        <div className="text-xs font-medium text-foreground">{formatTrendDate(p.date)}</div>
        <div className="text-xs text-muted-foreground">
          {p.count} email{p.count === 1 ? '' : 's'}
        </div>
      </CardContent>
    </Card>
  )
}

function TrendCard({ trend }: { trend: DashboardData['trend'] }) {
  const hasData = trend.length > 0
  const total = trend.reduce((acc, d) => acc + d.count, 0)
  const peak = trend.reduce((acc, d) => Math.max(acc, d.count), 0)

  // Delta: last 7 days vs first 7 days (if trend has 14 entries).
  const lastHalf = trend.slice(Math.max(0, trend.length - 7)).reduce((acc, d) => acc + d.count, 0)
  const firstHalf = trend.slice(0, Math.max(0, trend.length - 7)).reduce((acc, d) => acc + d.count, 0)
  const deltaPct =
    firstHalf === 0
      ? lastHalf > 0
        ? 100
        : 0
      : Math.round(((lastHalf - firstHalf) / firstHalf) * 100)
  const deltaUp = deltaPct >= 0

  return (
    <Card className="h-full gap-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Email Volume — Last 14 Days</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="tabular-nums">{total.toLocaleString()} received</span>
          <Separator orientation="vertical" className="h-3" />
          <span>peak {peak}/day</span>
          <Separator orientation="vertical" className="h-3" />
          <span
            className={cn(
              'inline-flex items-center gap-0.5 tabular-nums',
              deltaUp ? 'text-success' : 'text-muted-foreground',
            )}
          >
            <ArrowUpRight className={cn('h-3 w-3', !deltaUp && 'rotate-90')} />
            {deltaUp ? '+' : ''}
            {deltaPct}% vs prev 7d
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendFillV2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatTrendDate}
                  stroke="var(--color-muted-foreground)"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval={1}
                  minTickGap={8}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="var(--color-muted-foreground)"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#trendFillV2)"
                  fillOpacity={1}
                  dot={false}
                  activeDot={{ r: 4, stroke: 'var(--color-primary)', strokeWidth: 2, fill: 'var(--color-background)' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[280px] w-full items-center justify-center text-sm text-muted-foreground">
            No activity in the last 14 days.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// Category distribution donut
// -----------------------------------------------------------------------------

function DonutTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; count: number } }> }) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0]!.payload
  return (
    <Card className="gap-0 py-2 shadow-md">
      <CardContent className="px-3 py-0">
        <div className="text-xs font-medium text-foreground">{p.name}</div>
        <div className="text-xs text-muted-foreground">{p.count} emails</div>
      </CardContent>
    </Card>
  )
}

function CategoryDonutCard({ data }: { data: DashboardData }) {
  const navigate = useUIStore((s) => s.navigate)
  const cats = data.categoryCounts
    .filter((c) => c.count > 0)
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
  const total = cats.reduce((acc, c) => acc + c.count, 0)
  const hasData = cats.length > 0

  return (
    <Card className="h-full gap-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Section Distribution</CardTitle>
        <CardDescription>Top sections by email count</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No sections in use yet.
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-44 w-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={cats}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    stroke="var(--color-background)"
                    strokeWidth={2}
                    isAnimationActive={false}
                    onClick={(payload: any) => {
                      const id = payload?.id
                      if (id) navigate('organized', { contextCategoryId: id })
                    }}
                  >
                    {cats.map((c) => (
                      <Cell key={c.id} fill={oklchFor(c.color)} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold tabular-nums text-foreground">
                  {total.toLocaleString()}
                </span>
                <span className="text-[11px] text-muted-foreground">total</span>
              </div>
            </div>
            <ul className="w-full space-y-1.5">
              {cats.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => navigate('organized', { contextCategoryId: c.id })}
                    className="group flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm transition-colors hover:bg-accent/50"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: oklchFor(c.color) }}
                    />
                    <CategoryIcon icon={c.icon} color={c.color} className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate font-medium text-foreground">{c.name}</span>
                    <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                      {c.count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DonutSkeleton() {
  return (
    <Card className="h-full gap-0">
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-40" />
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <Skeleton className="h-44 w-44 rounded-full" />
        <div className="w-full space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// Top senders — horizontal bars tinted by rotating category color
// -----------------------------------------------------------------------------

function TopSendersCard({ data, loading }: { data: DashboardData | undefined; loading: boolean }) {
  const navigate = useUIStore((s) => s.navigate)
  const colors = useMemo(
    () =>
      (data?.categoryCounts ?? [])
        .filter((c) => c.count > 0)
        .slice()
        .sort((a, b) => b.count - a.count)
        .map((c) => c.color),
    [data],
  )

  return (
    <Card className="h-full gap-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Top Senders</CardTitle>
        <CardDescription>Most frequent contacts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-y-auto pr-1">
          {loading || !data ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5"
                >
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-5 w-10 rounded-full" />
                </div>
              ))}
            </div>
          ) : data.topSenders.length === 0 ? (
            <EmptyRow icon={Users} label="No senders yet" />
          ) : (
            <ul className="space-y-1.5">
              {data.topSenders.map((s, idx) => {
                const color = senderColorAt(idx, colors)
                const max = Math.max(...data.topSenders.map((x) => x.count), 1)
                const pct = Math.max(8, Math.round((s.count / max) * 100))
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => navigate('senders', { contextSenderId: s.id })}
                      className="group flex w-full items-center gap-3 rounded-lg border border-border/60 p-2.5 text-left transition-colors hover:bg-accent/50"
                    >
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold cat-bg-soft cat-text',
                          colorClass(color),
                        )}
                      >
                        {getInitial(s.name, s.email)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">
                          {s.name ?? s.email}
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full cat-dot', colorClass(color))}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {s.name && (
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {s.email}
                          </div>
                        )}
                      </div>
                      <Badge variant="secondary" className="shrink-0 tabular-nums">
                        {s.count}
                      </Badge>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// Open deadlines — vertical timeline
// -----------------------------------------------------------------------------

function deadlineTone(d: Deadline): Tone {
  const days = daysUntil(d.dueAt)
  if (days === null) return 'default'
  if (days < 0) return 'destructive'
  if (days <= 2) return 'warning'
  return 'default'
}

function deadlineLabel(d: Deadline): string {
  const days = daysUntil(d.dueAt)
  if (days === null) return 'No due date'
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `In ${days}d`
}

function DeadlinesCard({ data, loading }: { data: DashboardData | undefined; loading: boolean }) {
  const navigate = useUIStore((s) => s.navigate)
  const categoryColorMap = buildCategoryColorMap(data)
  const deadlines = data?.deadlines ?? []

  return (
    <Card className="h-full gap-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Open Deadlines</CardTitle>
        <CardDescription>Tracked action items with due dates</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-y-auto pr-2">
          {loading || !data ? (
            <div className="space-y-3 pl-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="mt-1 h-2.5 w-2.5 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : deadlines.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No open deadlines"
              description="You're on track."
              className="mx-auto max-w-xs border-transparent bg-transparent p-4"
            />
          ) : (
            <ol className="relative space-y-3 pl-1">
              <span
                aria-hidden
                className="absolute left-[5px] top-2 bottom-2 w-px bg-border"
              />
              {deadlines.slice(0, 8).map((d) => {
                const tone = deadlineTone(d)
                const color = d.categoryId ? categoryColorMap.get(d.categoryId) : null
                return (
                  <li key={d.id} className="relative pl-6">
                    <span
                      className={cn(
                        'absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-background',
                        color
                          ? cn('cat-dot', colorClass(color))
                          : tone === 'destructive'
                            ? 'bg-destructive'
                            : tone === 'warning'
                              ? 'bg-warning'
                              : 'bg-muted-foreground/50',
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => d.emailId && navigate('inbox', { contextEmailId: d.emailId })}
                      className="group block w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground group-hover:underline">
                          {d.title}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn('shrink-0 gap-1', toneBadgeClass(tone))}
                        >
                          {tone === 'destructive' && <AlertTriangle className="h-3 w-3" />}
                          {deadlineLabel(d)}
                        </Badge>
                      </div>
                      {d.emailSubject && (
                        <div className="truncate text-xs text-muted-foreground">
                          {d.emailSubject}
                        </div>
                      )}
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{d.dueAt ? formatDate(d.dueAt) : 'No due date'}</span>
                        {d.categoryName && (
                          <>
                            <Separator orientation="vertical" className="h-3" />
                            <span className="truncate">{d.categoryName}</span>
                          </>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// Recent activity — avatar initial tinted by category
// -----------------------------------------------------------------------------

function RecentActivityCard({ data, loading }: { data: DashboardData | undefined; loading: boolean }) {
  const navigate = useUIStore((s) => s.navigate)
  return (
    <Card className="h-full gap-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Recent Activity</CardTitle>
        <CardDescription>Latest emails across all sections</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-y-auto pr-1">
          {loading || !data ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-lg border border-border/60 p-2.5"
                >
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-3 w-8" />
                </div>
              ))}
            </div>
          ) : data.recentActivity.length === 0 ? (
            <EmptyRow icon={Inbox} label="No recent emails" />
          ) : (
            <ul className="space-y-1">
              {data.recentActivity.map((a) => {
                const color = a.categoryColor ?? 'slate'
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => navigate('inbox', { contextEmailId: a.id })}
                      className="group flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-accent/50"
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold cat-bg-soft cat-text',
                          colorClass(color),
                        )}
                      >
                        {getInitial(null, a.fromEmail)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">
                          {a.subject ?? '(no subject)'}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {a.fromEmail}
                        </div>
                        {a.categoryName && (
                          <span
                            className={cn(
                              'mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0 text-[10px] font-medium cat-text cat-bg-soft',
                              colorClass(color),
                            )}
                          >
                            {a.categoryName}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {a.receivedAt ? formatRelative(a.receivedAt) : ''}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// Action items — cosmetic checklist
// -----------------------------------------------------------------------------

function ActionItemsCard({ data }: { data: DashboardData }) {
  const items = data.actionItems
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          Action Items
        </CardTitle>
        <CardDescription>
          {items.filter((i) => !checked[i.id]).length} of {items.length} remaining
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((it) => {
            const isDone = checked[it.id] ?? false
            const days = daysUntil(it.dueAt)
            const overdue = days !== null && days < 0
            return (
              <li
                key={it.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5 transition-colors',
                  isDone && 'opacity-60',
                )}
              >
                <Checkbox
                  checked={isDone}
                  onCheckedChange={(v) => setChecked((s) => ({ ...s, [it.id]: !!v }))}
                  aria-label={`Mark "${it.title}" as done`}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      'truncate text-sm font-medium text-foreground',
                      isDone && 'line-through',
                    )}
                  >
                    {it.title}
                  </div>
                  {it.dueAt && (
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(it.dueAt)}</span>
                    </div>
                  )}
                </div>
                {it.dueAt && !isDone && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'shrink-0',
                      overdue
                        ? toneBadgeClass('destructive')
                        : days !== null && days <= 2
                          ? toneBadgeClass('warning')
                          : toneBadgeClass('default'),
                    )}
                  >
                    {overdue ? `${Math.abs(days!)}d overdue` : days === 0 ? 'today' : `${days}d`}
                  </Badge>
                )}
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// Shared bits
// -----------------------------------------------------------------------------

function EmptyRow({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex h-32 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
      <Icon className="h-5 w-5 opacity-70" />
      <span>{label}</span>
    </div>
  )
}
