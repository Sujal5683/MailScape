'use client'

import { useUIStore } from '@/store/ui-store'
import { navItem } from '@/lib/nav'
import { useNotifications, useSyncStatus, useRunSync } from '@/hooks/use-queries'
import { Button } from '@/components/ui/button'
import { Search, Bell, Sun, Moon, Sparkles, Download, Loader2, RefreshCw } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useScanDialogStore } from '@/features/scan/scan-dialog-store'

export function TopBar() {
  const activeView = useUIStore((s) => s.activeView)
  const navigate = useUIStore((s) => s.navigate)
  const item = navItem(activeView)
  const { data: notifGroups } = useNotifications('all')
  const unread = notifGroups?.reduce((sum, g) => sum + g.unreadCount, 0) ?? 0
  const { theme, setTheme } = useTheme()
  const openScan = useScanDialogStore((s) => s.openDialog)
  const { data: sync } = useSyncStatus()
  const runSyncMut = useRunSync()
  const scanning = sync?.status === 'syncing' || runSyncMut.isPending

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="truncate text-sm font-semibold md:text-base">{item.label}</h1>
        <span className="hidden truncate text-xs text-muted-foreground sm:inline">— {item.description}</span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="hidden sm:inline-flex"
          onClick={() => navigate('search')}
          data-tour="command-palette"
        >
          <Search className="h-4 w-4" />
          <span className="ml-1.5 text-xs">Search</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => {
            if (!scanning) runSyncMut.mutate()
          }}
          disabled={scanning}
          aria-label="Refresh Data"
        >
          <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{scanning ? 'Syncing…' : 'Refresh'}</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          onClick={() => navigate('notifications')}
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
        >
          <Sun className="hidden h-[18px] w-[18px] dark:block" />
          <Moon className="h-[18px] w-[18px] dark:hidden" />
        </Button>

        <Button
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => navigate('assistant')}
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Ask AI</span>
        </Button>
      </div>
    </header>
  )
}
