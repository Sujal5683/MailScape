'use client'

import { useMemo, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
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
import {
  useTemplates,
  useDeleteTemplate,
} from '@/hooks/use-queries'
import {
  categoryBadgeClass,
  categoryDotClass,
  categoryLabel,
  TemplateEditorDialog,
} from './template-editor-dialog'
import type { EmailTemplate, EmailTemplateCategory } from '@/lib/types'
import {
  FileText,
  Plus,
  Search,
  Pencil,
  Trash2,
  ArrowDownToLine,
  Inbox as InboxIcon,
  Loader2,
} from 'lucide-react'

// Category display order (matches CATEGORY_OPTIONS order in the editor dialog).
const CATEGORY_ORDER: ReadonlyArray<EmailTemplateCategory> = [
  'general',
  'followup',
  'request',
  'announcement',
  'custom',
]

interface TemplatesPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Called when the user clicks "Insert" on a template row. The compose form
   * fills its subject + body fields and closes the panel.
   */
  onInsert: (template: EmailTemplate) => void
}

/**
 * TemplatesPanel — a Sheet (right side) listing the account's saved email
 * templates, grouped by category, with search + per-row actions.
 *
 * Features:
 *  - "New template" button (opens TemplateEditorDialog in create mode).
 *  - Search by name (case-insensitive substring match).
 *  - Per-row: name, subject preview (truncated), category badge, edit, delete.
 *  - "Insert" action that fills the compose form's subject + body.
 *  - Loading skeleton, error state, empty state.
 *
 * The panel is fully controlled (open/onOpenChange) so the host ComposeForm
 * decides when to display it. The TemplateEditorDialog is owned by the panel
 * so it can be opened in either create or edit mode from a single source of
 * truth.
 */
export function TemplatesPanel({ open, onOpenChange, onInsert }: TemplatesPanelProps) {
  const { data: templates, isLoading, error } = useTemplates()
  const deleteMut = useDeleteTemplate()

  const [search, setSearch] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)

  const list = templates ?? []
  const q = search.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!q) return list
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q),
    )
  }, [list, q])

  // Group filtered templates by category, preserving CATEGORY_ORDER; an
  // empty group is omitted.
  const groups = useMemo(() => {
    const byCat = new Map<EmailTemplateCategory, EmailTemplate[]>()
    for (const t of filtered) {
      const arr = byCat.get(t.category) ?? []
      arr.push(t)
      byCat.set(t.category, arr)
    }
    return CATEGORY_ORDER.filter((c) => byCat.has(c)).map((c) => ({
      category: c,
      items: byCat.get(c)!,
    }))
  }, [filtered])

  const openCreate = () => {
    setEditingTemplate(null)
    setEditorOpen(true)
  }

  const openEdit = (t: EmailTemplate) => {
    setEditingTemplate(t)
    setEditorOpen(true)
  }

  const handleInsert = (t: EmailTemplate) => {
    onInsert(t)
    onOpenChange(false)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        >
          <SheetHeader className="gap-1 border-b px-4 py-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <SheetTitle className="text-base">Templates</SheetTitle>
              {list.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-[10px]">
                  {list.length}
                </Badge>
              )}
            </div>
            <SheetDescription className="text-xs">
              Reusable subject + body presets. Insert one to fill the compose
              form, or save the current draft as a new template.
            </SheetDescription>
          </SheetHeader>

          {/* Search + new template */}
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or subject…"
                aria-label="Search templates"
                className="h-9 pl-8"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="h-9 shrink-0 gap-1"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" />
              New
            </Button>
          </div>

          {/* List */}
          <div className="min-h-0 flex-1">
            {error ? (
              <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                <p className="text-sm text-destructive">Failed to load templates.</p>
                <p className="text-xs text-muted-foreground">
                  {error instanceof Error ? error.message : 'Unknown error'}
                </p>
              </div>
            ) : isLoading ? (
              <div className="space-y-3 p-4" aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded-md bg-muted/50"
                    aria-hidden="true"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <InboxIcon className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-medium">
                  {q ? 'No matching templates' : 'No templates yet'}
                </h3>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  {q
                    ? `No templates match "${search}". Try a different search.`
                    : 'Save one to reuse for common replies.'}
                </p>
                {!q && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-4 gap-1"
                    onClick={openCreate}
                  >
                    <Plus className="h-4 w-4" />
                    Create your first template
                  </Button>
                )}
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="flex flex-col gap-4 p-3">
                  {groups.map((group) => (
                    <section key={group.category} aria-label={categoryLabel(group.category)}>
                      <div className="flex items-center gap-2 px-1 pb-1.5">
                        <span
                          className={cn(
                            'inline-block h-2 w-2 rounded-full',
                            categoryDotClass(group.category),
                          )}
                          aria-hidden
                        />
                        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {categoryLabel(group.category)}
                        </h4>
                        <Badge
                          variant="secondary"
                          className="h-4 px-1 text-[10px] text-muted-foreground"
                        >
                          {group.items.length}
                        </Badge>
                      </div>
                      <ul className="space-y-1.5">
                        {group.items.map((t) => (
                          <li key={t.id}>
                            <TemplateRow
                              template={t}
                              isDeleting={
                                deleteMut.isPending &&
                                deleteMut.variables === t.id
                              }
                              onInsert={() => handleInsert(t)}
                              onEdit={() => openEdit(t)}
                              onDelete={() => deleteMut.mutate(t.id)}
                            />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <Separator />

          {/* Footer hint */}
          <div className="px-4 py-3">
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">Tip:</span>{' '}
              Inserting a template overwrites the current subject and body —
              review before sending.
            </p>
          </div>
        </SheetContent>
      </Sheet>

      <TemplateEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={editingTemplate}
      />
    </>
  )
}

/**
 * TemplateRow — a single template card.
 *
 * Layout: header row (category badge + name + per-row actions) and a body
 * row (subject preview + relative timestamp). The "Insert" action is the
 * primary CTA; edit + delete are smaller ghost buttons that appear on hover
 * (and stay focusable for keyboard users).
 */
function TemplateRow({
  template,
  isDeleting,
  onInsert,
  onEdit,
  onDelete,
}: {
  template: EmailTemplate
  isDeleting: boolean
  onInsert: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const subjectPreview =
    template.subject.trim() ||
    '(no subject)'

  const bodyPreview = template.body.trim()
  const trimmedBody = bodyPreview.slice(0, 120)
  const bodyEllipsis = bodyPreview.length > 120 ? '…' : ''

  return (
    <div className="group rounded-md border border-border/60 bg-card p-3 transition-all hover:-translate-y-px hover:border-border hover:shadow-sm">
      {/* Header: badge + name + actions */}
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
            categoryBadgeClass(template.category),
          )}
        >
          <span
            className={cn(
              'inline-block h-1.5 w-1.5 rounded-full',
              categoryDotClass(template.category),
            )}
            aria-hidden
          />
          {categoryLabel(template.category)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" title={template.name}>
            {template.name}
          </p>
        </div>
        {/* Edit + delete (compact, ghost) */}
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
            aria-label={`Edit template "${template.name}"`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                aria-label={`Delete template "${template.name}"`}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete template?</AlertDialogTitle>
                <AlertDialogDescription>
                  <span className="font-medium text-foreground">{template.name}</span>{' '}
                  will be permanently removed. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Body: subject preview + body snippet + timestamp */}
      <div className="mt-2">
        <p className="truncate text-xs font-medium text-foreground" title={template.subject}>
          {subjectPreview}
        </p>
        {trimmedBody && (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
            {trimmedBody}
            {bodyEllipsis}
          </p>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground/70">
            {formatRelative(template.updatedAt)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={onInsert}
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            Insert
          </Button>
        </div>
      </div>
    </div>
  )
}
