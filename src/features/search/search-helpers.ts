// Shared helpers for the Search feature: filter form state, date presets,
// filter → SearchFilters builder, and a chips summary used by both the
// structured panel and the natural-language panel.

import type { SearchFilters, CategorySummary } from '@/lib/types'

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'custom'

/**
 * The editable structured-filter form. Extends SearchFilters with a
 * `datePreset` UI field that drives the date-preset button row.
 */
export interface FilterFormState extends SearchFilters {
  datePreset: DatePreset | null
}

export const DEFAULT_FILTER_FORM: FilterFormState = {
  sender: '',
  categoryIds: [],
  isRead: undefined,
  isStarred: undefined,
  isImportant: undefined,
  hasAttachment: undefined,
  attachmentType: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  timeFrom: undefined,
  timeTo: undefined,
  datePreset: null,
}

function fmtDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Returns {dateFrom, dateTo} for a named preset, or null for 'custom'. */
export function presetRange(
  preset: Exclude<DatePreset, 'custom'>,
): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (preset) {
    case 'today':
      return { dateFrom: fmtDate(today), dateTo: fmtDate(today) }
    case 'yesterday': {
      const y = new Date(today)
      y.setDate(y.getDate() - 1)
      return { dateFrom: fmtDate(y), dateTo: fmtDate(y) }
    }
    case 'last7': {
      const s = new Date(today)
      s.setDate(s.getDate() - 6)
      return { dateFrom: fmtDate(s), dateTo: fmtDate(today) }
    }
    case 'last30': {
      const s = new Date(today)
      s.setDate(s.getDate() - 29)
      return { dateFrom: fmtDate(s), dateTo: fmtDate(today) }
    }
    case 'thisMonth': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1)
      return { dateFrom: fmtDate(s), dateTo: fmtDate(today) }
    }
  }
}

/** Strips empty values + the UI-only `datePreset` field, producing a clean API payload. */
export function buildSearchFilters(form: FilterFormState): SearchFilters {
  const f: SearchFilters = {}
  if (form.sender && form.sender.trim()) f.sender = form.sender.trim()
  if (form.categoryIds && form.categoryIds.length > 0) f.categoryIds = form.categoryIds
  if (form.isRead !== undefined) f.isRead = form.isRead
  if (form.isStarred) f.isStarred = true
  if (form.isImportant) f.isImportant = true
  if (form.hasAttachment) f.hasAttachment = true
  if (form.attachmentType && form.attachmentType !== 'any') f.attachmentType = form.attachmentType
  if (form.dateFrom) f.dateFrom = form.dateFrom
  if (form.dateTo) f.dateTo = form.dateTo
  if (form.timeFrom) f.timeFrom = form.timeFrom
  if (form.timeTo) f.timeTo = form.timeTo
  return f
}

export interface FilterChip {
  label: string
  color?: string
}

/** Converts a SearchFilters object into a list of human-readable chips for the results summary. */
export function filtersToChips(
  filters: SearchFilters,
  categories: CategorySummary[] | undefined,
): FilterChip[] {
  const chips: FilterChip[] = []
  if (filters.sender) chips.push({ label: `From: ${filters.sender}` })
  if (filters.categoryIds?.length) {
    for (const id of filters.categoryIds) {
      const cat = categories?.find((c) => c.id === id)
      if (cat) chips.push({ label: cat.name, color: cat.color })
      else chips.push({ label: id })
    }
  }
  if (filters.isRead === false) chips.push({ label: 'Unread' })
  if (filters.isStarred) chips.push({ label: 'Starred' })
  if (filters.isImportant) chips.push({ label: 'Important' })
  if (filters.hasAttachment) {
    chips.push({
      label: filters.attachmentType ? `Attachment: ${filters.attachmentType}` : 'Has attachment',
    })
  }
  if (filters.dateFrom) chips.push({ label: `From ${filters.dateFrom}` })
  if (filters.dateTo) chips.push({ label: `Until ${filters.dateTo}` })
  if (filters.timeFrom) chips.push({ label: `After ${filters.timeFrom}` })
  if (filters.timeTo) chips.push({ label: `Before ${filters.timeTo}` })
  return chips
}

/**
 * Compact single-string filter summary used by the saved-search rows.
 * Resolves categoryIds to names when a categories list is supplied; falls
 * back to a count placeholder ("2 sections") when categories aren't loaded
 * yet. Returns an empty string when no filters are active so callers can
 * gate the summary's visibility without a separate hasActiveFilters check.
 *
 * Example: "placement · unread · pdf · last 7 days"
 */
export function summarizeFilters(
  filters: SearchFilters,
  categories?: CategorySummary[] | undefined,
): string {
  const parts: string[] = []
  if (filters.sender) parts.push(`sender:${filters.sender}`)
  if (filters.categoryIds?.length) {
    if (categories && categories.length > 0) {
      const names = filters.categoryIds
        .map((id) => categories.find((c) => c.id === id)?.name)
        .filter((n): n is string => !!n)
      parts.push(names.length > 0 ? names.join('+') : `${filters.categoryIds.length} sections`)
    } else {
      parts.push(`${filters.categoryIds.length} ${filters.categoryIds.length === 1 ? 'section' : 'sections'}`)
    }
  }
  if (filters.isRead === false) parts.push('unread')
  if (filters.isRead === true) parts.push('read')
  if (filters.isStarred) parts.push('starred')
  if (filters.isImportant) parts.push('important')
  if (filters.hasAttachment) {
    if (filters.attachmentType && filters.attachmentType !== 'any') {
      parts.push(filters.attachmentType)
    } else {
      parts.push('has-attachment')
    }
  }
  if (filters.dateFrom && filters.dateTo) {
    parts.push(`${filters.dateFrom}→${filters.dateTo}`)
  } else if (filters.dateFrom) {
    parts.push(`from ${filters.dateFrom}`)
  } else if (filters.dateTo) {
    parts.push(`until ${filters.dateTo}`)
  }
  if (filters.timeFrom && filters.timeTo) {
    parts.push(`${filters.timeFrom}–${filters.timeTo}`)
  } else if (filters.timeFrom) {
    parts.push(`after ${filters.timeFrom}`)
  } else if (filters.timeTo) {
    parts.push(`before ${filters.timeTo}`)
  }
  return parts.join(' · ')
}

/** True when a SearchFilters object has at least one active constraint. */
export function hasActiveFilters(filters: SearchFilters | null | undefined): boolean {
  if (!filters) return false
  return (
    !!filters.sender ||
    !!filters.query ||
    (filters.categoryIds?.length ?? 0) > 0 ||
    filters.isRead !== undefined ||
    !!filters.isStarred ||
    !!filters.isImportant ||
    !!filters.hasAttachment ||
    (!!filters.attachmentType && filters.attachmentType !== 'any') ||
    !!filters.dateFrom ||
    !!filters.dateTo ||
    !!filters.timeFrom ||
    !!filters.timeTo
  )
}

/**
 * Hydrate a FilterFormState from a persisted SearchFilters payload. The
 * UI-only `datePreset` field is derived: 'custom' when explicit date bounds
 * exist (since we can't tell which preset produced them), 'null' otherwise.
 * Used when loading a saved search back into the structured filter form.
 */
export function filtersToFormState(filters: SearchFilters): FilterFormState {
  const hasDates = !!filters.dateFrom || !!filters.dateTo
  return {
    ...filters,
    attachmentType: filters.attachmentType ?? undefined,
    datePreset: hasDates ? 'custom' : null,
  }
}
