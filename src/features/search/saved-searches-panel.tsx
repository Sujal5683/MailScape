'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { formatRelative } from '@/lib/format'
import { useSavedSearches, useCreateSavedSearch, useDeleteSavedSearch } from '@/hooks/use-queries'
import { summarizeFilters, hasActiveFilters } from './search-helpers'
import type { SearchFilters, SavedSearch, CategorySummary } from '@/lib/types'
import { Bookmark, BookmarkPlus, Trash2, ChevronDown, Loader2 } from 'lucide-react'

interface SavedSearchesPanelProps {
  /** The currently committed filters — what gets saved when the user clicks "Save current". */
  currentFilters: SearchFilters | null
  /** Categories list — used to resolve categoryIds in the filter summary. */
  categories: CategorySummary[] | undefined
  /** Called when the user clicks a saved-search row; the parent should hydrate the filter form + commit. */
  onLoadFilters: (filters: SearchFilters) => void
}

/**
 * Sidebar panel for the Search view. Lists the account's saved-search
 * presets (newest first) with a compact filter summary, supports one-click
 * load + per-row delete (AlertDialog confirm), and offers a "Save current
 * search" action that opens a Dialog to name + persist the current
 * committed filters.
 *
 * The panel is a Collapsible Card so it stays compact when collapsed. On
 * mobile it stacks above the FilterPanel; on desktop it stacks the same
 * way inside the left input column. Saved-search rows have hover-lift,
 * a Bookmark glyph, a bold name, a muted summary, and an on-hover delete
 * button — per the design rules.
 */
export function SavedSearchesPanel({
  currentFilters,
  categories,
  onLoadFilters,
}: SavedSearchesPanelProps) {
  const { data: saved, isLoading, error } = useSavedSearches()
  const createMut = useCreateSavedSearch()
  const deleteMut = useDeleteSavedSearch()
  const [open, setOpen] = useState(true)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [name, setName] = useState('')

  const canSave = hasActiveFilters(currentFilters)

  const openSaveDialog = () => {
    if (!canSave) return
    setName('')
    setSaveDialogOpen(true)
  }

  const confirmSave = () => {
    if (!name.trim() || !currentFilters) return
    createMut.mutate(
      { name: name.trim(), filters: currentFilters },
      { onSuccess: () => setSaveDialogOpen(false) },
    )
  }

  const handleDelete = (id: string) => {
    deleteMut.mutate(id)
  }

  const list = saved ?? []
  const currentSummary =
    currentFilters && hasActiveFilters(currentFilters)
      ? summarizeFilters(currentFilters, categories)
      : ''

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <Card className="rounded-none border-x-0 border-t-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex flex-1 items-center gap-2 text-left"
                  aria-label={open ? 'Collapse saved searches' : 'Expand saved searches'}
                >
                  <Bookmark className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">Saved searches</CardTitle>
                  {list.length > 0 && (
                    <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-[10px]">
                      {list.length}
                    </Badge>
                  )}
                  <ChevronDown
                    className={cn(
                      'ml-auto h-4 w-4 text-muted-foreground transition-transform',
                      open && 'rotate-180',
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 shrink-0 gap-1 px-2 text-xs"
                disabled={!canSave}
                onClick={openSaveDialog}
                title={
                  canSave
                    ? 'Save the current filters as a preset'
                    : 'Apply at least one filter to save'
                }
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                Save current
              </Button>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {error ? (
                <p className="text-xs text-destructive">
                  Failed to load saved searches.
                </p>
              ) : isLoading ? (
                <div className="space-y-2" aria-busy="true">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-12 animate-pulse rounded-md bg-muted/50"
                      aria-hidden="true"
                    />
                  ))}
                </div>
              ) : list.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No saved searches yet. Apply filters and save them for quick re-use.
                </p>
              ) : (
                <ScrollArea className="max-h-72 rounded-md">
                  <ul className="space-y-1 pr-1">
                    {list.map((s) => (
                      <li key={s.id}>
                        <SavedSearchRow
                          saved={s}
                          summary={summarizeFilters(s.filters, categories)}
                          isDeleting={deleteMut.isPending}
                          onLoad={() => onLoadFilters(s.filters)}
                          onDelete={() => handleDelete(s.id)}
                        />
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Save current search dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save current search</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="saved-search-name"
                className="text-xs font-medium text-muted-foreground"
              >
                Name
              </label>
              <Input
                id="saved-search-name"
                autoFocus
                placeholder="e.g. Unread placement emails"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !createMut.isPending) {
                    e.preventDefault()
                    confirmSave()
                  }
                }}
                maxLength={120}
                disabled={createMut.isPending}
              />
            </div>
            {currentSummary && (
              <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Filters
                </p>
                <p className="mt-0.5 text-xs text-foreground">{currentSummary}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={createMut.isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={confirmSave}
              disabled={!name.trim() || createMut.isPending}
            >
              {createMut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <BookmarkPlus className="h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * A single saved-search row. Clicking anywhere on the row loads the preset
 * filters into the active form; the delete button is a sibling (not nested)
 * so it doesn't trigger the row's click handler. Delete is wrapped in an
 * AlertDialog for confirmation.
 */
function SavedSearchRow({
  saved,
  summary,
  isDeleting,
  onLoad,
  onDelete,
}: {
  saved: SavedSearch
  summary: string
  isDeleting: boolean
  onLoad: () => void
  onDelete: () => void
}) {
  return (
    <div className="group relative flex items-stretch rounded-md transition-transform">
      {/* Clickable row (load filters on click + keyboard) */}
      <button
        type="button"
        onClick={onLoad}
        className="flex min-w-0 flex-1 items-start gap-2 rounded-md border border-transparent px-2 py-2 text-left transition-all hover:-translate-y-px hover:border-border hover:bg-accent/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        title={`Load "${saved.name}"`}
      >
        <Bookmark className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{saved.name}</p>
          {summary ? (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{summary}</p>
          ) : null}
          <p className="mt-0.5 text-[10px] text-muted-foreground/70">
            {formatRelative(saved.createdAt)}
          </p>
        </div>
      </button>

      {/* Delete (sibling so it doesn't trigger the load) — appears on hover */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            className="absolute right-1.5 top-1.5 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
            aria-label={`Remove saved search "${saved.name}"`}
            disabled={isDeleting}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove saved search?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{saved.name}</span> will be permanently
              removed from your saved searches. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
