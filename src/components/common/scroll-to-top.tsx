'use client'

// ---------------------------------------------------------------------------
// ScrollToTop — floating action button (FAB) that appears once the user has
// scrolled down (>300px) in any scrollable view, and scrolls back to the top
// on click.
//
// Implementation notes:
// - The app shell uses an outer `overflow-hidden` flex layout; the actual
//   scrolling happens inside nested view containers (e.g. `overflow-y-auto`
//   panels inside <main>). `scroll` events don't bubble, so we listen on
//   `document` with `capture: true` — that catches scroll events fired on
//   any descendant during the capture phase.
// - The handler stores the most recently scrolled element in a ref so the
//   click handler can scroll THAT element (not window) back to the top. We
//   also fall back to `window.scrollTo` for safety.
// - Respects `prefers-reduced-motion`: jumps instantly instead of smooth.
// - Hidden by default; mounts with `opacity-0 pointer-events-none` then
//   transitions in (scale-in) when `visible` flips true.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const VISIBILITY_THRESHOLD_PX = 300

export function ScrollToTop() {
  const [visible, setVisible] = useState(false)
  const scrollerRef = useRef<HTMLElement | null>(null)
  const reducedMotionRef = useRef(false)

  useEffect(() => {
    // Detect prefers-reduced-motion once on mount (and on changes).
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionRef.current = mq.matches
    const onMq = () => {
      reducedMotionRef.current = mq.matches
    }
    mq.addEventListener?.('change', onMq)

    const handler = (e: Event) => {
      const target = e.target as HTMLElement | Document
      let top = window.scrollY || 0
      if (target instanceof HTMLElement && target.scrollTop !== undefined) {
        // Remember the actual scroller for the click handler.
        scrollerRef.current = target
        if (target.scrollTop > top) top = target.scrollTop
      }
      setVisible(top > VISIBILITY_THRESHOLD_PX)
    }
    // Capture phase — catches scroll on nested scrollable descendants.
    document.addEventListener('scroll', handler, true)
    return () => {
      document.removeEventListener('scroll', handler, true)
      mq.removeEventListener?.('change', onMq)
    }
  }, [])

  const handleClick = () => {
    const behavior: ScrollBehavior = reducedMotionRef.current ? 'auto' : 'smooth'
    const target = scrollerRef.current
    if (target && target.scrollTop > 0) {
      target.scrollTo({ top: 0, behavior })
    }
    // Belt-and-suspenders: also reset window scroll in case body itself scrolled.
    if (window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior })
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Scroll to top"
      tabIndex={visible ? 0 : -1}
      className={cn(
        // Layout: above the mobile bottom nav on small screens, lower-right on desktop.
        'fixed right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full',
        'bg-primary text-primary-foreground shadow-lg transition-all duration-200',
        'hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        // Mobile: sit above the bottom nav (bottom-nav height ≈ 56px + safe area).
        'bottom-20',
        // Desktop: drop down to the regular corner.
        'md:bottom-6 md:right-6 md:h-11 md:w-11',
        visible
          ? 'scale-100 opacity-100 pointer-events-auto'
          : 'scale-90 opacity-0 pointer-events-none',
      )}
    >
      <ArrowUp className="h-5 w-5" aria-hidden />
    </button>
  )
}
