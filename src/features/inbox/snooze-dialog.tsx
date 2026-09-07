'use client'

import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Clock, Sunrise, Sun, CalendarDays, CalendarRange, CalendarClock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'
import { useSnoozeEmail } from '@/hooks/use-queries'

// SnoozeDialog — modal picker with quick presets + a custom datetime input.
// Used by the EmailDetail toolbar's "Snooze" button.
//
// Behavior:
//   - Quick presets compute a future Date (timezone-aware): later today 6pm
//     (clamped to future), tomorrow 9am, this Saturday 9am, next Monday 9am,
//     next month same-day 9am.
//   - Custom: a native <input type="datetime-local">. We convert its value to
//     an ISO string before sending.
//   - If the email is already snoozed, an "Unsnooze" button is shown alongside
//     the Snooze button (which acts as "reschedule").
//   - The dialog closes on a successful mutation; the toast is shown by the
//     hook (so it fires even if the user navigates away immediately).
//
// State reset: the body is mounted inside <DialogContent>, which Radix
// unmounts when the dialog closes. So each open gets a fresh body with a
// lazy-initialized `selected` (seeded from `currentSnoozedUntil` when set).
// No `useEffect` reset — that pattern triggers the React cascading-render
// lint rule and is unnecessary here.
export interface SnoozeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  emailId: string
  currentSnoozedUntil?: string | null
}

export function SnoozeDialog({
  open,
  onOpenChange,
  emailId,
  currentSnoozedUntil,
}: SnoozeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        {/* Body is conditionally rendered so its internal state resets on
            each open (Radix unmounts DialogContent when closed). */}
        {open && (
          <SnoozeDialogBody
            emailId={emailId}
            currentSnoozedUntil={currentSnoozedUntil}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function SnoozeDialogBody({
  emailId,
  currentSnoozedUntil,
  onClose,
}: {
  emailId: string
  currentSnoozedUntil?: string | null
  onClose: () => void
}) {
  const snooze = useSnoozeEmail()
  const presets = useMemo(() => buildPresets(), [])
  const isAlreadySnoozed = !!currentSnoozedUntil

  // Lazy init: pre-select the current snooze time so the "Reschedule" button
  // has a sensible default. New snooze (no current) → start with nothing
  // selected; the user picks a preset or types a custom time.
  const [selected, setSelected] = useState<Date | null>(() => {
    if (!currentSnoozedUntil) return null
    try {
      const d = new Date(currentSnoozedUntil)
      return Number.isNaN(d.getTime()) ? null : d
    } catch {
      return null
    }
  })
  const [customValue, setCustomValue] = useState<string>('')

  const handlePreset = (d: Date) => {
    setSelected(d)
    setCustomValue('')
  }

  const handleCustomChange = (value: string) => {
    setCustomValue(value)
    if (value) {
      const dt = new Date(value)
      if (!Number.isNaN(dt.getTime())) setSelected(dt)
    } else {
      setSelected(null)
    }
  }

  const handleSnooze = () => {
    if (!selected) return
    snooze.mutate(
      { id: emailId, until: selected.toISOString() },
      { onSuccess: () => onClose() },
    )
  }

  const handleUnsnooze = () => {
    snooze.mutate(
      { id: emailId, until: null },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <>
      <DialogHeader className="space-y-1 border-b p-4">
        <DialogTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Snooze email
        </DialogTitle>
        <DialogDescription>
          Hide this email until a later time. Snoozed emails resurface in your inbox automatically.
        </DialogDescription>
      </DialogHeader>

      {/* Presets */}
      <div className="space-y-1 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Quick presets
        </p>
        <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {presets.map((p) => {
            const active = selected != null && sameLocalMinute(selected, p.date)
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => handlePreset(p.date)}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors',
                  active
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-foreground hover:bg-accent',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded',
                    active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <p.icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.label}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {formatDateTime(p.date.toISOString())}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <Separator />

      {/* Custom datetime */}
      <div className="space-y-2 p-4">
        <Label
          htmlFor="snooze-custom"
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          Pick a date &amp; time
        </Label>
        <Input
          id="snooze-custom"
          type="datetime-local"
          value={customValue || (selected ? toLocalInputValue(selected) : '')}
          onChange={(e) => handleCustomChange(e.target.value)}
          className="text-sm"
        />
        {selected && (
          <p className="text-[11px] text-muted-foreground">
            Will resurface on{' '}
            <span className="font-medium text-foreground">
              {formatDateTime(selected.toISOString())}
            </span>
            .
          </p>
        )}
      </div>

      <DialogFooter className="flex-row items-center justify-between gap-2 border-t bg-muted/30 p-4">
        {isAlreadySnoozed ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleUnsnooze}
            disabled={snooze.isPending}
            className="text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Unsnooze
          </Button>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            Tip: snoozed emails resurface automatically.
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={snooze.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSnooze}
            disabled={!selected || snooze.isPending}
          >
            <Clock className="h-3.5 w-3.5" />
            {isAlreadySnoozed ? 'Reschedule' : 'Snooze'}
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}

// ---------------------------------------------------------------------------
// Preset builders — all timezone-aware (work in the user's local time).
// ---------------------------------------------------------------------------

interface Preset {
  key: string
  label: string
  icon: typeof Clock
  date: Date
}

function buildPresets(): Preset[] {
  const now = new Date()
  return [
    {
      key: 'later-today',
      label: 'Later today · 6pm',
      icon: Sun,
      date: atTimeToday(18, 0, now),
    },
    {
      key: 'tomorrow',
      label: 'Tomorrow · 9am',
      icon: Sunrise,
      date: atTimeTomorrow(9, 0, now),
    },
    {
      key: 'weekend',
      label: 'This weekend · Sat 9am',
      icon: CalendarDays,
      date: nextWeekday(6, 9, 0, now), // 6 = Saturday
    },
    {
      key: 'next-week',
      label: 'Next week · Mon 9am',
      icon: CalendarRange,
      date: nextWeekday(1, 9, 0, now, true), // 1 = Monday, force future
    },
    {
      key: 'next-month',
      label: 'Next month · 9am',
      icon: CalendarClock,
      date: nextMonth(9, 0, now),
    },
  ]
}

function atTimeToday(hour: number, minute: number, now: Date): Date {
  const d = new Date(now)
  d.setHours(hour, minute, 0, 0)
  // If 6pm today has already passed, push to tomorrow at the same time so the
  // preset never produces a "snooze until the past" no-op.
  if (d.getTime() <= now.getTime()) {
    d.setDate(d.getDate() + 1)
  }
  return d
}

function atTimeTomorrow(hour: number, minute: number, now: Date): Date {
  const d = new Date(now)
  d.setDate(d.getDate() + 1)
  d.setHours(hour, minute, 0, 0)
  return d
}

function nextWeekday(
  targetDay: number,
  hour: number,
  minute: number,
  now: Date,
  forceFuture = false,
): Date {
  const d = new Date(now)
  d.setHours(hour, minute, 0, 0)
  const currentDay = d.getDay()
  let diff = (targetDay - currentDay + 7) % 7
  if (diff === 0 && forceFuture && d.getTime() <= now.getTime()) {
    diff = 7
  }
  if (diff === 0 && d.getTime() <= now.getTime()) {
    diff = 7
  }
  d.setDate(d.getDate() + diff)
  return d
}

function nextMonth(hour: number, minute: number, now: Date): Date {
  const d = new Date(now)
  d.setMonth(d.getMonth() + 1)
  d.setHours(hour, minute, 0, 0)
  return d
}

// Convert a Date to the value format expected by <input type="datetime-local">:
// "YYYY-MM-DDTHH:mm" in the user's local time (no timezone offset).
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

// Two dates are "the same preset selection" if their local Y/M/D/H/M match —
// we don't care about seconds or ms.
function sameLocalMinute(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate() &&
    a.getHours() === b.getHours() &&
    a.getMinutes() === b.getMinutes()
  )
}
