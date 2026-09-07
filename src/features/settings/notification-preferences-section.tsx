'use client'

import * as React from 'react'
import { BellRing, Bell, Globe, Smartphone, Send, Info, Loader2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CategoryIcon } from '@/components/common/category-icon'
import { colorClass } from '@/lib/category-meta'
import { cn } from '@/lib/utils'
import {
  useCategories,
  useNotificationPreferences,
  useUpdateNotificationPreference,
  useTestNotification,
  type NotificationPrefChannel,
} from '@/hooks/use-queries'
import { useToast } from '@/hooks/use-toast'
import { InfoNotice, SettingsSection } from './section-wrapper'

type ImportanceThreshold = 'normal' | 'important' | 'urgent'

interface ChannelDef {
  key: NotificationPrefChannel
  label: string
  description: string
  icon: typeof BellRing
}

const CHANNELS: ChannelDef[] = [
  {
    key: 'in_app',
    label: 'In-app',
    description: 'Bell badge and toasts while the app is open.',
    icon: BellRing,
  },
  {
    key: 'web',
    label: 'Web',
    description: 'Browser-level alerts even when the tab is in the background.',
    icon: Globe,
  },
  {
    key: 'push',
    label: 'Push',
    description: 'Native OS notifications on mobile and desktop installs.',
    icon: Smartphone,
  },
]

const IMPORTANCE_OPTIONS: { value: ImportanceThreshold; label: string; hint: string }[] = [
  { value: 'normal', label: 'All', hint: 'Notify for every matched email.' },
  { value: 'important', label: 'Important+', hint: 'Only notify for important or urgent emails.' },
  { value: 'urgent', label: 'Urgent only', hint: 'Only notify for urgent emails.' },
]

const THRESHOLD_KEY = 'iei-notif-threshold'

function loadThreshold(): ImportanceThreshold {
  if (typeof window === 'undefined') return 'normal'
  try {
    const v = window.localStorage.getItem(THRESHOLD_KEY)
    if (v === 'normal' || v === 'important' || v === 'urgent') return v
  } catch {
    /* ignore */
  }
  return 'normal'
}

function saveThreshold(v: ImportanceThreshold) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(THRESHOLD_KEY, v)
  } catch {
    /* ignore */
  }
}

// Reduce the channels array into a per-channel lookup of categoryId → enabled.
function indexPrefs(
  data: { channels: { channel: NotificationPrefChannel; preferences: { categoryId: string | '__global__'; enabled: boolean }[] }[] } | undefined,
): Map<NotificationPrefChannel, Map<string, boolean>> {
  const m = new Map<NotificationPrefChannel, Map<string, boolean>>()
  if (!data) return m
  for (const c of data.channels) {
    const inner = new Map<string, boolean>()
    for (const p of c.preferences) inner.set(p.categoryId, p.enabled)
    m.set(c.channel, inner)
  }
  return m
}

export function NotificationPreferencesSection() {
  const { data: categories } = useCategories()
  const { data: prefsData, isLoading } = useNotificationPreferences()
  const updateMutation = useUpdateNotificationPreference()
  const testMutation = useTestNotification()
  const { toast } = useToast()

  const [threshold, setThreshold] = React.useState<ImportanceThreshold>(() => loadThreshold())
  const [activeChannel, setActiveChannel] = React.useState<NotificationPrefChannel>('in_app')
  const [permState, setPermState] = React.useState<NotificationPermission | 'unsupported'>('default')

  // Hydrate browser permission state on mount (client-only).
  React.useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermState('unsupported')
      return
    }
    setPermState(Notification.permission)
  }, [])

  const prefsByChannel = React.useMemo(() => indexPrefs(prefsData), [prefsData])
  const catList = categories ?? []

  const handleToggle = React.useCallback(
    (channel: NotificationPrefChannel, categoryId: string | null, enabled: boolean) => {
      updateMutation.mutate({ channel, categoryId, enabled })
    },
    [updateMutation],
  )

  const handleThresholdChange = React.useCallback(
    (v: ImportanceThreshold) => {
      setThreshold(v)
      saveThreshold(v)
      toast({ title: 'Importance threshold saved' })
    },
    [toast],
  )

  const handleRequestPermission = React.useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast({ title: 'Notifications API not supported in this browser', variant: 'destructive' })
      return
    }
    try {
      const result = await Notification.requestPermission()
      setPermState(result)
      toast({
        title:
          result === 'granted'
            ? 'Browser notifications enabled'
            : result === 'denied'
              ? 'Browser notifications blocked'
              : 'Permission dismissed',
        variant: result === 'granted' ? 'default' : 'destructive',
      })
    } catch {
      toast({ title: 'Could not request permission', variant: 'destructive' })
    }
  }, [toast])

  const handleTest = React.useCallback(() => {
    testMutation.mutate(undefined)
    // Also fire a real browser notification if the user granted permission,
    // so the end-to-end path is visible immediately (web channel demo).
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification('Test notification', { body: 'This is a test' })
      } catch {
        /* Some browsers require a service-worker registration; ignore. */
      }
    }
  }, [testMutation])

  return (
    <SettingsSection
      icon={BellRing}
      title="Notification preferences"
      description="Per-category delivery for in-app, web, and push channels — plus a global importance threshold."
      action={
        <Button
          size="sm"
          variant="outline"
          onClick={handleTest}
          disabled={testMutation.isPending}
          aria-label="Send a test notification"
        >
          {testMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
          <span>Test notification</span>
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <Tabs
          value={activeChannel}
          onValueChange={(v) => setActiveChannel(v as NotificationPrefChannel)}
        >
          <TabsList className="w-full">
            {CHANNELS.map(({ key, label, icon: Icon }) => (
              <TabsTrigger key={key} value={key} className="flex-1 gap-1.5">
                <Icon className="size-4" aria-hidden />
                <span>{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {CHANNELS.map(({ key, label, description }) => {
            const channelMap = prefsByChannel.get(key)
            // Global row reflects the channel-wide default; if no explicit
            // global row exists, fall back to the channel implicit default
            // (in_app/web → on, push → off).
            const globalEnabled =
              channelMap?.get('__global__') ?? (key === 'push' ? false : true)
            return (
              <TabsContent key={key} value={key} className="mt-4">
                <div className="flex flex-col gap-3">
                  {/* Global default row — highlighted to signal "default for all categories". */}
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-accent/40 p-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Bell className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <Label htmlFor={`np-global-${key}`} className="text-sm font-medium">
                          All categories
                        </Label>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {description} Default for the {label.toLowerCase()} channel; categories
                          without an explicit override follow this.
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={`np-global-${key}`}
                      checked={globalEnabled}
                      onCheckedChange={(c) => handleToggle(key, null, c)}
                      disabled={updateMutation.isPending}
                      aria-label={`Toggle ${label} notifications for all categories`}
                    />
                  </div>

                  <Separator className="bg-border" />

                  {/* Per-category list — bounded height with scroll for long lists. */}
                  {isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading sections…</p>
                  ) : catList.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No sections yet — create one in the Organized view.
                    </p>
                  ) : (
                    <ul
                      className="flex max-h-80 flex-col gap-1 overflow-y-auto pr-1"
                      role="list"
                    >
                      {catList.map((cat) => {
                        const enabled = channelMap?.get(cat.id) ?? globalEnabled
                        return (
                          <li key={cat.id} role="listitem">
                            <div className="flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent/40">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span
                                  className={cn(
                                    'flex size-6 shrink-0 items-center justify-center rounded-md cat-bg-soft cat-text',
                                    colorClass(cat.color),
                                  )}
                                >
                                  <CategoryIcon
                                    icon={cat.icon}
                                    color={cat.color}
                                    className="size-3.5"
                                  />
                                </span>
                                <span className="truncate text-sm font-medium text-foreground">
                                  {cat.name}
                                </span>
                                {cat.unreadCount > 0 ? (
                                  <Badge variant="secondary" className="text-xs">
                                    {cat.unreadCount} unread
                                  </Badge>
                                ) : null}
                              </div>
                              <Switch
                                checked={enabled}
                                onCheckedChange={(c) => handleToggle(key, cat.id, c)}
                                disabled={updateMutation.isPending}
                                aria-label={`Toggle ${label} notifications for ${cat.name}`}
                              />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </TabsContent>
            )
          })}
        </Tabs>

        <Separator className="bg-border" />

        {/* Importance threshold — client-side only (localStorage 'iei-notif-threshold'). */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Label htmlFor="np-importance" className="text-sm font-medium">
              Importance threshold
            </Label>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Only generate notifications for emails at or above this importance.
            </p>
          </div>
          <Select
            value={threshold}
            onValueChange={(v) => handleThresholdChange(v as ImportanceThreshold)}
          >
            <SelectTrigger id="np-importance" className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMPORTANCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-muted-foreground">
          Current threshold: {IMPORTANCE_OPTIONS.find((o) => o.value === threshold)?.hint}
        </p>

        <Separator className="bg-border" />

        {/* Web push note + Request permission button. */}
        <div className="flex flex-col gap-3">
          <InfoNotice icon={Info} tone="info">
            Web push notifications require browser permission.{' '}
            {permState === 'unsupported' ? (
              <span className="text-foreground">This browser does not support web notifications.</span>
            ) : permState === 'granted' ? (
              <span className="text-foreground">Permission granted.</span>
            ) : permState === 'denied' ? (
              <span className="text-foreground">
                Permission denied — enable it in your browser&apos;s site settings.
              </span>
            ) : (
              <span className="text-foreground">Permission not yet requested.</span>
            )}
          </InfoNotice>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRequestPermission}
              disabled={
                permState === 'unsupported' ||
                permState === 'granted' ||
                permState === 'denied'
              }
            >
              Request permission
            </Button>
          </div>
        </div>
      </div>
    </SettingsSection>
  )
}
