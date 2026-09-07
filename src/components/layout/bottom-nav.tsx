'use client'

import { Inbox, LayoutGrid, LayoutDashboard, Sparkles, Bell } from 'lucide-react'
import { useUIStore, type ViewKey } from '@/store/ui-store'
import { cn } from '@/lib/utils'

const ITEMS: { key: ViewKey; label: string; icon: typeof Inbox }[] = [
  { key: 'inbox', label: 'Home', icon: Inbox },
  { key: 'organized', label: 'Organized', icon: LayoutGrid },
  { key: 'assistant', label: 'AI', icon: Sparkles },
  { key: 'notifications', label: 'Alerts', icon: Bell },
  { key: 'dashboard', label: 'Stats', icon: LayoutDashboard },
]

export function BottomNav() {
  const activeView = useUIStore((s) => s.activeView)
  const setView = useUIStore((s) => s.setView)
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ key, label, icon: Icon }) => {
          const active = activeView === key
          // Tag the same targets as the sidebar so the OnboardingTour can find
          // a VISIBLE target on mobile (where the sidebar is display:none).
          const tourTarget =
            key === 'inbox'
              ? 'inbox'
              : key === 'organized'
                ? 'organized'
                : key === 'assistant'
                  ? 'assistant'
                  : undefined
          return (
            <li key={key}>
              <button
                onClick={() => setView(key)}
                data-tour={tourTarget}
                className={cn(
                  'flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={cn('h-5 w-5', active && 'scale-110')} />
                <span>{label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
