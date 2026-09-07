'use client'

import * as React from 'react'
import { Bell, BellRing, Globe, Info, Smartphone } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { InfoNotice, SettingsSection } from './section-wrapper'
import {
  DEFAULT_NOTIF_PREFS,
  loadNotifPrefs,
  saveNotifPrefs,
  type NotifPrefs,
} from './local-prefs'

type ChannelKey = keyof NotifPrefs

const CHANNELS: { key: ChannelKey; label: string; description: string; icon: typeof Bell }[] = [
  {
    key: 'inApp',
    label: 'In-app notifications',
    description: 'Show the bell badge and toasts while the app is open.',
    icon: BellRing,
  },
  {
    key: 'web',
    label: 'Web push (browser)',
    description: 'Browser-level alerts even when the tab is in the background.',
    icon: Globe,
  },
  {
    key: 'push',
    label: 'Device push',
    description: 'Native OS notifications on mobile and desktop installs.',
    icon: Smartphone,
  },
]

export function NotificationsSection() {
  const [prefs, setPrefs] = React.useState<NotifPrefs>(() => loadNotifPrefs())

  const update = React.useCallback((patch: Partial<NotifPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      saveNotifPrefs(next)
      return next
    })
  }, [])

  return (
    <SettingsSection
      icon={Bell}
      title="Notifications"
      description="Default delivery channels. Per-category preferences follow in a future update."
    >
      <ul className="flex flex-col gap-4">
        {CHANNELS.map(({ key, label, description, icon: Icon }, idx) => (
          <li key={key}>
            {idx > 0 ? <Separator className="mb-4 bg-border" /> : null}
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <Label htmlFor={`notif-${key}`} className="text-sm font-medium">
                    {label}
                  </Label>
                  <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
              <Switch
                id={`notif-${key}`}
                checked={prefs[key]}
                onCheckedChange={(c) => update({ [key]: c } as Partial<NotifPrefs>)}
                aria-label={`Toggle ${label}`}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <InfoNotice icon={Info} tone="info">
          Per-category preferences — such as deadlines, urgent alerts, and section summaries —
          follow this global default. Fine-grained controls arrive in a future update.
        </InfoNotice>
      </div>

      {Object.values(prefs).every((v) => v === false) ? (
        <p className="mt-3 text-sm text-muted-foreground">
          All channels are off. You will still see badges inside the app, but no alerts will be
          delivered. Defaults: in-app on, others off.
        </p>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">
        Defaults: in-app <span className="text-foreground">{DEFAULT_NOTIF_PREFS.inApp ? 'on' : 'off'}</span>,
        web <span className="text-foreground">{DEFAULT_NOTIF_PREFS.web ? 'on' : 'off'}</span>,
        push <span className="text-foreground">{DEFAULT_NOTIF_PREFS.push ? 'on' : 'off'}</span>.
      </p>
    </SettingsSection>
  )
}
