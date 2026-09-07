'use client'

import { useMemo } from 'react'
import { useEmails } from '@/hooks/use-queries'
import { useUIStore, type ViewKey } from '@/store/ui-store'
import { colorClass } from '@/lib/category-meta'
import { formatRelative, formatDate, formatDateTime } from '@/lib/format'
import { CategoryIcon } from '@/components/common/category-icon'
import { EmptyState, ErrorState } from '@/components/common/states'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { SenderSummary, EmailListItem } from '@/lib/types'

import {
  Mail,
  MailOpen,
  Clock,
  Calendar,
  AtSign,
  Globe,
  Plus,
  FolderPlus,
  Sparkles,
  Info,
  ShieldCheck,
  Layers,
  Send,
  ArrowRight,
} from 'lucide-react'

type CatMeta = { color: string; icon: string }

interface SenderDetailDrawerProps {
  sender: SenderSummary | null
  open: boolean
  onClose: () => void
  catMap: Map<string, CatMeta>
}

/**
 * SenderDetailDrawer — a rich sender profile sheet that opens when a sender
 * row's main area is clicked in the Senders view.
 *
 * Layout: full-width bottom sheet on mobile, 420px right-side drawer on
 * desktop. The header (avatar + identity + key stats) stays pinned while the
 * body scrolls (stats row → category breakdown → quick actions → recent
 * emails → discovery note).
 *
 * Data: uses the already-fetched `SenderSummary` object from the parent for
 * the header/profile (no extra fetch), and `useEmails({ senderId, limit: 8 })`
 * for the recent-emails list.
 */
export function SenderDetailDrawer({
  sender,
  open,
  onClose,
  catMap,
}: SenderDetailDrawerProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <SheetContent
        side="bottom"
        className={cn(
          'gap-0 p-0 h-[90vh] max-h-[90vh] rounded-t-xl',
          'sm:left-auto sm:right-0 sm:top-0 sm:h-full sm:w-[420px] sm:max-w-[420px] sm:max-h-none sm:border-l sm:border-t-0 sm:rounded-none',
        )}
      >
        {sender ? (
          <DrawerBody key={sender.id} sender={sender} catMap={catMap} onClose={onClose} />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// DrawerBody — mounts only when a sender exists; owns the recent-emails query.
// ---------------------------------------------------------------------------

interface DrawerBodyProps {
  sender: SenderSummary
  catMap: Map<string, CatMeta>
  onClose: () => void
}

function DrawerBody({ sender, catMap, onClose }: DrawerBodyProps) {
  const navigate = useUIStore((s) => s.navigate)
  const recentQuery = useEmails({ senderId: sender.id, limit: 8 })

  const isDiscovered = sender.discovered && sender.ruleStatus === 'none'
  const firstCat = sender.categories[0]
  const firstCatMeta = firstCat ? catMap.get(firstCat.id) : undefined
  const avatarColor = firstCatMeta?.color ?? 'slate'
  const displayName = sender.senderName?.trim() || sender.senderEmail.split('@')[0] || sender.senderEmail
  const initial = (displayName.charAt(0) || '?').toUpperCase()
  const domain = sender.domain ?? sender.senderEmail.split('@')[1]?.toLowerCase() ?? ''
  const isInstitutional = domain === 'iitjammu.ac.in'

  const handleAddRule = () => {
    onClose()
    navigate('rules', { contextSenderId: sender.id })
  }
  const handleViewAllEmails = () => {
    onClose()
    navigate('inbox', { contextSenderId: sender.id })
  }
  const handleCreateSection = () => {
    onClose()
    navigate('organized')
  }
  const handleComposeToSender = () => {
    onClose()
    navigate('compose')
    toast.info('Compose opened', {
      description: `Recipient: ${sender.senderEmail}`,
    })
  }
  const handleOpenEmail = (emailId: string) => {
    onClose()
    navigate('inbox', { contextEmailId: emailId })
  }

  return (
    <>
      {/* ---------- Header (pinned, non-scrolling) ---------- */}
      <SheetHeader className="gap-0 border-b border-border bg-card/40 p-5">
        <div className="flex items-start gap-4">
          {/* Large tinted avatar */}
          <div
            className={cn(
              'flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-semibold ring-1 ring-inset cat-bg-soft cat-text cat-border-soft',
              colorClass(avatarColor),
            )}
            aria-hidden
          >
            {initial}
          </div>

          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-base font-semibold leading-tight">
              {displayName}
            </SheetTitle>
            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <AtSign className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{sender.senderEmail}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {domain && (
                <Badge variant="outline" className="shrink-0 gap-1 text-[11px]">
                  <Globe className="h-3 w-3" aria-hidden />
                  {domain}
                </Badge>
              )}
              <RuleStatusBadge status={sender.ruleStatus} />
              {isInstitutional && (
                <Badge
                  variant="outline"
                  className="shrink-0 gap-1 border-success/30 bg-success/10 px-1.5 py-0 text-[10px] font-medium text-success"
                >
                  <ShieldCheck className="h-3 w-3" />
                  Verified institutional domain
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Big message-count stat */}
        <div className="mt-4 flex items-end gap-2">
          <span className="text-3xl font-semibold tabular-nums leading-none">
            {sender.messageCount}
          </span>
          <span className="pb-0.5 text-xs text-muted-foreground">
            {sender.messageCount === 1 ? 'message' : 'messages'} total
          </span>
        </div>
        <SheetDescription className="sr-only">
          Sender profile for {displayName} ({sender.senderEmail}). View stats,
          category breakdown, quick actions, and recent emails.
        </SheetDescription>
      </SheetHeader>

      {/* ---------- Scrollable body ---------- */}
      <div
        className="min-h-0 flex-1 overflow-y-auto p-5"
        // Custom scrollbar styling for a polished look inside the drawer.
        style={{ scrollbarWidth: 'thin' }}
      >
        <div className="space-y-6">
          {/* ===== Stats row (4 mini cards) ===== */}
          <StatsRow sender={sender} />

          {/* ===== Category breakdown ===== */}
          <section aria-label="Category breakdown">
            <SectionHeading
              icon={Layers}
              title="Category breakdown"
              hint={`${sender.categories.length} ${
                sender.categories.length === 1 ? 'category' : 'categories'
              }`}
            />
            <CategoryBreakdown sender={sender} catMap={catMap} />
          </section>

          <Separator />

          {/* ===== Quick actions ===== */}
          <section aria-label="Quick actions">
            <SectionHeading title="Quick actions" />
            <div className="grid grid-cols-2 gap-2">
              <QuickAction
                icon={Plus}
                label="Add rule"
                onClick={handleAddRule}
              />
              <QuickAction
                icon={MailOpen}
                label="View all emails"
                onClick={handleViewAllEmails}
              />
              <QuickAction
                icon={FolderPlus}
                label="Create section"
                onClick={handleCreateSection}
              />
              <QuickAction
                icon={Send}
                label="Compose to sender"
                onClick={handleComposeToSender}
              />
            </div>
          </section>

          <Separator />

          {/* ===== Recent emails ===== */}
          <section aria-label="Recent emails">
            <div className="mb-2 flex items-center justify-between">
              <SectionHeading icon={Mail} title="Recent emails" inline />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 gap-1 px-2 text-xs"
                onClick={handleViewAllEmails}
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <RecentEmails
              query={recentQuery}
              onOpenEmail={handleOpenEmail}
              onViewAll={handleViewAllEmails}
            />
          </section>

          {/* ===== Discovery note ===== */}
          {isDiscovered && (
            <>
              <Separator />
              <DiscoveryNote sender={sender} onAddRule={handleAddRule} />
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Stats row
// ---------------------------------------------------------------------------

function StatsRow({ sender }: { sender: SenderSummary }) {
  const stats = [
    {
      icon: Mail,
      label: 'Total messages',
      value: String(sender.messageCount),
      tooltip: undefined as string | undefined,
    },
    {
      icon: Calendar,
      label: 'First seen',
      value: sender.firstSeenAt ? formatDate(sender.firstSeenAt) : '—',
      tooltip: sender.firstSeenAt ? formatDateTime(sender.firstSeenAt) : undefined,
    },
    {
      icon: Clock,
      label: 'Last seen',
      value: sender.lastSeenAt ? formatRelative(sender.lastSeenAt) : '—',
      tooltip: sender.lastSeenAt ? formatDateTime(sender.lastSeenAt) : undefined,
    },
    {
      icon: Layers,
      label: 'Categories',
      value: String(sender.categories.length),
      tooltip: undefined,
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {stats.map((s) => {
        const Icon = s.icon
        const card = (
          <Card className="gap-1 p-3 shadow-none">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <Icon className="h-3 w-3" aria-hidden />
              <span className="truncate">{s.label}</span>
            </div>
            <div className="text-lg font-semibold tabular-nums leading-tight">
              {s.value}
            </div>
          </Card>
        )
        return s.tooltip ? (
          <Tooltip key={s.label}>
            <TooltipTrigger asChild>{card}</TooltipTrigger>
            <TooltipContent side="top">{s.tooltip}</TooltipContent>
          </Tooltip>
        ) : (
          <div key={s.label}>{card}</div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Category breakdown
// ---------------------------------------------------------------------------

function CategoryBreakdown({
  sender,
  catMap,
}: {
  sender: SenderSummary
  catMap: Map<string, CatMeta>
}) {
  const maxCount = useMemo(
    () => sender.categories.reduce((m, c) => Math.max(m, c.count), 0) || 1,
    [sender.categories],
  )

  if (sender.categories.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No categories associated with this sender yet.
      </p>
    )
  }

  return (
    <ul className="space-y-2.5">
      {sender.categories.map((c) => {
        const meta = catMap.get(c.id)
        const color = meta?.color ?? 'slate'
        const icon = meta?.icon ?? 'folder'
        const pct = Math.round((c.count / maxCount) * 100)
        return (
          <li key={c.id} className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <CategoryIcon icon={icon} color={color} className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {c.count}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full cat-bg-soft cat-border-soft',
                  colorClass(color),
                )}
                style={{ width: `${pct}%` }}
                aria-label={`${c.name}: ${c.count} messages, ${pct}% of max`}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Recent emails
// ---------------------------------------------------------------------------

function RecentEmails({
  query,
  onOpenEmail,
  onViewAll,
}: {
  query: ReturnType<typeof useEmails>
  onOpenEmail: (emailId: string) => void
  onViewAll: () => void
}) {
  if (query.isLoading) {
    return <RecentEmailsSkeleton />
  }
  if (query.isError) {
    return (
      <ErrorState
        title="Couldn't load recent emails"
        description="There was a problem fetching this sender's recent messages."
        onRetry={() => query.refetch()}
      />
    )
  }
  const items = query.data?.items ?? []
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="No recent emails"
        description="This sender has no messages in the current corpus."
        action={
          <Button variant="outline" size="sm" onClick={onViewAll}>
            Browse inbox
          </Button>
        }
      />
    )
  }
  return (
    <ul className="space-y-1">
      {items.map((email) => (
        <RecentEmailRow key={email.id} email={email} onOpen={() => onOpenEmail(email.id)} />
      ))}
    </ul>
  )
}

function RecentEmailRow({
  email,
  onOpen,
}: {
  email: EmailListItem
  onOpen: () => void
}) {
  const cat = email.categories[0]
  const catColor = cat?.color ?? 'slate'
  const catIcon = cat?.icon ?? 'folder'
  const isRead = email.flags.isRead
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-accent/50 focus-visible:bg-accent/70 focus-visible:outline-none"
      >
        {/* Read / unread dot */}
        <span
          className={cn(
            'mt-1.5 h-2 w-2 shrink-0 rounded-full',
            isRead ? 'bg-transparent ring-1 ring-inset ring-muted-foreground/40' : 'bg-primary',
          )}
          aria-label={isRead ? 'Read' : 'Unread'}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-sm',
                isRead ? 'font-medium text-foreground/80' : 'font-semibold text-foreground',
              )}
            >
              {email.subject ?? '(no subject)'}
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {formatRelative(email.receivedAt)}
            </span>
          </div>
          {email.snippet && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {email.snippet}
            </p>
          )}
          {cat && (
            <span
              className={cn(
                'mt-1.5 inline-flex items-center gap-1 rounded-full border cat-border-soft cat-bg-soft cat-text px-1.5 py-0.5 text-[10px] font-medium',
                colorClass(catColor),
              )}
            >
              <CategoryIcon icon={catIcon} color={catColor} className="h-2.5 w-2.5" />
              {cat.name}
            </span>
          )}
        </div>
      </button>
    </li>
  )
}

function RecentEmailsSkeleton() {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-2.5 rounded-lg p-2"
        >
          <Skeleton className="mt-1.5 h-2 w-2 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-4 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Discovery note
// ---------------------------------------------------------------------------

function DiscoveryNote({
  sender,
  onAddRule,
}: {
  sender: SenderSummary
  onAddRule: () => void
}) {
  return (
    <Card className="gap-0 border-primary/30 bg-primary/5 p-4 shadow-none">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Info className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">This sender isn&apos;t ruled yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add a rule to automatically categorize future emails from{' '}
            <span className="font-medium text-foreground/80">
              {sender.senderEmail}
            </span>
            .
          </p>
          <Button
            size="sm"
            className="mt-3 h-8 gap-1"
            onClick={onAddRule}
          >
            <Plus className="h-3.5 w-3.5" />
            Add rule
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

function SectionHeading({
  icon: Icon,
  title,
  hint,
  inline,
}: {
  icon?: typeof Mail
  title: string
  hint?: string
  inline?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between',
        inline ? '' : 'mb-3',
      )}
    >
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
        {title}
      </h3>
      {hint && (
        <span className="text-[11px] text-muted-foreground/80">{hint}</span>
      )}
    </div>
  )
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Mail
  label: string
  onClick: () => void
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-auto justify-start gap-2 py-2.5 text-left"
      onClick={onClick}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate text-xs font-medium">{label}</span>
    </Button>
  )
}

function RuleStatusBadge({ status }: { status: SenderSummary['ruleStatus'] }) {
  if (status === 'has_rule') {
    return (
      <Badge className="shrink-0 border-success/25 bg-success/15 text-success">
        Rule
      </Badge>
    )
  }
  if (status === 'ignored') {
    return (
      <Badge
        variant="secondary"
        className="shrink-0 bg-muted/70 text-muted-foreground/80"
      >
        Ignored
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="shrink-0 gap-1 border-success/40 bg-success/10 text-success"
    >
      <Sparkles className="h-3 w-3" />
      Discovered
    </Badge>
  )
}
