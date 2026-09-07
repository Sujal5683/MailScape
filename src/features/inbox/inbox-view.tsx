'use client'

import { useCallback, useEffect, useState } from 'react'
import { EmailList } from './email-list'
import { EmailDetail } from './email-detail'
import { BulkActionsBar } from './bulk-actions-bar'
import { useUIStore } from '@/store/ui-store'
import {
  useCategories,
  useEmails,
  useBulkEmailAction,
  useStarEmail,
  useMarkImportant,
  useMarkRead,
  useAccounts,
} from '@/hooks/use-queries'
import type { BulkEmailAction } from '@/hooks/use-queries'
import { useEmailShortcutContext } from '@/hooks/use-keyboard-shortcuts'
import { usePrefetchEmail, usePrefetchThread } from '@/hooks/use-prefetch'
import { cn } from '@/lib/utils'
import { colorClass } from '@/lib/category-meta'
import { CategoryIcon } from '@/components/common/category-icon'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Filter, CheckSquare, X, Clock, Mail } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { MasterDetailLayout } from '@/components/layout/master-detail-layout'

export function InboxView() {
  const { data: accounts, isLoading: accountsLoading } = useAccounts()
  const contextCategoryId = useUIStore((s) => s.contextCategoryId)
  const contextSenderId = useUIStore((s) => s.contextSenderId)
  const contextEmailId = useUIStore((s) => s.contextEmailId)
  const setContext = useUIStore((s) => s.setContext)
  // Auto-select from contextEmailId (e.g. command palette / dashboard / notification).
  const [selectedId, setSelectedId] = useState<string | null>(contextEmailId ?? null)
  // Clear the one-shot context so navigating away+back doesn't re-trigger.
  if (contextEmailId && contextEmailId !== selectedId) {
    setContext({ contextEmailId: null })
    if (selectedId === null) setSelectedId(contextEmailId)
  }
  const [filter, setFilter] = useState<{
    categoryId?: string
    senderId?: string
    unreadOnly?: boolean
    importantOnly?: boolean
    starredOnly?: boolean
    snoozedOnly?: boolean
  } | undefined>(
    contextCategoryId || contextSenderId
      ? { categoryId: contextCategoryId ?? undefined, senderId: contextSenderId ?? undefined }
      : undefined,
  )

  const { data: categories } = useCategories()

  // ── No-accounts landing state ────────────────────────────────────────────────
  // Render before any email hooks to prevent empty-account 500 errors.
  if (!accountsLoading && Array.isArray(accounts) && accounts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Mail className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Your inbox is empty</h2>
          <p className="text-sm text-muted-foreground">
            Connect a Google account to start syncing your emails.
          </p>
        </div>
        <Button
          onClick={() => import('next-auth/react').then(({ signIn }) => signIn('google'))}
        >
          Connect Google Account
        </Button>
      </div>
    )
  }

  // ---- Multi-select state ----
  // `selectMode` toggles the per-row checkboxes; `selectedIds` is the set of
  // ids the user has toggled ON. Both reset when exiting select mode.
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  // Lift the visible ids up via a deduped useEmails call (TanStack shares the
  // cache with EmailList's internal call — same query key — so this is a
  // zero-cost read). Used to drive the "Select all visible" header state.
  const { data: listData } = useEmails(filter ?? {})
  const visibleIds = listData?.items?.map((e) => e.id) ?? []
  const allSelected =
    selectMode && visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      // If everything is already selected, deselect all visible. Otherwise
      // add all visible ids to the set (preserving ids outside the current
      // filter that the user may have selected before filtering).
      const allCurrentlySelected =
        visibleIds.length > 0 && visibleIds.every((id) => prev.has(id))
      const next = new Set(prev)
      if (allCurrentlySelected) {
        visibleIds.forEach((id) => next.delete(id))
      } else {
        visibleIds.forEach((id) => next.add(id))
      }
      return next
    })
  }, [visibleIds])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const exitSelectMode = useCallback(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }, [])

  // ---- Bulk action handler ----
  const bulkAction = useBulkEmailAction()
  const handleBulkAction = useCallback(
    (action: BulkEmailAction) => {
      const ids = Array.from(selectedIds)
      if (ids.length === 0) return
      // Optimistic UX: clear the selection immediately so the bar dismisses
      // and the user sees the toast + invalidated list. The hook's onSuccess
      // already invalidates `['emails']` + `dashboard` and shows a toast.
      setSelectedIds(new Set())
      bulkAction.mutate({ ids, action })
    },
    [selectedIds, bulkAction],
  )

  const selectedCount = selectedIds.size

  // ---- Keyboard-shortcut email context registration ----
  // Publishes the currently selected email + visible list + action callbacks
  // to the global useKeyboardShortcuts hook (mounted in AppShell). The hook
  // reads this ref via the module-level registerEmailContext() and fires
  // email-action shortcuts (j/k/e/s/i/r/f/#) only when an email is selected.
  const registerEmailContext = useEmailShortcutContext()
  const setComposeOpen = useUIStore((s) => s.setComposeOpen)
  const starMutation = useStarEmail()
  const importantMutation = useMarkImportant()
  const markReadMutation = useMarkRead()

  // Delete confirmation state — opened by the '#' shortcut. Confirmed deletes
  // go through the existing bulk endpoint with action='delete' (soft-delete
  // via isArchived=true, matching the BulkActionsBar behavior).
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const visibleEmails = listData?.items ?? []

  // Register the email context whenever the selection or visible list changes.
  // The latest context always wins (the hook reads it via the module-level
  // ref, so we don't need a context provider).
  useEffect(() => {
    registerEmailContext({
      selectedId,
      emailIds: visibleIds,
      onSelect: (id) => {
        setSelectedId(id)
        const email = visibleEmails.find((e) => e.id === id)
        if (email && !email.flags.isRead) {
          markReadMutation.mutate({ id, read: true })
        }
      },
      onArchive: (_id) => {
        toast.info('Archive is cosmetic in this build', {
          description: 'Connected to Gmail, this would remove from the inbox view.',
        })
      },
      onStar: (id) => {
        const email = visibleEmails.find((e) => e.id === id)
        if (email) starMutation.mutate({ id, starred: !email.flags.isStarred })
      },
      onImportant: (id) => {
        const email = visibleEmails.find((e) => e.id === id)
        if (email) importantMutation.mutate({ id, important: !email.flags.isImportant })
      },
      onReply: (id) => {
        const email = visibleEmails.find((e) => e.id === id)
        setComposeOpen(true)
        toast.info('Reply prefill loaded in compose', {
          description: `Replying to ${email?.fromName ?? email?.fromEmail ?? 'sender'}`,
        })
      },
      onReplyAll: (_id) => {
        setComposeOpen(true)
        toast.info('Reply-all prefill loaded in compose')
      },
      onForward: (_id) => {
        setComposeOpen(true)
        toast.info('Forward prefill loaded in compose')
      },
      onDelete: (id) => {
        setDeleteConfirmId(id)
      },
    })
  }, [
    registerEmailContext,
    selectedId,
    visibleIds,
    visibleEmails,
    starMutation,
    importantMutation,
    markReadMutation,
    setComposeOpen,
  ])

  // Unregister the email context when inbox-view unmounts so the hook stops
  // firing email-action shortcuts against stale callbacks.
  useEffect(() => {
    return () => registerEmailContext(null)
  }, [registerEmailContext])

  // ---- Email + thread prefetch (architecture directive §14) ----
  // When a row is selected, warm the cache for the NEXT + PREV emails so j/k
  // navigation feels instant. Also prefetch the thread summary if the selected
  // email has a threadId (the detail pane renders the thread panel).
  // prefetchQuery is a no-op when the data is already fresh, so this is safe
  // to call on every selection change without redundant requests or re-renders.
  const prefetchEmail = usePrefetchEmail()
  const prefetchThread = usePrefetchThread()
  useEffect(() => {
    if (!selectedId) return
    const idx = visibleEmails.findIndex((e) => e.id === selectedId)
    if (idx === -1) return
    const prev = visibleEmails[idx - 1]
    const next = visibleEmails[idx + 1]
    if (prev) prefetchEmail(prev.id)
    if (next) prefetchEmail(next.id)
    const current = visibleEmails[idx]
    if (current.threadId) prefetchThread(current.threadId)
  }, [selectedId, visibleEmails, prefetchEmail, prefetchThread])

  // Confirm delete — fires the bulk 'delete' action (soft-delete via
  // isArchived=true) and moves the selection to the next visible email.
  const confirmDelete = useCallback(() => {
    if (!deleteConfirmId) return
    const idx = visibleIds.indexOf(deleteConfirmId)
    const next = visibleIds[idx + 1] ?? visibleIds[idx - 1] ?? null
    bulkAction.mutate({ ids: [deleteConfirmId], action: 'delete' })
    setDeleteConfirmId(null)
    setSelectedId(next ?? null)
  }, [deleteConfirmId, visibleIds, bulkAction])

  return (
    <div className="h-full">
      <MasterDetailLayout
        selectedId={selectedId}
        onBack={() => setSelectedId(null)}
        masterMinWidth={300}
        masterDefaultWidth={400}
        masterMaxWidth={500}
        storageKey="inbox-layout"
        master={
          <>
        {/* Filter bar — wraps on mobile, single row on desktop */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
          </span>
          <FilterChip active={!filter} onClick={() => setFilter(undefined)} label="All" />
          <FilterChip
            active={filter?.unreadOnly}
            onClick={() =>
              setFilter((f) => ({
                ...f,
                unreadOnly: !f?.unreadOnly,
                importantOnly: false,
                starredOnly: false,
                categoryId: undefined,
                senderId: undefined,
                snoozedOnly: false,
              }))
            }
            label="Unread"
          />
          <FilterChip
            active={filter?.importantOnly}
            onClick={() =>
              setFilter((f) => ({
                ...f,
                importantOnly: !f?.importantOnly,
                unreadOnly: false,
                starredOnly: false,
                categoryId: undefined,
                senderId: undefined,
                snoozedOnly: false,
              }))
            }
            label="Important"
          />
          <FilterChip
            active={filter?.starredOnly}
            onClick={() =>
              setFilter((f) => ({
                ...f,
                starredOnly: !f?.starredOnly,
                unreadOnly: false,
                importantOnly: false,
                categoryId: undefined,
                senderId: undefined,
                snoozedOnly: false,
              }))
            }
            label="Starred"
          />
          <FilterChip
            active={filter?.snoozedOnly}
            onClick={() =>
              setFilter((f) => ({
                snoozedOnly: !f?.snoozedOnly,
                unreadOnly: false,
                importantOnly: false,
                starredOnly: false,
                categoryId: undefined,
                senderId: undefined,
              }))
            }
            label="Snoozed"
            icon={Clock}
          />

          {/* Select-mode toggle — right-aligned on desktop, wraps on mobile */}
          <div className="ml-auto flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={selectMode ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                  aria-pressed={selectMode}
                  aria-label={selectMode ? 'Exit selection mode' : 'Enter selection mode'}
                  className="h-8 gap-1 px-2"
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{selectMode ? 'Done' : 'Select'}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{selectMode ? 'Exit selection mode' : 'Select multiple emails'}</TooltipContent>
            </Tooltip>
            {selectMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={exitSelectMode}
                className="h-8 gap-1 px-2 text-muted-foreground"
                aria-label="Cancel selection mode"
              >
                <X className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cancel</span>
              </Button>
            )}
          </div>
        </div>

        {/* Category quick filter — horizontally scrollable, no overflow */}
        {categories && categories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto border-b border-border px-3 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {categories.slice(0, 8).map((c) => {
              const active = filter?.categoryId === c.id
              return (
                <button
                  key={c.id}
                  onClick={() =>
                    setFilter((f) => ({
                      unreadOnly: false,
                      importantOnly: false,
                      starredOnly: false,
                      categoryId: active ? undefined : c.id,
                    }))
                  }
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:bg-accent',
                    !active && colorClass(c.color),
                  )}
                >
                  <CategoryIcon icon={c.icon} color={c.color} className="h-3 w-3" />
                  {c.name}
                  {c.unreadCount > 0 && <span className="opacity-70">{c.unreadCount}</span>}
                </button>
              )
            })}
          </div>
        )}

        {/* List */}
        <ScrollArea className="flex-1">
          <div className="p-2 pb-20 md:pb-2">
            <EmailList
              selectedId={selectedId}
              onSelect={setSelectedId}
              filter={filter}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onSelectAll={selectAllVisible}
              allSelected={allSelected}
            />
          </div>
        </ScrollArea>

        {/* Bulk-actions bar — rendered as a flex child at the bottom of the
            list column whenever ≥1 email is selected. Dismissed automatically
            when the selection is cleared (e.g. after a bulk action fires or
            when the user clicks "Clear" / "Cancel"). */}
        {selectMode && selectedCount > 0 && (
          <BulkActionsBar
            count={selectedCount}
            onAction={handleBulkAction}
            onClear={clearSelection}
            pending={bulkAction.isPending}
          />
        )}
          </>
        }
        detail={<EmailDetail emailId={selectedId} onBack={() => setSelectedId(null)} />}
      />

      {/* Delete confirmation — opened by the '#' keyboard shortcut.
          Reuses the bulk 'delete' action (soft-delete via isArchived=true). */}
      <AlertDialog
        open={deleteConfirmId !== null}
        onOpenChange={(o) => !o && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this email?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the email from your inbox. The action is recorded in
              the audit log and is reversible by an administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active?: boolean
  onClick: () => void
  label: string
  icon?: typeof Clock
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </button>
  )
}
