'use client'

import { createElement, useEffect, useMemo, useState } from 'react'
import {
  Check,
  CornerDownRight,
  Folder,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Mail,
  Moon,
  PenSquare,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Sun,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { CategoryDot } from '@/components/common/category-icon'
import { useCommandData } from '@/hooks/use-command-data'
import { useUIStore } from '@/store/ui-store'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Dynamic-icon resolver.
//
// We statically import every lucide icon used by the palette and resolve a
// name → component at runtime via createElement. This mirrors the pattern in
// src/components/common/category-icon.tsx and keeps the lint rule
// ("never `const Icon = lookup(name); <Icon/>`") satisfied — the lookup
// result is passed straight into createElement rather than rendered as JSX.
// ---------------------------------------------------------------------------
const ICONS: Record<string, LucideIcon> = {
  mail: Mail,
  users: Users,
  folder: Folder,
  sparkles: Sparkles,
  pen: PenSquare,
  inbox: Inbox,
  grid: LayoutGrid,
  dashboard: LayoutDashboard,
  workflow: Workflow,
  settings: Settings,
  sun: Sun,
  moon: Moon,
  refresh: RefreshCw,
  plus: Plus,
  check: Check,
  'corner-down-right': CornerDownRight,
}

function ActionIcon({ name, className }: { name: string; className?: string }) {
  const cmp = ICONS[name] ?? Mail
  return createElement(cmp, { className })
}

// ---------------------------------------------------------------------------
// Recent-search persistence (last 5 selected items, localStorage).
// ---------------------------------------------------------------------------
const RECENT_KEY = 'iei-cmd-recent'
const RECENT_LIMIT = 5

interface RecentEntry {
  id: string
  type: 'email' | 'sender' | 'category' | 'action'
  label: string
  sublabel?: string
  icon: string
  color?: string
}

function loadRecent(): RecentEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (x): x is RecentEntry =>
          typeof x === 'object' &&
          x !== null &&
          typeof (x as RecentEntry).id === 'string' &&
          typeof (x as RecentEntry).label === 'string',
      )
      .slice(0, RECENT_LIMIT)
  } catch {
    return []
  }
}

function saveRecent(entries: RecentEntry[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(entries))
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

// A small, stable subset of action ids surfaced as suggestions on empty input.
const SUGGESTED_ACTION_IDS = [
  'act:assistant',
  'act:compose',
  'act:inbox',
  'act:toggle-theme',
  'act:sync',
]

// ---------------------------------------------------------------------------
// Inner palette (mounted only while open so the data hook — and its
// TanStack Query requests — fire lazily on first open).
// ---------------------------------------------------------------------------
function CommandPaletteInner() {
  const { items, isLoading } = useCommandData()
  const [query, setQuery] = useState('')
  // Lazy initializer reads localStorage synchronously on (client-only) mount.
  const [recent, setRecent] = useState<RecentEntry[]>(() => loadRecent())

  const pushRecent = (item: {
    id: string
    type: 'email' | 'sender' | 'category' | 'action'
    label: string
    sublabel?: string
    icon: string
    color?: string
  }) => {
    const entry: RecentEntry = {
      id: item.id,
      type: item.type,
      label: item.label,
      sublabel: item.sublabel,
      icon: item.icon,
      color: item.color,
    }
    setRecent((prev) => {
      const next = [entry, ...prev.filter((p) => p.id !== entry.id)].slice(0, RECENT_LIMIT)
      saveRecent(next)
      return next
    })
  }

  const handleSelect = (item: (typeof items)[number]) => {
    pushRecent(item)
    item.onSelect()
  }

  const handleRecentSelect = (entry: RecentEntry) => {
    const original = items.find((i) => i.id === entry.id)
    if (original) {
      handleSelect(original)
    }
  }

  const grouped = useMemo(
    () => ({
      action: items.filter((i) => i.group === 'action'),
      category: items.filter((i) => i.group === 'category'),
      sender: items.filter((i) => i.group === 'sender'),
      email: items.filter((i) => i.group === 'email'),
    }),
    [items],
  )

  const suggested = useMemo(() => {
    const byId = new Map(grouped.action.map((a) => [a.id, a]))
    return SUGGESTED_ACTION_IDS.map((id) => byId.get(id)).filter(
      (x): x is (typeof grouped.action)[number] => Boolean(x),
    )
  }, [grouped.action])

  const renderItem = (item: (typeof items)[number]) => (
    <CommandItem
      key={item.id}
      value={`${item.label} ${item.sublabel ?? ''} ${item.keywords ?? ''}`}
      onSelect={() => handleSelect(item)}
      className="gap-3 py-2.5"
    >
      {item.type === 'category' && item.color ? (
        <CategoryDot color={item.color} className="h-2.5 w-2.5 shrink-0" />
      ) : (
        <ActionIcon name={item.icon} className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm">{item.label}</span>
        {item.sublabel && (
          <span className="truncate text-xs text-muted-foreground">{item.sublabel}</span>
        )}
      </div>
      {item.type === 'action' && (
        <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
      )}
    </CommandItem>
  )

  const renderRecent = (entry: RecentEntry) => (
    <CommandItem
      key={`recent:${entry.id}`}
      value={`recent ${entry.label} ${entry.sublabel ?? ''}`}
      onSelect={() => handleRecentSelect(entry)}
      className="gap-3 py-2.5"
    >
      {entry.type === 'category' && entry.color ? (
        <CategoryDot color={entry.color} className="h-2.5 w-2.5 shrink-0" />
      ) : (
        <ActionIcon name={entry.icon} className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm">{entry.label}</span>
        {entry.sublabel && (
          <span className="truncate text-xs text-muted-foreground">{entry.sublabel}</span>
        )}
      </div>
      <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
        recent
      </span>
    </CommandItem>
  )

  return (
    <Command className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group]]:px-1">
      <CommandInput
        placeholder="Search emails, senders, sections, or run a command…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[60vh]">
        {isLoading ? (
          <CommandGroup heading="Loading">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2.5">
                <Skeleton className="h-4 w-4 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </CommandGroup>
        ) : query === '' ? (
          <>
            {recent.length > 0 && (
              <CommandGroup heading="Recent">{recent.map(renderRecent)}</CommandGroup>
            )}
            {suggested.length > 0 && (
              <CommandGroup heading="Suggested actions">
                {suggested.map(renderItem)}
              </CommandGroup>
            )}
          </>
        ) : (
          <>
            {grouped.email.length > 0 && (
              <CommandGroup heading="Emails">{grouped.email.map(renderItem)}</CommandGroup>
            )}
            {grouped.sender.length > 0 && (
              <CommandGroup heading="Senders">{grouped.sender.map(renderItem)}</CommandGroup>
            )}
            {grouped.category.length > 0 && (
              <CommandGroup heading="Sections">
                {grouped.category.map(renderItem)}
              </CommandGroup>
            )}
            {grouped.action.length > 0 && (
              <CommandGroup heading="Actions">{grouped.action.map(renderItem)}</CommandGroup>
            )}
            <CommandEmpty>No results found.</CommandEmpty>
          </>
        )}
      </CommandList>
    </Command>
  )
}

// ---------------------------------------------------------------------------
// Outer wrapper — always mounted in the app shell.
// Owns the global Cmd/Ctrl+K keydown listener + the Dialog open state.
// The inner palette is only mounted while open so data fetching is lazy.
// ---------------------------------------------------------------------------
export function CommandPalette() {
  const open = useUIStore((s) => s.commandOpen)
  const setCommandOpen = useUIStore((s) => s.setCommandOpen)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen(!useUIStore.getState().commandOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setCommandOpen])

  return (
    <Dialog open={open} onOpenChange={setCommandOpen}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          // Reset the default centered/sized dialog styling.
          'left-0 right-0 top-auto bottom-0 grid-flow-row gap-0 p-0',
          'translate-x-0 translate-y-0 w-full max-w-none rounded-t-xl rounded-b-none',
          // Desktop: centered, max-w-xl.
          'sm:top-[40%] sm:bottom-auto sm:left-1/2 sm:max-w-xl',
          'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl',
        )}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search emails, senders, sections, or run a command.
        </DialogDescription>

        {open && <CommandPaletteInner />}

        <div className="flex items-center justify-between gap-2 border-t border-border bg-popover px-3 py-2 text-xs text-muted-foreground">
          <span className="truncate">
            <kbd className="font-sans">↑↓</kbd> navigate ·{' '}
            <kbd className="font-sans">↵</kbd> select ·{' '}
            <kbd className="font-sans">esc</kbd> close
          </span>
          <kbd className="hidden rounded border border-border bg-background px-1.5 py-0.5 font-sans text-[10px] sm:inline">
            ⌘K
          </kbd>
        </div>
      </DialogContent>
    </Dialog>
  )
}
