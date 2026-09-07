'use client'

// =============================================================================
// DigestViewerDialog — full-screen-on-mobile / max-w-3xl-on-desktop Dialog that
// renders the complete structured weekly digest. Each section has a header with
// a statically-imported lucide icon. Category colors come from the parent via
// `categoryColors` (name -> color) so deadline/category rows render the same
// cat-* swatches used elsewhere in the app.
// =============================================================================

import {
  Sparkles,
  BarChart3,
  CalendarClock,
  AlertTriangle,
  Lightbulb,
  PieChart,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { PaneScroll } from '@/components/ui/pane-scroll'

import { colorClass } from '@/lib/category-meta'
import { formatDate, formatRelative, daysUntil } from '@/lib/format'
import { cn } from '@/lib/utils'
import type {
  WeeklyDigest,
  DigestDeadline,
  DigestCategoryBreakdown,
} from '@/app/api/assistant/digest/route'

// -----------------------------------------------------------------------------
// Small presentational helpers
// -----------------------------------------------------------------------------

function SectionHeader({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  hint?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {hint && <span className="ml-auto text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

function trendMeta(trend: DigestCategoryBreakdown['trend']): {
  label: string
  cls: string
  Icon: React.ComponentType<{ className?: string }>
} {
  switch (trend) {
    case 'up':
      return { label: 'Up', cls: 'text-success', Icon: TrendingUp }
    case 'down':
      return { label: 'Down', cls: 'text-destructive', Icon: TrendingDown }
    default:
      return { label: 'Flat', cls: 'text-muted-foreground', Icon: Minus }
  }
}

function deadlineTone(dueAt: string | null): {
  label: string
  cls: string
} {
  const days = daysUntil(dueAt)
  if (days === null) return { label: 'No date', cls: 'text-muted-foreground' }
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, cls: 'text-destructive' }
  if (days === 0) return { label: 'Due today', cls: 'text-warning' }
  if (days === 1) return { label: 'Due tomorrow', cls: 'text-warning' }
  if (days <= 3) return { label: `In ${days}d`, cls: 'text-warning' }
  return { label: `In ${days}d`, cls: 'text-muted-foreground' }
}

// -----------------------------------------------------------------------------
// Sections
// -----------------------------------------------------------------------------

function HighlightsGrid({ digest }: { digest: WeeklyDigest }) {
  if (digest.highlights.length === 0) return null
  return (
    <section className="space-y-3">
      <SectionHeader icon={BarChart3} title="Highlights" hint="This week" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {digest.highlights.map((h, i) => (
          <div
            key={`${h.label}-${i}`}
            className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5"
          >
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {h.label}
            </div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              {h.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function KeyDeadlinesSection({
  digest,
  categoryColors,
}: {
  digest: WeeklyDigest
  categoryColors: Record<string, string>
}) {
  if (digest.keyDeadlines.length === 0) return null
  return (
    <section className="space-y-3">
      <SectionHeader icon={CalendarClock} title="Key deadlines" hint="New this week" />
      <ul className="space-y-2">
        {digest.keyDeadlines.map((d: DigestDeadline, i) => {
          const color = d.categoryName ? categoryColors[d.categoryName] ?? 'slate' : 'slate'
          const tone = deadlineTone(d.dueAt)
          return (
            <li
              key={`${d.title}-${i}`}
              className="flex items-start gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5"
            >
              <span
                className={cn(
                  'mt-1.5 h-2 w-2 shrink-0 rounded-full cat-dot',
                  colorClass(color),
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">
                  {d.title}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  {d.categoryName && (
                    <span className={cn('cat-text', colorClass(color))}>{d.categoryName}</span>
                  )}
                  {d.categoryName && d.dueAt && <span aria-hidden>·</span>}
                  {d.dueAt && (
                    <span className="tabular-nums">
                      {formatDate(d.dueAt)}
                    </span>
                  )}
                </div>
              </div>
              <span className={cn('shrink-0 text-xs font-medium tabular-nums', tone.cls)}>
                {tone.label}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function NeedsAttentionSection({ digest }: { digest: WeeklyDigest }) {
  if (digest.needsAttention.length === 0) return null
  return (
    <section className="space-y-3">
      <SectionHeader icon={AlertTriangle} title="Needs your attention" />
      <ul className="space-y-2">
        {digest.needsAttention.map((n, i) => (
          <li
            key={`${n.item}-${i}`}
            className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">{n.item}</div>
              {n.reason && (
                <div className="mt-0.5 text-xs text-muted-foreground">{n.reason}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function RecommendedActionsSection({ digest }: { digest: WeeklyDigest }) {
  if (digest.recommendedActions.length === 0) return null
  return (
    <section className="space-y-3">
      <SectionHeader icon={Lightbulb} title="Recommended actions" />
      <ul className="space-y-2">
        {digest.recommendedActions.map((r, i) => (
          <li
            key={`${r.action}-${i}`}
            className="flex items-start gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">{r.action}</div>
              {r.reason && (
                <div className="mt-0.5 text-xs text-muted-foreground">{r.reason}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function CategoryBreakdownSection({ digest }: { digest: WeeklyDigest }) {
  if (digest.categoryBreakdown.length === 0) return null
  const max = Math.max(1, ...digest.categoryBreakdown.map((c) => c.count))
  return (
    <section className="space-y-3">
      <SectionHeader icon={PieChart} title="Section breakdown" hint="This week vs last" />
      <ul className="space-y-2">
        {digest.categoryBreakdown.map((c, i) => {
          const meta = trendMeta(c.trend)
          const pct = Math.round((c.count / max) * 100)
          return (
            <li
              key={`${c.category}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2"
            >
              <div className="w-28 shrink-0 truncate text-sm text-foreground">{c.category}</div>
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary/70"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                {c.count}
              </div>
              <div className={cn('flex w-16 shrink-0 items-center justify-end gap-1 text-xs', meta.cls)}>
                <meta.Icon className="h-3.5 w-3.5" />
                <span>{meta.label}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// -----------------------------------------------------------------------------
// Dialog
// -----------------------------------------------------------------------------

export function DigestViewerDialog({
  open,
  onOpenChange,
  digest,
  categoryColors = {},
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  digest: WeeklyDigest | null
  categoryColors?: Record<string, string>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            Weekly Digest
            {digest?.source === 'fallback' && (
              <Badge variant="outline" className="ml-1 text-[10px]">
                Offline summary
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            AI-generated summary of your last 7 days
            {digest && (
              <span className="ml-1 inline-flex items-center gap-1 tabular-nums">
                · generated {formatRelative(digest.generatedAt)}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {digest ? (
          <PaneScroll>
            <div className="space-y-6 px-6 py-5">
              {/* Week summary narrative */}
              <section className="space-y-2">
                <SectionHeader icon={Sparkles} title="Week summary" />
                <p className="text-sm leading-relaxed text-foreground">{digest.weekSummary}</p>
              </section>

              <Separator />

              <HighlightsGrid digest={digest} />

              {digest.keyDeadlines.length > 0 && (
                <>
                  <Separator />
                  <KeyDeadlinesSection digest={digest} categoryColors={categoryColors} />
                </>
              )}

              {digest.needsAttention.length > 0 && (
                <>
                  <Separator />
                  <NeedsAttentionSection digest={digest} />
                </>
              )}

              {digest.recommendedActions.length > 0 && (
                <>
                  <Separator />
                  <RecommendedActionsSection digest={digest} />
                </>
              )}

              {digest.categoryBreakdown.length > 0 && (
                <>
                  <Separator />
                  <CategoryBreakdownSection digest={digest} />
                </>
              )}

              {/* Footer meta: window + generation time */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDate(digest.weekStart)} – {formatDate(digest.weekEnd)}
                </span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Generated {formatRelative(digest.generatedAt)}
                </span>
              </div>
            </div>
          </PaneScroll>
        ) : (
          <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
            No digest available.
          </div>
        )}

        <DialogFooter className="border-t px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
