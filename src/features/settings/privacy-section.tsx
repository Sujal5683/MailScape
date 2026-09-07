'use client'

import * as React from 'react'
import { History, Paperclip, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { SettingsSection } from './section-wrapper'
import { cn } from '@/lib/utils'

function RetentionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon
  title: string
  children: React.ReactNode
}) {
  return (
    <Card className={cn('gap-0 border-border py-0')}>
      <CardContent className="flex items-start gap-3 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{children}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function PrivacySection() {
  return (
    <SettingsSection
      icon={ShieldCheck}
      title="Privacy & retention"
      description="How long Institutional Email Intelligence keeps data, and how it protects you while rendering untrusted mail."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <RetentionCard icon={History} title="Chat history retained for 30 days">
          Assistant conversations are kept for thirty days, then automatically purged. You can clear
          them sooner from the assistant panel.
        </RetentionCard>
        <RetentionCard icon={Paperclip} title="Attachments are temporary">
          Chat attachments are processed in memory and never stored permanently. Downloaded files
          live only as long as your session.
        </RetentionCard>
        <RetentionCard icon={ShieldCheck} title="Email bodies are sanitized">
          Every message body is sanitized before rendering. Scripts, trackers, and risky markup are
          stripped — only safe HTML reaches the reader.
        </RetentionCard>
      </div>
    </SettingsSection>
  )
}
