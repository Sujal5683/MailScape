'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCategories, useAccounts } from '@/hooks/use-queries'
import { useUIStore } from '@/store/ui-store'
import { CategorySkeleton } from '@/components/common/skeletons'
import { SleekSeparator } from '@/components/common/separator'
import { EmptyState, ErrorState } from '@/components/common/states'
import type { CategorySummary } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Layers, Plus, Mail } from 'lucide-react'
import { CategoryCard } from './category-card'
import { CategoryDetail } from './category-detail'
import { CreateCategoryDialog } from './create-category-dialog'

export function OrganizedView() {
  const contextCategoryId = useUIStore((s) => s.contextCategoryId)
  const updateUIContext = useUIStore((s) => s.setContext)
  const [selectedId, setSelectedId] = useState<string | null>(contextCategoryId)
  const [createOpen, setCreateOpen] = useState(false)
  const { data: accounts, isLoading: accountsLoading } = useAccounts()
  const { data: categories, isLoading, isError, error, refetch } = useCategories()

  // Consume the navigation context once it has been read into local state so
  // that returning to this view (after going back) shows the grid.
  useEffect(() => {
    if (contextCategoryId) updateUIContext({ contextCategoryId: null })
  }, [contextCategoryId, updateUIContext])

  const selected = useMemo(
    () => categories?.find((c) => c.id === selectedId) ?? null,
    [categories, selectedId],
  )

  // ── No-accounts landing state ───────────────────────────────────────────────
  if (!accountsLoading && Array.isArray(accounts) && accounts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Mail className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Nothing to organize yet</h2>
          <p className="text-sm text-muted-foreground">
            Connect a Google account to start classifying your emails into smart sections.
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

  if (selected) {
    return <CategoryDetail category={selected} onBack={() => setSelectedId(null)} />
  }

  const totalUnread = categories?.reduce((sum, c) => sum + c.unreadCount, 0) ?? 0

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Layers className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">Organized</h1>
          <p className="truncate text-xs text-muted-foreground">
            {categories
              ? `${categories.length} institutional sections${totalUnread > 0 ? ` · ${totalUnread} unread` : ''}`
              : 'Loading sections…'}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Create Section</span>
          <span className="sm:hidden">New</span>
        </Button>
      </header>

      {/* Body */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4 pb-20 md:pb-6">
          {isLoading ? (
            <CategorySkeleton count={9} />
          ) : isError ? (
            <ErrorState
              title="Couldn't load sections"
              description={error?.message ?? 'We couldn’t reach the mailbox service.'}
              onRetry={() => refetch()}
            />
          ) : !categories || categories.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No custom sections yet"
              description="Create one to organize a recurring institute source."
              action={
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" /> Create Section
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((c: CategorySummary, i: number) => (
                  <CategoryCard key={c.id} category={c} index={i} onOpen={() => setSelectedId(c.id)} />
                ))}
              </div>
              <SleekSeparator className="mt-6" />
            </>
          )}
        </div>
      </ScrollArea>

      <CreateCategoryDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
