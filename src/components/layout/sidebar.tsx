'use client'

import { NAV_ITEMS } from '@/lib/nav'
import { useUIStore } from '@/store/ui-store'
import { useNotifications } from '@/hooks/use-queries'
import { useAccounts } from '@/hooks/use-queries'
import { cn } from '@/lib/utils'
import { Mail, PanelLeftClose, PanelLeft, RefreshCw, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useState } from 'react'

export function Sidebar() {
  const activeView = useUIStore((s) => s.activeView)
  const navigate = useUIStore((s) => s.navigate)
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggle = useUIStore((s) => s.toggleSidebar)
  const { data: notifGroups } = useNotifications('all')
  const { data: accounts } = useAccounts()
  const unreadNotifs = notifGroups?.reduce((sum, g) => sum + g.unreadCount, 0) ?? 0
  const account = accounts?.[0]
  const [syncing, setSyncing] = useState(false)

  const handleSync = async () => {
    if (!account) return
    setSyncing(true)
    try {
      await fetch(`/api/accounts/${account.id}/sync`, { method: 'POST' })
    } catch {
      /* ignore */
    }
    setSyncing(false)
  }

  return (
    <aside
      className={cn(
        'hidden md:flex md:flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
        collapsed ? 'w-[68px]' : 'w-[248px]',
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Mail className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">Mail Intelligence</p>
            <p className="truncate text-[11px] text-muted-foreground">Institutional Command Center</p>
          </div>
        )}
      </div>

      {/* Account + sync */}
      {!collapsed && account && (
        <div className="border-b border-sidebar-border px-3 py-3">
          <div className="rounded-lg bg-sidebar-accent/50 p-2.5">
            <p className="truncate text-xs font-medium">{account.displayName ?? account.emailAddress}</p>
            <p className="truncate text-[11px] text-muted-foreground">{account.emailAddress}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                account.status === 'active' ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
              )}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {account.syncState?.syncStatus ?? 'idle'}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshCw className={cn('h-3 w-3', syncing && 'animate-spin')} />
                Sync
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = activeView === item.key
            const Icon = item.icon
            const badge = item.key === 'notifications' && unreadNotifs > 0 ? unreadNotifs : null
            // data-tour attributes consumed by the OnboardingTour spotlight.
            // Only the steps the tour targets need a value; others are left unset.
            const tourTarget =
              item.key === 'inbox'
                ? 'inbox'
                : item.key === 'organized'
                  ? 'organized'
                  : item.key === 'assistant'
                    ? 'assistant'
                    : undefined
            return (
              <li key={item.key}>
                <button
                  onClick={() => navigate(item.key)}
                  data-tour={tourTarget}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    collapsed && 'justify-center px-0',
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
                  {!collapsed && badge && (
                    <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                      {badge}
                    </span>
                  )}
                  {collapsed && badge && (
                    <span className="absolute -mt-6 ml-4 h-2 w-2 rounded-full bg-destructive" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={toggle}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span className="ml-2">Collapse</span>}
        </Button>
      </div>
    </aside>
  )
}

export function SidebarSkeleton() {
  return (
    <aside className="hidden md:block w-[248px] border-r border-sidebar-border bg-sidebar">
      <div className="h-16 border-b border-sidebar-border p-4">
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <div className="space-y-2 p-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </aside>
  )
}
