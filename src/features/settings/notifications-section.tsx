'use client'

import * as React from 'react'
import { Bell, BellRing, Globe, Info, Loader2, CheckCircle2, AlertCircle, BellOff } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { InfoNotice, SettingsSection } from './section-wrapper'
import {
  DEFAULT_NOTIF_PREFS,
  loadNotifPrefs,
  saveNotifPrefs,
  type NotifPrefs,
} from './local-prefs'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { cn } from '@/lib/utils'

export function NotificationsSection() {
  const [prefs, setPrefs] = React.useState<NotifPrefs>(() => loadNotifPrefs())

  const {
    supported,
    permission,
    subscribed,
    loading: pushLoading,
    error: pushError,
    subscribe,
    unsubscribe,
  } = usePushNotifications()

  const update = React.useCallback((patch: Partial<NotifPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      saveNotifPrefs(next)
      return next
    })
  }, [])

  // When the user toggles web push, trigger the real browser subscribe/unsubscribe flow
  const handleWebPushToggle = React.useCallback(async (checked: boolean) => {
    if (checked) {
      await subscribe()
      update({ web: true, push: true })
    } else {
      await unsubscribe()
      update({ web: false, push: false })
    }
  }, [subscribe, unsubscribe, update])

  const pushStatusLabel = React.useMemo(() => {
    if (!supported) return 'Not supported in this browser'
    if (permission === 'denied') return 'Blocked by browser — update site permissions'
    if (subscribed) return 'Active — notifications delivered to this device'
    return 'Inactive — click to enable'
  }, [supported, permission, subscribed])

  const pushStatusIcon = () => {
    if (!supported) return <BellOff className="size-4 text-muted-foreground" />
    if (permission === 'denied') return <AlertCircle className="size-4 text-destructive" />
    if (subscribed) return <CheckCircle2 className="size-4 text-green-500" />
    return <Globe className="size-4" />
  }

  return (
    <SettingsSection
      icon={Bell}
      title="Notifications"
      description="Configure how and when MailScape sends you alerts."
    >
      <ul className="flex flex-col gap-4">
        {/* In-app notifications */}
        <li>
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BellRing className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <Label htmlFor="notif-inApp" className="text-sm font-medium">
                  In-app notifications
                </Label>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Bell badge and toasts while the app is open.
                </p>
              </div>
            </div>
            <Switch
              id="notif-inApp"
              checked={prefs.inApp}
              onCheckedChange={(c) => update({ inApp: c })}
              aria-label="Toggle in-app notifications"
            />
          </div>
        </li>

        <Separator className="bg-border" />

        {/* Web Push notifications — wired to real browser API */}
        <li>
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg',
                subscribed ? 'bg-green-500/10 text-green-600' : 'bg-primary/10 text-primary',
              )}>
                {pushStatusIcon()}
              </span>
              <div className="min-w-0">
                <Label htmlFor="notif-webpush" className="text-sm font-medium">
                  Web Push Notifications
                </Label>
                <p className="mt-0.5 text-sm text-muted-foreground">{pushStatusLabel}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {pushLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              <Switch
                id="notif-webpush"
                checked={subscribed}
                disabled={pushLoading || !supported || permission === 'denied'}
                onCheckedChange={handleWebPushToggle}
                aria-label="Toggle web push notifications"
              />
            </div>
          </div>

          {/* Push error feedback */}
          {pushError && (
            <p className="mt-2 text-xs text-destructive flex items-center gap-1.5">
              <AlertCircle className="size-3 shrink-0" />
              {pushError}
            </p>
          )}

          {/* Browser permission denied — show how to fix */}
          {permission === 'denied' && (
            <InfoNotice icon={AlertCircle} tone="warning" className="mt-3">
              Notifications are blocked in your browser. Click the lock icon in the address bar and
              set &ldquo;Notifications&rdquo; to &ldquo;Allow&rdquo;, then refresh the page.
            </InfoNotice>
          )}

          {/* Not supported */}
          {!supported && (
            <InfoNotice icon={Info} tone="info" className="mt-3">
              Web Push is not supported in this browser. Try Chrome, Edge, or Firefox on a desktop.
            </InfoNotice>
          )}
        </li>
      </ul>

      <div className="mt-4">
        <InfoNotice icon={Info} tone="info">
          Web push delivers OS-level notifications even when the MailScape tab is closed. One
          subscription per browser/device — enable on each device separately.
        </InfoNotice>
      </div>

      {Object.values(prefs).every((v) => v === false) && !subscribed && (
        <p className="mt-3 text-sm text-muted-foreground">
          All channels are off — you won&apos;t receive any alerts. Enable at least one channel above.
        </p>
      )}
    </SettingsSection>
  )
}
