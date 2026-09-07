'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  useCreateTemplate,
  useUpdateTemplate,
} from '@/hooks/use-queries'
import type { EmailTemplate, EmailTemplateCategory } from '@/lib/types'
import { Save, Loader2 } from 'lucide-react'

// Category → badge styling. Per the design rules:
//   general=muted (bg-muted + text-muted-foreground),
//   followup=teal   (cat-teal   via cat-bg-soft + cat-text),
//   request=amber   (cat-amber),
//   announcement=violet (cat-violet),
//   custom=slate    (cat-slate).
// `variant: 'muted'` short-circuits the cat-* classes for the General badge.
const CATEGORY_OPTIONS: ReadonlyArray<{
  value: EmailTemplateCategory
  label: string
  variant: 'cat' | 'muted'
  colorClass: string
}> = [
  { value: 'general', label: 'General', variant: 'muted', colorClass: '' },
  { value: 'followup', label: 'Follow-up', variant: 'cat', colorClass: 'cat-teal' },
  { value: 'request', label: 'Request', variant: 'cat', colorClass: 'cat-amber' },
  { value: 'announcement', label: 'Announcement', variant: 'cat', colorClass: 'cat-violet' },
  { value: 'custom', label: 'Custom', variant: 'cat', colorClass: 'cat-slate' },
]

// Exported so TemplatesPanel can render consistent category badges.
export function categoryBadgeClass(category: EmailTemplateCategory): string {
  const opt = CATEGORY_OPTIONS.find((o) => o.value === category)
  if (!opt) return 'bg-muted text-muted-foreground'
  if (opt.variant === 'muted') return 'bg-muted text-muted-foreground'
  return cn('cat-bg-soft cat-text', opt.colorClass)
}

export function categoryDotClass(category: EmailTemplateCategory): string {
  const opt = CATEGORY_OPTIONS.find((o) => o.value === category)
  if (!opt) return ''
  if (opt.variant === 'muted') return 'bg-muted-foreground'
  return cn('cat-dot', opt.colorClass)
}

export function categoryLabel(category: EmailTemplateCategory): string {
  return CATEGORY_OPTIONS.find((o) => o.value === category)?.label ?? 'Custom'
}

interface TemplateEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * When provided, the dialog operates in "edit" mode (uses useUpdateTemplate
   * and seeds the form from this template). When omitted, the dialog is in
   * "create" mode (uses useCreateTemplate).
   */
  template?: EmailTemplate | null
  /**
   * Optional seed values used in create mode (e.g. "Save as template" prefilling
   * subject+body from the live compose form). Ignored when `template` is set.
   */
  defaults?: {
    name?: string
    subject?: string
    body?: string
    category?: EmailTemplateCategory
  }
  /**
   * Optional callback invoked after a successful create or update. Useful for
   * the compose form to optionally auto-insert the just-saved template body.
   */
  onSaved?: (template: EmailTemplate) => void
}

/**
 * TemplateEditorDialog — create or edit an EmailTemplate.
 *
 * Renders the same form shape in both modes (name + category + subject + body);
 * the only differences are the submit button label + which mutation runs.
 * The dialog is controlled (open/onOpenChange) so the host component (the
 * Compose form's "Save as template" action, or the TemplatesPanel "New
 * template"/edit buttons) decides when it opens.
 */
export function TemplateEditorDialog({
  open,
  onOpenChange,
  template,
  defaults,
  onSaved,
}: TemplateEditorDialogProps) {
  // The dialog body is mounted only while `open` is true. Each open mounts
  // a fresh <TemplateForm> whose useState lazy initializers seed from the
  // current `template`/`defaults` — this avoids setState-in-effect entirely
  // and guarantees the form reflects the latest target every time it opens.
  // The `key` includes the template id (or 'create') so switching the edit
  // target while the dialog is open remounts the form with the new seed.
  const formKey = open
    ? template
      ? `edit-${template.id}`
      : 'create'
    : 'closed'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && (
          <TemplateForm
            key={formKey}
            template={template}
            defaults={defaults}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

interface TemplateFormProps {
  template?: EmailTemplate | null
  defaults?: {
    name?: string
    subject?: string
    body?: string
    category?: EmailTemplateCategory
  }
  onOpenChange: (open: boolean) => void
  onSaved?: (template: EmailTemplate) => void
}

function TemplateForm({
  template,
  defaults,
  onOpenChange,
  onSaved,
}: TemplateFormProps) {
  const isEdit = !!template
  const createMut = useCreateTemplate()
  const updateMut = useUpdateTemplate()

  // Lazy initial state — seeded ONCE at mount (the parent remounts this form
  // on every open via `key`, so the seed values are always fresh).
  const [name, setName] = useState(() =>
    template ? template.name : (defaults?.name ?? ''),
  )
  const [category, setCategory] = useState<EmailTemplateCategory>(() =>
    template ? template.category : (defaults?.category ?? 'general'),
  )
  const [subject, setSubject] = useState(() =>
    template ? template.subject : (defaults?.subject ?? ''),
  )
  const [body, setBody] = useState(() =>
    template ? template.body : (defaults?.body ?? ''),
  )

  const isPending = createMut.isPending || updateMut.isPending

  const handleSubmit = () => {
    const trimmedName = name.trim()
    if (!trimmedName || isPending) return

    if (isEdit && template) {
      updateMut.mutate(
        {
          id: template.id,
          name: trimmedName,
          subject,
          body,
          category,
        },
        {
          onSuccess: (updated) => {
            onOpenChange(false)
            onSaved?.(updated)
          },
        },
      )
    } else {
      createMut.mutate(
        {
          name: trimmedName,
          subject,
          body,
          category,
        },
        {
          onSuccess: (created) => {
            onOpenChange(false)
            onSaved?.(created)
          },
        },
      )
    }
  }

  const previewCat = category

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit template' : 'New template'}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? 'Update the template fields. Saved templates can be reused from the Templates panel.'
            : 'Save a reusable subject + body preset. Insert it later from the Templates panel.'}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
          {/* Name + category */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="tpl-name" className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="tpl-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Out-of-office auto-reply"
                maxLength={120}
                disabled={isPending}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isPending && name.trim()) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
              />
            </div>
            <div className="w-full space-y-1.5 sm:w-44">
              <Label htmlFor="tpl-category" className="text-sm font-medium">
                Category
              </Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as EmailTemplateCategory)}
                disabled={isPending}
              >
                <SelectTrigger id="tpl-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            'inline-block h-2 w-2 rounded-full',
                            opt.variant === 'muted' ? 'bg-muted-foreground' : cn('cat-dot', opt.colorClass),
                          )}
                          aria-hidden
                        />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Category preview badge */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Badge preview:</span>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
                categoryBadgeClass(previewCat),
              )}
            >
              <span
                className={cn('inline-block h-1.5 w-1.5 rounded-full', categoryDotClass(previewCat))}
                aria-hidden
              />
              {categoryLabel(previewCat)}
            </span>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-subject" className="text-sm font-medium">
              Subject
            </Label>
            <Input
              id="tpl-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Template subject line"
              disabled={isPending}
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-body" className="text-sm font-medium">
              Body
            </Label>
            <Textarea
              id="tpl-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the template message…"
              className="min-h-48 resize-y"
              disabled={isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isEdit ? 'Saving…' : 'Saving…'}
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {isEdit ? 'Save changes' : 'Save template'}
              </>
            )}
          </Button>
        </DialogFooter>
    </>
  )
}
