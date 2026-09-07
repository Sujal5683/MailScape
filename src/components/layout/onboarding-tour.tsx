'use client'

// ---------------------------------------------------------------------------
// OnboardingTour — first-run guided tour.
//
// A 6-step walkthrough that:
//   1. Welcome  — centered Dialog modal (intro).
//   2. Inbox    — spotlight on [data-tour="inbox"].
//   3. Organized — spotlight on [data-tour="organized"].
//   4. AI Assistant — spotlight on [data-tour="assistant"].
//   5. Command Palette — spotlight on [data-tour="command-palette"].
//   6. Keyboard shortcuts — centered Dialog modal.
//
// State:
//   - `tourOpen` (ephemeral, NOT persisted) controls visibility.
//   - `onboardingComplete` (persisted) suppresses auto-open on revisit.
//
// Spotlight implementation:
//   A transparent <div> positioned over the target element with
//   `box-shadow: 0 0 0 9999px rgba(0,0,0,0.5)` — the huge spread draws the
//   dimming overlay AROUND the element while the element itself stays clear.
//   A 2px border-primary outline marks the highlighted region. The overlay
//   div has `pointer-events: none` so the user can still click the
//   underlying UI; only the tooltip Card captures clicks.
//
// Targeting:
//   Each spotlight step looks up `[data-tour="…"]` via querySelectorAll. The
//   FIRST element with a non-zero bounding rect is used (so the sidebar
//   target wins on desktop, the bottom-nav target wins on mobile). If no
//   visible target is found, the step falls back to a centered modal.
//
// Accessibility:
//   - Escape closes the tour (and marks it complete).
//   - ArrowRight / ArrowLeft navigate steps.
//   - prefers-reduced-motion disables spotlight/tooltip transitions.
//   - The tooltip Card uses semantic Tailwind tokens only (bg-popover,
//     text-popover-foreground, border-border).
// ---------------------------------------------------------------------------

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Command,
  Inbox,
  Keyboard,
  LayoutGrid,
  Sparkles,
} from 'lucide-react'
import { useUIStore } from '@/store/ui-store'
import { cn } from '@/lib/utils'

interface TourStep {
  id: string
  title: string
  description: string
  /** data-tour attribute value to spotlight. Omit for modal-only steps. */
  target?: string
  /** If true, render as a centered Dialog instead of a spotlight. */
  asModal?: boolean
}

const STEPS: TourStep[] = [
  {
    id: 'welcome',
    asModal: true,
    title: 'Welcome to Mail Intelligence',
    description:
      'Your institutional email command center. This quick tour walks you through the essentials in under a minute.',
  },
  {
    id: 'inbox',
    target: 'inbox',
    title: 'Inbox',
    description:
      'All your synced emails live here — organized, sortable, and searchable. The Inbox is your daily home base.',
  },
  {
    id: 'organized',
    target: 'organized',
    title: 'Institutional sections',
    description:
      'Sections like Placement, Academic, Professors, and Administration are auto-categorized — drill into one without sorting through everything else.',
  },
  {
    id: 'assistant',
    target: 'assistant',
    title: 'AI Assistant',
    description:
      'Ask questions, summarize long threads, extract deadlines, and execute safe actions (star, archive, label) — each action requires your confirmation before it runs.',
  },
  {
    id: 'command-palette',
    target: 'command-palette',
    title: 'Command Palette',
    description:
      'Press Cmd+K (or Ctrl+K) anywhere to search emails, senders, and sections, or run an action instantly — without leaving your keyboard.',
  },
  {
    id: 'shortcuts',
    asModal: true,
    title: 'Keyboard shortcuts',
    description:
      'Press ? anywhere to see all keyboard shortcuts. Use Gmail-style g-prefix navigation (g then i for Inbox, g then o for Organized) to move fast.',
  },
]

// Static icon resolver — switch on step id. Avoids any "const Icon = lookup"
// pattern by returning a statically-imported component for each known step.
function StepIcon({ stepId, className }: { stepId: string; className?: string }) {
  switch (stepId) {
    case 'welcome':
    case 'assistant':
      return <Sparkles className={className} aria-hidden />
    case 'inbox':
      return <Inbox className={className} aria-hidden />
    case 'organized':
      return <LayoutGrid className={className} aria-hidden />
    case 'command-palette':
      return <Command className={className} aria-hidden />
    case 'shortcuts':
      return <Keyboard className={className} aria-hidden />
    default:
      return <Inbox className={className} aria-hidden />
  }
}

// ---------------------------------------------------------------------------
// usePrefersReducedMotion — useSyncExternalStore subscription to the
// prefers-reduced-motion media query. Returns false on the server (SSR
// snapshot) and the live matchMedia value on the client.
// ---------------------------------------------------------------------------

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function subscribePrefersReducedMotion(cb: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

function getPrefersReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

function getPrefersReducedMotionServerSnapshot() {
  return false
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribePrefersReducedMotion,
    getPrefersReducedMotionSnapshot,
    getPrefersReducedMotionServerSnapshot,
  )
}

// ---------------------------------------------------------------------------
// useTargetRect — subscribes to scroll/resize and re-reads the first visible
// element matching [data-tour="target"]'s bounding rect. Returns null when
// no visible target is found (the consumer falls back to a centered modal).
//
// The setState calls happen inside the `update` listener (an external-system
// callback), not in the effect body — that keeps the react-hooks lint rule
// `set-state-in-effect` happy.
// ---------------------------------------------------------------------------

function useTargetRect(target: string | undefined): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!target) return
    const findVisible = (): HTMLElement | null => {
      const all = document.querySelectorAll<HTMLElement>(
        `[data-tour="${target}"]`,
      )
      for (const el of all) {
        const r = el.getBoundingClientRect()
        // Visible = non-zero size (display:none elements return zeros).
        if (r.width > 0 && r.height > 0) return el
      }
      return null
    }
    const update = () => {
      const el = findVisible()
      setRect(el ? el.getBoundingClientRect() : null)
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [target])

  return rect
}

// ---------------------------------------------------------------------------
// OnboardingTour — outer wrapper. Always mounted in the app shell.
// Owns the auto-open-on-first-visit effect; conditionally renders the active
// tour (which remounts each time the tour opens, resetting step to 0).
// ---------------------------------------------------------------------------

export function OnboardingTour() {
  const tourOpen = useUIStore((s) => s.tourOpen)

  // Auto-open on first visit. The effect body only calls store actions
  // (setTourOpen), not local setState — so the react-hooks set-state-in-effect
  // rule doesn't fire. Zustand persist with localStorage hydrates
  // synchronously during store creation, so by the time this effect runs on
  // the client, onboardingComplete already reflects the persisted value.
  useEffect(() => {
    const s = useUIStore.getState()
    if (!s.onboardingComplete && !s.tourOpen) {
      s.setTourOpen(true)
    }
  }, [])

  // The inner component is mounted only while the tour is open. Each open
  // re-mounts it (because we render null in between), so its useState
  // initializer runs fresh — step resets to 0 automatically. No
  // set-state-in-effect needed.
  if (!tourOpen) return null
  return <OnboardingTourActive />
}

function OnboardingTourActive() {
  const setTourOpen = useUIStore((s) => s.setTourOpen)
  const setOnboardingComplete = useUIStore((s) => s.setOnboardingComplete)

  const [step, setStep] = useState(0)
  const [tooltipSize, setTooltipSize] = useState({ w: 0, h: 0 })
  const tooltipRef = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  const current = STEPS[step]
  const targetRect = useTargetRect(current.asModal ? undefined : current.target)

  // Measure the tooltip card after it renders so we can position it.
  // The bailout inside the setter avoids an infinite render loop (a fresh
  // object literal would otherwise trip React's Object.is check every time).
  useEffect(() => {
    if (!tooltipRef.current) return
    const w = tooltipRef.current.offsetWidth
    const h = tooltipRef.current.offsetHeight
    setTooltipSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
  }, [step, targetRect])

  const next = useCallback(() => {
    setStep((s) => {
      if (s >= STEPS.length - 1) {
        setTourOpen(false)
        setOnboardingComplete(true)
        return s
      }
      return s + 1
    })
  }, [setTourOpen, setOnboardingComplete])

  const prev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1))
  }, [])

  const skip = useCallback(() => {
    setTourOpen(false)
    setOnboardingComplete(true)
  }, [setTourOpen, setOnboardingComplete])

  // Keyboard: Escape skips, ArrowRight/Left navigate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        skip()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, skip])

  const total = STEPS.length
  // A step is rendered as a modal if it's marked asModal OR its target can't
  // be found in the DOM (e.g. the sidebar is display:none on mobile).
  const isModal = current.asModal || !targetRect

  if (isModal) {
    return (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) skip()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <StepIcon stepId={current.id} className="h-5 w-5" />
              </span>
              <Badge variant="secondary" className="ml-auto">
                {step + 1} / {total}
              </Badge>
            </div>
            <DialogTitle>{current.title}</DialogTitle>
            <DialogDescription>{current.description}</DialogDescription>
          </DialogHeader>

          <TourFooter
            step={step}
            total={total}
            reducedMotion={reducedMotion}
            onPrev={prev}
            onNext={next}
            onSkip={skip}
          />
        </DialogContent>
      </Dialog>
    )
  }

  // --- Spotlight step ---
  const rect = targetRect as DOMRect
  const transition = reducedMotion ? undefined : 'all 200ms ease'

  const spotlightStyle: React.CSSProperties = {
    position: 'fixed',
    top: rect.top - SPOTLIGHT_PADDING_PX,
    left: rect.left - SPOTLIGHT_PADDING_PX,
    width: rect.width + SPOTLIGHT_PADDING_PX * 2,
    height: rect.height + SPOTLIGHT_PADDING_PX * 2,
    borderRadius: '0.5rem',
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
    transition,
    pointerEvents: 'none',
  }

  // Tooltip placement: prefer below, then above, then centered.
  const tooltipH = tooltipSize.h || TOOLTIP_FALLBACK_HEIGHT_PX
  const targetCenterX = rect.left + rect.width / 2
  let tooltipLeft = targetCenterX - TOOLTIP_WIDTH_PX / 2
  tooltipLeft = Math.max(
    VIEWPORT_MARGIN_PX,
    Math.min(window.innerWidth - TOOLTIP_WIDTH_PX - VIEWPORT_MARGIN_PX, tooltipLeft),
  )

  const spaceBelow = window.innerHeight - rect.bottom
  let tooltipTop: number
  let arrowBelow = false
  if (spaceBelow >= tooltipH + TOOLTIP_GAP_PX + VIEWPORT_MARGIN_PX) {
    tooltipTop = rect.bottom + TOOLTIP_GAP_PX
    arrowBelow = true
  } else if (rect.top >= tooltipH + TOOLTIP_GAP_PX + VIEWPORT_MARGIN_PX) {
    tooltipTop = rect.top - TOOLTIP_GAP_PX - tooltipH
    arrowBelow = false
  } else {
    tooltipTop = Math.max(
      VIEWPORT_MARGIN_PX,
      (window.innerHeight - tooltipH) / 2,
    )
    arrowBelow = false
  }

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={`Tour step ${step + 1}: ${current.title}`}
      // pointer-events: none lets the user click through to the underlying UI;
      // the tooltip Card re-enables pointer-events on itself.
      style={{ pointerEvents: 'none' }}
    >
      {/* Spotlight highlight (visual only) */}
      <div
        className="fixed rounded-lg border-2 border-primary"
        style={spotlightStyle}
        aria-hidden
      />

      {/* Tooltip card */}
      <Card
        ref={tooltipRef}
        className={cn(
          'fixed z-50 w-[20rem] max-w-[calc(100vw-2rem)] gap-0 rounded-xl border-border bg-popover p-0 text-popover-foreground shadow-lg',
        )}
        style={{
          top: tooltipTop,
          left: tooltipLeft,
          transition,
          pointerEvents: 'auto',
        }}
      >
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <StepIcon stepId={current.id} className="h-4 w-4" />
            </span>
            <Badge variant="secondary" className="ml-auto">
              {step + 1} / {total}
            </Badge>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{current.title}</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {current.description}
            </p>
          </div>
          <TourFooter
            step={step}
            total={total}
            reducedMotion={reducedMotion}
            onPrev={prev}
            onNext={next}
            onSkip={skip}
            compact
          />
        </CardContent>
      </Card>

      {/* Tiny arrow indicator pointing at the spotlight (visual only) */}
      {arrowBelow && (
        <div
          aria-hidden
          className="fixed z-50 h-2 w-2 rotate-45 border-l border-t border-border bg-popover"
          style={{
            top: tooltipTop - 4,
            left: Math.max(
              VIEWPORT_MARGIN_PX + 8,
              Math.min(
                window.innerWidth - VIEWPORT_MARGIN_PX - 12,
                targetCenterX - 4,
              ),
            ),
            transition,
          }}
        />
      )}
    </div>
  )
}

// Spotlight padding (visual breathing room around the highlighted element).
const SPOTLIGHT_PADDING_PX = 6
// Tooltip geometry constants.
const TOOLTIP_WIDTH_PX = 320
const TOOLTIP_GAP_PX = 12
const VIEWPORT_MARGIN_PX = 16
const TOOLTIP_FALLBACK_HEIGHT_PX = 200

// ---------------------------------------------------------------------------
// Footer: prev / next / skip + dot indicators. Shared by modal and spotlight.
// ---------------------------------------------------------------------------

function TourFooter({
  step,
  total,
  reducedMotion,
  onPrev,
  onNext,
  onSkip,
  compact,
}: {
  step: number
  total: number
  reducedMotion: boolean
  onPrev: () => void
  onNext: () => void
  onSkip: () => void
  compact?: boolean
}) {
  const isLast = step === total - 1
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          Skip tour
        </button>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <Button
              variant="ghost"
              size={compact ? 'sm' : 'default'}
              onClick={onPrev}
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Back
            </Button>
          )}
          <Button size={compact ? 'sm' : 'default'} onClick={onNext}>
            {isLast ? (
              <>
                <Check className="mr-1 h-3.5 w-3.5" />
                Get started
              </>
            ) : (
              <>
                Next
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-1.5 pt-1">
        {STEPS.map((s, i) => (
          <span
            key={s.id}
            className={cn(
              'h-1.5 rounded-full',
              i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30',
            )}
            style={reducedMotion ? undefined : { transition: 'all 200ms ease' }}
            aria-label={i === step ? `Step ${i + 1} of ${total}` : undefined}
          />
        ))}
      </div>
    </div>
  )
}

// Re-exported so consumers (e.g. Settings → Appearance) can re-trigger the
// tour without reaching into the store directly.
export function useRestartTour() {
  const setTourOpen = useUIStore((s) => s.setTourOpen)
  const setOnboardingComplete = useUIStore((s) => s.setOnboardingComplete)
  return useCallback(() => {
    setOnboardingComplete(false)
    setTourOpen(true)
  }, [setOnboardingComplete, setTourOpen])
}
