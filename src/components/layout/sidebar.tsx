'use client'

import { NAV_SECTIONS } from '@/lib/nav'
import { useUIStore } from '@/store/ui-store'
import { useNotifications, useAccounts } from '@/hooks/use-queries'
import { cn } from '@/lib/utils'
import {
  Mail, PanelLeftClose, PanelLeft, RefreshCw,
  ChevronDown, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useState, useCallback } from 'react'
import type { AccountConnectionDTO } from '@/lib/types'

// ── Sync status dot ──────────────────────────────────────────────────────────
function SyncDot({ status }: { status: string | undefined | null }) {
  if (status === 'syncing') return <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
  if (status === 'error')   return <AlertCircle className="h-3 w-3 text-destructive" />
  if (status === 'success') return <CheckCircle2 className="h-3 w-3 text-green-400" />
  return <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
}

// ── Account footer (bottom of sidebar) ──────────────────────────────────────
function AccountFooter({
  accounts,
  activeAccountId,
  onSwitch,
  collapsed,
}: {
  accounts: AccountConnectionDTO[]
  activeAccountId: string | null
  onSwitch: (id: string) => void
  collapsed: boolean
}) {
  const [syncing, setSyncing] = useState(false)
  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? accounts[0]

  const handleSync = useCallback(async () => {
    if (!activeAccount || syncing) return
    setSyncing(true)
    try {
      await fetch(`/api/accounts/${activeAccount.id}/sync`, { method: 'POST' })
    } catch { /* non-fatal */ }
    setSyncing(false)
  }, [activeAccount, syncing])

  if (!activeAccount) return null

  const syncStatus = activeAccount.syncState?.syncStatus

  if (collapsed) {
    return (
      <div className="border-t border-sidebar-border px-2 py-2 flex flex-col items-center gap-1.5">
        <button
          onClick={handleSync}
          disabled={syncing || syncStatus === 'syncing'}
          title={`${activeAccount.emailAddress} — ${syncStatus ?? 'idle'}`}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          {syncing || syncStatus === 'syncing'
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Mail className="h-3.5 w-3.5" />
          }
        </button>
      </div>
    )
  }

  return (
    <div className="border-t border-sidebar-border px-3 py-2.5">
      <div className="flex items-center gap-2.5 rounded-lg bg-sidebar-accent/40 px-2.5 py-2">
        {/* Avatar */}
        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold select-none">
          {(activeAccount.displayName ?? activeAccount.emailAddress)?.[0]?.toUpperCase() ?? 'M'}
          {/* Status dot */}
          <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-sidebar ring-1 ring-sidebar">
            <SyncDot status={syncStatus} />
          </span>
        </div>

        {/* Name + email */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold leading-tight">
            {activeAccount.displayName ?? activeAccount.emailAddress.split('@')[0]}
          </p>
          <p className="truncate text-[10px] text-muted-foreground leading-tight">
            {activeAccount.emailAddress}
          </p>
        </div>

        {/* Actions: sync + account switcher */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 hover:bg-sidebar-border"
            onClick={handleSync}
            disabled={syncing || syncStatus === 'syncing'}
            title="Sync now"
          >
            <RefreshCw className={cn('h-3 w-3', (syncing || syncStatus === 'syncing') && 'animate-spin')} />
          </Button>

          {accounts.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-sidebar-border" title="Switch account">
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-56">
                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Switch account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {accounts.map((acc) => (
                  <DropdownMenuItem
                    key={acc.id}
                    onClick={() => onSwitch(acc.id)}
                    className={cn('text-xs gap-2', acc.id === activeAccount.id && 'bg-accent')}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                      {(acc.displayName ?? acc.emailAddress)?.[0]?.toUpperCase()}
                    </span>
                    <span className="truncate flex-1">{acc.emailAddress}</span>
                    {acc.id === activeAccount.id && <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Sidebar ─────────────────────────────────────────────────────────────
export function Sidebar() {
  const activeView      = useUIStore((s) => s.activeView)
  const navigate        = useUIStore((s) => s.navigate)
  const collapsed       = useUIStore((s) => s.sidebarCollapsed)
  const toggle          = useUIStore((s) => s.toggleSidebar)
  const activeAccountId = useUIStore((s) => s.activeAccountId)
  const setActiveAccountId = useUIStore((s) => s.setActiveAccountId)

  const { data: notifGroups } = useNotifications('all')
  const { data: accounts }    = useAccounts()

  const unreadNotifs = notifGroups?.reduce((sum, g) => sum + g.unreadCount, 0) ?? 0

  const handleAccountSwitch = useCallback((id: string) => {
    setActiveAccountId(id)
  }, [setActiveAccountId])

  return (
    <aside
      className={cn(
        'hidden md:flex md:flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
        collapsed ? 'w-[68px]' : 'w-[248px]',
      )}
    >
      {/* ── Brand header ──────────────────────────────────────────────── */}
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-3.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Mail className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight tracking-tight">MailScape</p>
            <p className="truncate text-[10px] text-muted-foreground leading-tight">Your Email Intelligence</p>
          </div>
        )}
      </div>

      {/* ── Sectioned navigation ──────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-2.5 px-2 scrollbar-none">
        {NAV_SECTIONS.map((section, sectionIdx) => (
          <div key={section.label}>
            {/* Section label (hidden when collapsed) */}
            {!collapsed && (
              <p className={cn(
                'px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60',
                sectionIdx > 0 ? 'pt-4' : 'pt-1',
              )}>
                {section.label}
              </p>
            )}
            {/* Separator for collapsed mode */}
            {collapsed && sectionIdx > 0 && (
              <div className="mx-auto my-2 h-px w-6 bg-sidebar-border" />
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = activeView === item.key
                const Icon   = item.icon
                const badge  = item.key === 'notifications' && unreadNotifs > 0 ? unreadNotifs : null

                const tourTarget =
                  item.key === 'inbox'      ? 'inbox'      :
                  item.key === 'organized'  ? 'organized'  :
                  item.key === 'assistant'  ? 'assistant'  :
                  undefined

                return (
                  <li key={item.key}>
                    <button
                      onClick={() => navigate(item.key)}
                      data-tour={tourTarget}
                      className={cn(
                        'group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all duration-100',
                        active
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                          : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        collapsed && 'justify-center px-0',
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className="h-[17px] w-[17px] shrink-0" />
                      {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
                      {/* Notification badge (expanded) */}
                      {!collapsed && badge && (
                        <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground min-w-[18px] text-center">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                      {/* Notification badge dot (collapsed) */}
                      {collapsed && badge && (
                        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── Account footer (above collapse button) ───────────────────── */}
      {accounts && accounts.length > 0 && (
        <AccountFooter
          accounts={accounts}
          activeAccountId={activeAccountId}
          onSwitch={handleAccountSwitch}
          collapsed={collapsed}
        />
      )}

      {/* ── Collapse toggle (compact height) ─────────────────────────── */}
      <div className="border-t border-sidebar-border px-2 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full justify-start gap-2 text-xs text-muted-foreground hover:bg-sidebar-accent"
          onClick={toggle}
        >
          {collapsed
            ? <PanelLeft className="h-3.5 w-3.5 shrink-0" />
            : <PanelLeftClose className="h-3.5 w-3.5 shrink-0" />
          }
          {!collapsed && <span>Collapse</span>}
        </Button>
      </div>
    </aside>
  )
}

export function SidebarSkeleton() {
  return (
    <aside className="hidden md:block w-[248px] border-r border-sidebar-border bg-sidebar">
      <div className="h-14 border-b border-sidebar-border px-3.5 flex items-center gap-2.5">
        <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-32" />
        </div>
      </div>
      <div className="space-y-1 p-2 py-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-lg" />
        ))}
      </div>
    </aside>
  )
}
