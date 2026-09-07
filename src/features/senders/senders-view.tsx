'use client'

import { useEffect, useMemo, useState, Fragment } from 'react'
import { useSenders, useCategories } from '@/hooks/use-queries'
import { useUIStore, type ViewKey } from '@/store/ui-store'
import { colorClass } from '@/lib/category-meta'
import { formatRelative } from '@/lib/format'
import { SenderListSkeleton } from '@/components/common/skeletons'
import { EmptyState, ErrorState } from '@/components/common/states'
import { CategoryIcon } from '@/components/common/category-icon'
import { SenderDetailDrawer } from './sender-detail-drawer'
import { SleekSeparator } from '@/components/common/separator'
import { cn } from '@/lib/utils'
import type { SenderSummary } from '@/lib/types'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  Users,
  Sparkles,
  MoreHorizontal,
  Plus,
  MailOpen,
  FolderPlus,
  Mail,
  Clock,
  AtSign,
  Globe,
} from 'lucide-react'

type CatMeta = { color: string; icon: string }

/**
 * Sender Intelligence view.
 *
 * Lists every discovered sender with their stats, rule status and associated
 * categories. Senders can be searched by name / email / domain (debounced) and
 * each row offers quick actions: add a rule, view their emails, or promote them
 * into a new organized section.
 */
export function SendersView() {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const navigate = useUIStore((s) => s.navigate)

  // Drawer state: `open` and `openSenderId` are tracked separately so that
  // closing the drawer keeps the sender reference alive during Radix's exit
  // animation (otherwise the body would unmount instantly and the slide-out
  // would show an empty sheet).
  const [open, setOpen] = useState(false)
  const [openSenderId, setOpenSenderId] = useState<string | null>(null)

  // 250ms debounce on the search input.
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 250)
    return () => clearTimeout(t)
  }, [input])

  const { data: senders, isLoading, isError, refetch } = useSenders(query || undefined)
  const { data: categories } = useCategories()

  // Build a lookup of category id -> { color, icon } so each sender's
  // associated categories can be rendered with consistent color/icon.
  const catMap = useMemo(() => {
    const m = new Map<string, CatMeta>()
    categories?.forEach((c) => m.set(c.id, { color: c.color, icon: c.icon }))
    return m
  }, [categories])

  const list = senders ?? []
  const total = list.length
  const discoveredCount = useMemo(
    () => list.filter((s) => s.discovered && s.ruleStatus === 'none').length,
    [list],
  )
  const openSender = useMemo(
    () => list.find((s) => s.id === openSenderId) ?? null,
    [list, openSenderId],
  )
  const handleOpenSender = (s: SenderSummary) => {
    setOpenSenderId(s.id)
    setOpen(true)
  }
  const handleCloseDrawer = () => setOpen(false)

  return (
    <div className="flex h-full flex-col">
      {/* ---------- Header ---------- */}
      <header className="border-b border-border bg-card/40 px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            <h2 className="truncate text-sm font-semibold">Sender Intelligence</h2>
            <Badge variant="secondary" className="shrink-0">
              {total} total
            </Badge>
            {discoveredCount > 0 && (
              <Badge
                variant="outline"
                className="shrink-0 gap-1 border-success/40 bg-success/10 text-success"
              >
                <Sparkles className="h-3 w-3" />
                {discoveredCount} discovered
              </Badge>
            )}
          </div>
          <div className="relative w-full lg:w-80">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search name, email or domain…"
              className="pl-8"
              aria-label="Search senders by name, email or domain"
            />
          </div>
        </div>
      </header>

      {/* ---------- Body ---------- */}
      {/* `min-h-0 flex-1` lets this column shrink so the inner scroll container
          can scroll instead of pushing past the mobile bottom nav. The inner
          list uses `h-full` (not a fixed `vh`) so it always fits the available
          space — important in landscape where `72vh` would overshoot the nav. */}
      <div className="min-h-0 flex-1 px-3 py-3 sm:px-6 sm:py-4">
        {isLoading ? (
          <SenderListSkeleton count={8} />
        ) : isError ? (
          <ErrorState
            title="Couldn't load senders"
            description="There was a problem fetching your sender intelligence. Please try again."
            onRetry={() => refetch()}
          />
        ) : total === 0 ? (
          <EmptyState
            icon={Users}
            title={query ? `No senders match “${query}”` : 'No senders found'}
            description={
              query
                ? 'Try a different name, email, or domain.'
                : 'They appear as your mailbox syncs.'
            }
          />
        ) : (
          <div className="h-full overflow-y-auto pr-1">
            <ul className="space-y-0">
              {list.map((sender, idx) => (
                <Fragment key={sender.id}>
                  <SenderRow
                    sender={sender}
                    catMap={catMap}
                    onNavigate={navigate}
                    onOpenSender={handleOpenSender}
                  />
                  {idx < list.length - 1 && (
                    <li aria-hidden className="py-2">
                      <SleekSeparator />
                    </li>
                  )}
                </Fragment>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ---------- Sender detail drawer ---------- */}
      <SenderDetailDrawer
        sender={openSender}
        open={open}
        onClose={handleCloseDrawer}
        catMap={catMap}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// SenderRow
// ---------------------------------------------------------------------------

interface SenderRowProps {
  sender: SenderSummary
  catMap: Map<string, CatMeta>
  onNavigate: (view: ViewKey, ctx?: { contextSenderId?: string }) => void
  onOpenSender: (sender: SenderSummary) => void
}

function SenderRow({ sender, catMap, onNavigate, onOpenSender }: SenderRowProps) {
  const isDiscovered = sender.discovered && sender.ruleStatus === 'none'
  const firstCat = sender.categories[0]
  const firstCatMeta = firstCat ? catMap.get(firstCat.id) : undefined
  const avatarColor = firstCatMeta?.color ?? 'slate'
  const displayName = sender.senderName?.trim() || sender.senderEmail.split('@')[0] || sender.senderEmail
  const initial = (displayName.charAt(0) || '?').toUpperCase()

  const handleOpen = () => onOpenSender(sender)
  const handleAddRule = () => onNavigate('rules', { contextSenderId: sender.id })
  const handleViewEmails = () => onNavigate('inbox', { contextSenderId: sender.id })
  const handleCreateSection = () => onNavigate('organized')

  return (
    <li>
      <Card
        className={cn(
          'gap-0 overflow-hidden p-0 py-0 shadow-none transition-colors hover:bg-accent/40',
          isDiscovered && 'border-l-2 border-l-success/70',
        )}
      >
        {/* ---------------- Mobile (stacked) ---------------- */}
        <div className="flex flex-col gap-2 p-3 sm:hidden">
          <div className="flex items-start gap-3">
            <RowMainArea onClick={handleOpen} className="flex min-w-0 flex-1 items-start gap-3">
              <SenderAvatar color={avatarColor} initial={initial} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{displayName}</span>
                  {isDiscovered && <NewPill />}
                </div>
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <AtSign className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">{sender.senderEmail}</span>
                </div>
              </div>
            </RowMainArea>
            <SenderActions
              displayName={displayName}
              onAddRule={handleAddRule}
              onViewEmails={handleViewEmails}
              onCreateSection={handleCreateSection}
            />
          </div>

          <RowMainArea
            onClick={handleOpen}
            className="flex flex-wrap items-center gap-1.5 pl-[52px]"
          >
            {sender.domain && <DomainChip domain={sender.domain} />}
            <RuleStatusBadge status={sender.ruleStatus} />
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Mail className="h-3 w-3" aria-hidden />
              <span className="tabular-nums">{sender.messageCount}</span>
              <span className="text-muted-foreground/70">msgs</span>
            </span>
            {sender.lastSeenAt && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" aria-hidden />
                {formatRelative(sender.lastSeenAt)}
              </span>
            )}
          </RowMainArea>

          {sender.categories.length > 0 && (
            <RowMainArea
              onClick={handleOpen}
              className="flex flex-wrap gap-1 pl-[52px]"
            >
              {sender.categories.map((c) => (
                <CategoryChip key={c.id} id={c.id} name={c.name} count={c.count} catMap={catMap} />
              ))}
            </RowMainArea>
          )}
        </div>

        {/* ---------------- Desktop (dense row) ---------------- */}
        <div className="hidden items-center gap-3 p-3 sm:flex">
          <RowMainArea
            onClick={handleOpen}
            ariaLabel={`Open sender profile for ${displayName}`}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <SenderAvatar color={avatarColor} initial={initial} />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{displayName}</span>
                {isDiscovered && <NewPill />}
              </div>
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <AtSign className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">{sender.senderEmail}</span>
              </div>
            </div>

            {sender.domain && <DomainChip domain={sender.domain} />}

            <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1" title={`${sender.messageCount} messages`}>
                <Mail className="h-3 w-3" aria-hidden />
                <span className="tabular-nums">{sender.messageCount}</span>
              </span>
              {sender.lastSeenAt && (
                <span className="flex items-center gap-1" title={`Last seen ${formatRelative(sender.lastSeenAt)}`}>
                  <Clock className="h-3 w-3" aria-hidden />
                  {formatRelative(sender.lastSeenAt)}
                </span>
              )}
            </div>

            <RuleStatusBadge status={sender.ruleStatus} />

            {sender.categories.length > 0 && (
              <>
                <Separator orientation="vertical" className="h-8" />
                <div className="flex max-w-[260px] flex-wrap items-center gap-1">
                  {sender.categories.slice(0, 4).map((c) => (
                    <CategoryChip key={c.id} id={c.id} name={c.name} count={c.count} catMap={catMap} />
                  ))}
                  {sender.categories.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{sender.categories.length - 4}
                    </span>
                  )}
                </div>
              </>
            )}
          </RowMainArea>

          <SenderActions
            displayName={displayName}
            onAddRule={handleAddRule}
            onViewEmails={handleViewEmails}
            onCreateSection={handleCreateSection}
          />
        </div>
      </Card>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SenderAvatar({ color, initial }: { color: string; initial: string }) {
  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full cat-bg-soft cat-text text-sm font-semibold',
        colorClass(color),
      )}
      aria-hidden
    >
      {initial}
    </div>
  )
}

function NewPill() {
  return (
    <Badge
      variant="outline"
      className="shrink-0 gap-1 border-success/40 bg-success/10 text-success"
    >
      <Sparkles className="h-3 w-3" />
      New
    </Badge>
  )
}

function DomainChip({ domain }: { domain: string }) {
  return (
    <Badge variant="outline" className="shrink-0 gap-1 text-[11px]">
      <Globe className="h-3 w-3" aria-hidden />
      {domain}
    </Badge>
  )
}

function RuleStatusBadge({ status }: { status: SenderSummary['ruleStatus'] }) {
  if (status === 'has_rule') {
    return (
      <Badge className="shrink-0 border-success/25 bg-success/15 text-success">Rule</Badge>
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
    <Badge variant="secondary" className="shrink-0 bg-muted text-muted-foreground">
      Discovered
    </Badge>
  )
}

function CategoryChip({
  id,
  name,
  count,
  catMap,
}: {
  id: string
  name: string
  count: number
  catMap: Map<string, CatMeta>
}) {
  const meta = catMap.get(id)
  const color = meta?.color ?? 'slate'
  const icon = meta?.icon ?? 'folder'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border cat-border-soft cat-bg-soft cat-text px-2 py-0.5 text-[10px] font-medium',
        colorClass(color),
      )}
    >
      <CategoryIcon icon={icon} color={color} className="h-2.5 w-2.5" />
      <span className="truncate">{name}</span>
      {count > 1 && <span className="opacity-60">{count}</span>}
    </span>
  )
}

function SenderActions({
  displayName,
  onAddRule,
  onViewEmails,
  onCreateSection,
}: {
  displayName: string
  onAddRule: () => void
  onViewEmails: () => void
  onCreateSection: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label={`Actions for ${displayName}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onAddRule}>
          <Plus className="h-4 w-4" />
          Add Rule
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onViewEmails}>
          <MailOpen className="h-4 w-4" />
          View Emails
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCreateSection}>
          <FolderPlus className="h-4 w-4" />
          Create Section
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * RowMainArea — the clickable region of a sender row that opens the sender
 * detail drawer. Uses div[role=button] (NOT a <button>) so the nested
 * ⋯ dropdown trigger button (a real <button>) stays valid HTML and its clicks
 * don't bubble up to open the drawer.
 */
function RowMainArea({
  onClick,
  className,
  children,
  ariaLabel,
}: {
  onClick: () => void
  className?: string
  children: React.ReactNode
  ariaLabel?: string
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      aria-label={ariaLabel}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'cursor-pointer rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        className,
      )}
    >
      {children}
    </div>
  )
}
