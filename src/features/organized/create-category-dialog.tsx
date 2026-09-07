'use client'

import { useState } from 'react'
import { useCreateCategory } from '@/hooks/use-queries'
import { CategoryIcon } from '@/components/common/category-icon'
import { CATEGORY_COLORS, CATEGORY_ICONS_LIST, colorClass } from '@/lib/category-meta'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const DEFAULT_COLOR = 'slate'
const DEFAULT_ICON = 'folder'

export function CreateCategoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const createCategory = useCreateCategory()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [icon, setIcon] = useState(DEFAULT_ICON)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName('')
    setDescription('')
    setColor(DEFAULT_COLOR)
    setIcon(DEFAULT_ICON)
    setError(null)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name is required.')
      return
    }
    createCategory.mutate(
      {
        name: trimmed,
        description: description.trim() || undefined,
        color,
        icon,
      },
      {
        onSuccess: () => {
          reset()
          onOpenChange(false)
        },
        onError: (err) =>
          setError(err instanceof Error ? err.message : 'Failed to create section.'),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create section</DialogTitle>
          <DialogDescription>
            Group a recurring institutional source — a department, a vendor, or a project thread.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Live preview */}
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3',
              colorClass(color),
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full cat-bg-soft cat-text">
              <CategoryIcon icon={icon} color={color} className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {name.trim() || 'New section'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {description.trim() || 'Section description'}
              </p>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              placeholder="e.g. Registrar, Bursar, Lab Safety"
              maxLength={60}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">
              Description{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="cat-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What kind of emails belong here?"
              rows={2}
              maxLength={200}
            />
          </div>

          {/* Color picker */}
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((c) => {
                const selected = color === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Color ${c}`}
                    aria-pressed={selected}
                    className={cn(
                      'h-7 w-7 rounded-full cat-dot transition-transform',
                      colorClass(c),
                      selected
                        ? 'scale-110 ring-2 ring-ring ring-offset-2 ring-offset-background'
                        : 'hover:scale-110',
                    )}
                  />
                )
              })}
            </div>
          </div>

          {/* Icon picker */}
          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
              {CATEGORY_ICONS_LIST.map((ic) => {
                const selected = icon === ic
                return (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    aria-label={`Icon ${ic}`}
                    aria-pressed={selected}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
                      colorClass(color),
                      selected
                        ? 'border-primary bg-primary/10 cat-text'
                        : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    <CategoryIcon icon={ic} color={color} className="h-4 w-4" />
                  </button>
                )
              })}
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={createCategory.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createCategory.isPending || !name.trim()}>
              {createCategory.isPending ? 'Creating…' : 'Create section'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
