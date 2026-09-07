'use client'

// ---------------------------------------------------------------------------
// ShortcutsHelpDialog — global keyboard-shortcuts help overlay.
//
// Opened by the `shortcutsHelpOpen` flag in the UI store (toggled by the '?'
// key, handled inside useKeyboardShortcuts). Renders the SHORTCUTS registry
// grouped by category in a responsive 2-column grid (1 column on mobile).
// Each shortcut shows its key sequence as a styled <kbd> + a description.
// Close on Esc (handled by both the hook and Radix's own onOpenChange) or by
// clicking outside / the explicit close button.
// ---------------------------------------------------------------------------

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useUIStore } from '@/store/ui-store'
import { SHORTCUTS_BY_CATEGORY } from '@/lib/shortcuts'
import type { ShortcutEntry } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'

// Canonical <kbd> styling — semantic Tailwind tokens only (no hex/rgb, no
// indigo/blue utilities). Matches the spec'd appearance exactly.
function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

function ShortcutRow({ entry }: { entry: ShortcutEntry }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-foreground/90">{entry.description}</span>
      <span className="flex shrink-0 items-center gap-1">
        {entry.display.split(' then ').map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-[11px] text-muted-foreground">then</span>}
            {part.split(' + ').map((sub, j) => (
              <span key={j} className="flex items-center gap-1">
                {j > 0 && <span className="text-[11px] text-muted-foreground">+</span>}
                <Kbd>{sub.trim()}</Kbd>
              </span>
            ))}
          </span>
        ))}
      </span>
    </li>
  )
}

function CategorySection({
  category,
  entries,
}: {
  category: string
  entries: ShortcutEntry[]
}) {
  return (
    <section className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {category}
      </h3>
      <ul className="divide-y divide-border/60">
        {entries.map((entry) => (
          <ShortcutRow key={`${entry.category}-${entry.key}`} entry={entry} />
        ))}
      </ul>
    </section>
  )
}

export function ShortcutsHelpDialog() {
  const open = useUIStore((s) => s.shortcutsHelpOpen)
  const setOpen = useUIStore((s) => s.setShortcutsHelpOpen)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="space-y-1 border-b border-border px-6 py-4 text-left">
          <DialogTitle className="text-base font-semibold">Keyboard Shortcuts</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Press <Kbd className="mx-0.5">?</Kbd> anywhere to open this.
            Gmail-style <Kbd className="mx-0.5">g</Kbd>-prefix sequences are supported.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(85vh-7rem)] overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            {SHORTCUTS_BY_CATEGORY.map((group, idx) => (
              <div key={group.category} className="space-y-4">
                <CategorySection category={group.category} entries={group.entries} />
                {/* Separator between sections within a column (not after the last). */}
                {idx < SHORTCUTS_BY_CATEGORY.length - 1 && (
                  <Separator className="md:hidden" />
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
