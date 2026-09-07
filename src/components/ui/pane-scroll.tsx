/**
 * PaneScroll — the single, canonical scroll container for all full-height
 * panel sections in MailScape (email lists, detail views, assistant panes, etc.).
 *
 * WHY NOT Radix ScrollArea everywhere?
 * Radix <ScrollArea> uses a custom-scrollbar overlay approach. That overlay
 * only works reliably when the Root has a *fixed* height — either a px/vh
 * value or one derived from a flex/grid ancestor that itself has a definite
 * height. In a nested flex column chain (layout → sidebar → panel → list)
 * where every ancestor uses `flex-1`, none of them have a definite height
 * until `min-h-0` is applied at every level. Missing even one `min-h-0`
 * makes Radix's viewport grow without bound, hiding the scrollbar and
 * overflowing the page.
 *
 * PaneScroll sidesteps that by using the browser's native overflow-y-auto
 * with a lightweight custom scrollbar via Tailwind's scrollbar utilities.
 * It still applies `min-h-0` on itself so it participates correctly in any
 * flex / grid layout without additional wrapper hacks.
 *
 * USAGE (drop-in replacement wherever you previously used ScrollArea in a
 * full-height flex pane):
 *
 *   import { PaneScroll } from '@/components/ui/pane-scroll'
 *
 *   // Fills remaining flex space, scrolls vertically:
 *   <PaneScroll>…content…</PaneScroll>
 *
 *   // Custom className (e.g. to add padding to the container itself):
 *   <PaneScroll className="px-2">…content…</PaneScroll>
 *
 * NOTE: Keep using the plain Radix <ScrollArea> from '@/components/ui/scroll-area'
 * for *bounded* containers that are NOT full-height flex panes — e.g. a
 * dropdown list with max-h-72, or a dialog body where the height is set by
 * the dialog shell. PaneScroll is only for panes that should fill their flex
 * parent and scroll when content overflows.
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface PaneScrollProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional class names merged on top of the base pane-scroll classes. */
  className?: string
  children: React.ReactNode
}

/**
 * PaneScroll — a zero-dependency, full-height scrollable pane.
 *
 * Enforces:
 *   • `min-h-0`        — allows flex children to shrink below content height
 *   • `flex-1`         — fills remaining flex space in a column layout
 *   • `overflow-y-auto` — native vertical scroll when content exceeds height
 *   • `overflow-x-hidden` — prevents spurious horizontal scroll bars
 *   • Thin, styled scrollbar via CSS (cross-browser)
 */
const PaneScroll = React.forwardRef<HTMLDivElement, PaneScrollProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // flex layout participation
          'min-h-0 flex-1',
          // scrolling
          'overflow-y-auto overflow-x-hidden',
          // custom scrollbar — thin + themed
          '[scrollbar-width:thin] [scrollbar-color:hsl(var(--border))_transparent]',
          // webkit scrollbar styling
          '[&::-webkit-scrollbar]:w-1.5',
          '[&::-webkit-scrollbar-track]:bg-transparent',
          '[&::-webkit-scrollbar-thumb]:rounded-full',
          '[&::-webkit-scrollbar-thumb]:bg-border',
          '[&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/40',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  },
)
PaneScroll.displayName = 'PaneScroll'

export { PaneScroll }
