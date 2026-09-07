'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CategoryIcon } from '@/components/common/category-icon'
import { colorClass } from '@/lib/category-meta'
import { cn } from '@/lib/utils'
import type { CategorySummary, SearchFilters } from '@/lib/types'
import {
  DEFAULT_FILTER_FORM,
  type FilterFormState,
  type DatePreset,
  presetRange,
  buildSearchFilters,
} from './search-helpers'
import { Search, RotateCcw, ChevronDown, SlidersHorizontal } from 'lucide-react'

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'custom', label: 'Custom Range' },
]

const ATTACHMENT_TYPES = [
  { value: 'any', label: 'Any type' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Image' },
  { value: 'doc', label: 'Document' },
]

export function FilterPanel({
  form,
  onFormChange,
  categories,
  onSearch,
}: {
  form: FilterFormState
  onFormChange: (form: FilterFormState) => void
  categories: CategorySummary[] | undefined
  onSearch: (filters: SearchFilters) => void
}) {
  const [open, setOpen] = useState(true)

  const update = (patch: Partial<FilterFormState>) =>
    onFormChange({ ...form, ...patch })

  const toggleCategory = (id: string) => {
    const ids = form.categoryIds ?? []
    onFormChange({
      ...form,
      categoryIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    })
  }

  const applyPreset = (preset: DatePreset) => {
    if (preset === 'custom') {
      update({ datePreset: 'custom' })
      return
    }
    const range = presetRange(preset)
    update({ datePreset: preset, dateFrom: range.dateFrom, dateTo: range.dateTo })
  }

  const handleSearch = () => {
    onSearch(buildSearchFilters(form))
  }

  const handleClear = () => {
    onFormChange({ ...DEFAULT_FILTER_FORM })
  }

  const activeCount = [
    form.sender,
    form.categoryIds?.length,
    form.isRead !== undefined,
    form.isStarred,
    form.isImportant,
    form.hasAttachment,
    form.attachmentType && form.attachmentType !== 'any',
    form.dateFrom,
    form.dateTo,
    form.timeFrom,
    form.timeTo,
  ].filter(Boolean).length

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="rounded-none border-x-0 border-t-0 shadow-sm">
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left"
              aria-label={open ? 'Collapse filters' : 'Expand filters'}
            >
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Filters</CardTitle>
              {activeCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {activeCount}
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
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Sender */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Sender</Label>
              <Input
                placeholder="Name or email address"
                value={form.sender ?? ''}
                onChange={(e) => update({ sender: e.target.value })}
              />
            </div>

            {/* Sections (category multi-select chips) */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Sections</Label>
              <div className="flex flex-wrap gap-1.5">
                {categories?.map((c) => {
                  const active = form.categoryIds?.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCategory(c.id)}
                      aria-pressed={active}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : cn('border-border hover:bg-accent', colorClass(c.color), 'cat-text'),
                      )}
                    >
                      <CategoryIcon icon={c.icon} color={c.color} className="h-3 w-3" />
                      {c.name}
                    </button>
                  )
                })}
                {(!categories || categories.length === 0) && (
                  <span className="text-xs text-muted-foreground">No sections available</span>
                )}
              </div>
            </div>

            {/* Flag toggles */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <ToggleRow
                label="Unread"
                checked={form.isRead === false}
                onChange={(c) => update({ isRead: c ? false : undefined })}
              />
              <ToggleRow
                label="Starred"
                checked={!!form.isStarred}
                onChange={(c) => update({ isStarred: c || undefined })}
              />
              <ToggleRow
                label="Important"
                checked={!!form.isImportant}
                onChange={(c) => update({ isImportant: c || undefined })}
              />
              <ToggleRow
                label="Has attachment"
                checked={!!form.hasAttachment}
                onChange={(c) => update({ hasAttachment: c || undefined })}
              />
            </div>

            {/* Attachment type */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Attachment type</Label>
              <Select
                value={form.attachmentType ?? 'any'}
                onValueChange={(v) => update({ attachmentType: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTACHMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Date presets + custom range */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Date range</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => applyPreset(p.value)}
                    aria-pressed={form.datePreset === p.value}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
                      form.datePreset === p.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {form.datePreset === 'custom' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1">
                    <Label htmlFor="date-from" className="text-[10px] text-muted-foreground">
                      From
                    </Label>
                    <Input
                      id="date-from"
                      type="date"
                      value={form.dateFrom ?? ''}
                      onChange={(e) => update({ dateFrom: e.target.value || undefined })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="date-to" className="text-[10px] text-muted-foreground">
                      To
                    </Label>
                    <Input
                      id="date-to"
                      type="date"
                      value={form.dateTo ?? ''}
                      onChange={(e) => update({ dateTo: e.target.value || undefined })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Time range */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="time-from" className="text-xs text-muted-foreground">
                  Time from
                </Label>
                <Input
                  id="time-from"
                  type="time"
                  value={form.timeFrom ?? ''}
                  onChange={(e) => update({ timeFrom: e.target.value || undefined })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="time-to" className="text-xs text-muted-foreground">
                  Time to
                </Label>
                <Input
                  id="time-to"
                  type="time"
                  value={form.timeTo ?? ''}
                  onChange={(e) => update({ timeTo: e.target.value || undefined })}
                />
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button type="button" onClick={handleSearch} className="flex-1">
                <Search className="h-4 w-4" />
                Search
              </Button>
              <Button type="button" variant="outline" onClick={handleClear}>
                <RotateCcw className="h-4 w-4" />
                Clear
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  )
}
