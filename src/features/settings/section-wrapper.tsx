'use client'

import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Shared section wrapper: a Card with an icon-led header (title + description)
 * and a content body. Used by every Settings section for visual consistency.
 */
export function SettingsSection({
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <Card className={cn('gap-0 py-0', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-base">{title}</CardTitle>
            {description ? (
              <CardDescription className="mt-1 text-sm">{description}</CardDescription>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent className={cn('px-4 py-4 sm:px-6', contentClassName)}>{children}</CardContent>
    </Card>
  )
}

/**
 * Inline info notice — a tinted row with an icon + a short message.
 * Tone is derived from semantic tokens (info = primary, success, warning).
 */
export function InfoNotice({
  icon: Icon,
  tone = 'info',
  children,
  className,
}: {
  icon: LucideIcon
  tone?: 'info' | 'success' | 'warning'
  children: React.ReactNode
  className?: string
}) {
  const toneCls =
    tone === 'success'
      ? 'bg-success/10 text-success'
      : tone === 'warning'
        ? 'bg-warning/10 text-warning'
        : 'bg-primary/10 text-primary'
  return (
    <div className={cn('flex items-start gap-2.5 rounded-lg border border-border bg-accent/40 p-3', className)}>
      <Icon className={cn('mt-0.5 size-4 shrink-0', toneCls)} aria-hidden />
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

/**
 * Security principle row — a check-led list item with a title + body.
 */
export function PrincipleItem({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon
  title: string
  children: React.ReactNode
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{children}</p>
      </div>
    </li>
  )
}
