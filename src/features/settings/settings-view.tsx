'use client'

import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Bell, BellRing, Brain, Mail, Palette, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AccountsSection } from './accounts-section'
import { AppearanceSection } from './appearance-section'
import { AiPrefsSection } from './ai-prefs-section'
import { NotificationsSection } from './notifications-section'
import { NotificationPreferencesSection } from './notification-preferences-section'
import { PrivacySection } from './privacy-section'
import { SecuritySection } from './security-section'
import { AuditLogSection } from './audit-log-section'

interface SectionDef {
  id: string
  label: string
  icon: LucideIcon
  Component: React.ComponentType
}

const SECTIONS: SectionDef[] = [
  { id: 'accounts', label: 'Accounts', icon: Mail, Component: AccountsSection },
  { id: 'appearance', label: 'Appearance', icon: Palette, Component: AppearanceSection },
  { id: 'ai', label: 'AI preferences', icon: Brain, Component: AiPrefsSection },
  { id: 'notifications', label: 'Notifications', icon: Bell, Component: NotificationsSection },
  { id: 'notification-preferences', label: 'Notification preferences', icon: BellRing, Component: NotificationPreferencesSection },
  { id: 'privacy', label: 'Privacy', icon: ShieldCheck, Component: PrivacySection },
  { id: 'security', label: 'Security', icon: SlidersHorizontal, Component: SecuritySection },
  { id: 'audit-log', label: 'Audit Log', icon: ShieldCheck, Component: AuditLogSection },
]

export function SettingsView() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl p-4 pb-20 md:p-6 md:pb-6">
        <header className="mb-5 flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Accounts, appearance, AI behavior, notifications, privacy, security, and audit log — all
            in one place.
          </p>
        </header>

        {/* Mobile: all sections stacked. Tabs collapse to plain scroll. */}
        <div className="flex flex-col gap-5 md:hidden">
          {SECTIONS.map(({ id, Component }) => (
            <Component key={id} />
          ))}
        </div>

        {/* Desktop: left vertical tab rail, content pane on the right. */}
        <Tabs defaultValue={SECTIONS[0].id} className="hidden md:flex md:flex-row md:items-start md:gap-6">
          <TabsList
            aria-orientation="vertical"
            className="sticky top-6 flex h-auto w-52 shrink-0 flex-col items-stretch gap-1 rounded-lg bg-muted p-2"
          >
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="justify-start gap-2 px-3 py-2 text-sm data-[state=active]:bg-background"
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-w-0 flex-1">
            {SECTIONS.map(({ id, Component }) => (
              <TabsContent key={id} value={id} className="mt-0">
                <Component />
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>
    </div>
  )
}
