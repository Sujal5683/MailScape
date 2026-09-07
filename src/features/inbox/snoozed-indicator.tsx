'use client'

import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelative } from '@/lib/format'

// SnoozedIndicator — compact badge shown on email rows whose `snoozedUntil`
// is set AND in the future. Uses `bg-accent text-accent-foreground` (semantic
// tokens only — no hardcoded hex/rgb, no indigo/blue utilities) so it adapts
// to every theme family automatically.
//
// The label reads "Snoozed · {relative date}" — short enough to fit on mobile
// rows while still being informative.
export function SnoozedIndicator({
  snoozedUntil,
  className,
  showLabel = true,
}: {
  snoozedUntil: string
  className?: string
  showLabel?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground',
        className,
      )}
      title={`Snoozed until ${new Date(snoozedUntil).toLocaleString()}`}
    >
      <Clock className="h-3 w-3" />
      {showLabel && (
        <span className="whitespace-nowrap">
          Snoozed · {formatRelative(snoozedUntil)}
        </span>
      )}
    </span>
  )
}

// Helper used by callers (email-list, email-detail) to decide whether to
// render the indicator. A snoozedUntil in the past means the snooze expired
// and the email has resurfaced — in that case we don't show the badge.
export function isActivelySnoozed(snoozedUntil: string | null | undefined): boolean {
  if (!snoozedUntil) return false
  return new Date(snoozedUntil).getTime() > Date.now()
}
