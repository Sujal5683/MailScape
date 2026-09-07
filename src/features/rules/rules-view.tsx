'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { EmptyState } from '@/components/common/states'
import { SleekSeparator } from '@/components/common/separator'
import {
  useDeleteRule,
  useRules,
  useUpdateRule,
} from '@/hooks/use-queries'
import { useUIStore } from '@/store/ui-store'
import { summarizeExpression } from '@/lib/rules/engine'
import type { Rule, RuleAction } from '@/lib/types'
import { RuleBuilder } from './rule-builder'
import { Bot, Cpu, Plus, Trash2, User, Zap } from 'lucide-react'
import { Fragment } from 'react'

export function RulesView() {
  const { data: rules, isLoading } = useRules()
  const contextSenderId = useUIStore((s) => s.contextSenderId)
  const setContext = useUIStore((s) => s.setContext)
  const [builderOpen, setBuilderOpen] = useState(false)

  function openBuilder() {
    setBuilderOpen(true)
  }

  function closeBuilder(open: boolean) {
    setBuilderOpen(open)
    if (!open && contextSenderId) {
      // Clear the sender context once the builder has consumed it
      setContext({ contextSenderId: null })
    }
  }

  const sortedRules = rules
    ? [...rules].sort((a, b) => a.priority - b.priority)
    : []

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 pb-20 py-6 sm:px-6 md:pb-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <Zap className="h-5 w-5 text-primary" />
              Rules & Automation
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Deterministic rules run on every incoming email — before any AI classification.
            </p>
          </div>
          <Button onClick={openBuilder} className="shrink-0">
            <Plus className="h-4 w-4" />
            Create Rule
          </Button>
        </header>

        <section className="mt-6">
          {isLoading ? (
            <RulesSkeleton />
          ) : sortedRules.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No rules yet"
              description="Rules let you automatically classify and act on incoming mail deterministically — before any AI."
              action={
                <Button onClick={openBuilder}>
                  <Plus className="h-4 w-4" />
                  Create your first rule
                </Button>
              }
            />
          ) : (
            <ul className="space-y-0">
              {sortedRules.map((rule, idx) => (
                <Fragment key={rule.id}>
                  <li>
                    <RuleRow rule={rule} />
                  </li>
                  {idx < sortedRules.length - 1 && (
                    <li aria-hidden className="py-1.5">
                      <SleekSeparator />
                    </li>
                  )}
                </Fragment>
              ))}
            </ul>
          )}
        </section>
      </div>

      <RuleBuilder
        open={builderOpen}
        onOpenChange={closeBuilder}
        prefillSenderId={contextSenderId}
      />
    </div>
  )
}

function RuleRow({ rule }: { rule: Rule }) {
  const updateRule = useUpdateRule()
  const deleteRule = useDeleteRule()
  const summary = summarizeExpression(rule.expression)

  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{rule.name}</h3>
            <CreatedByBadge source={rule.createdBy} />
            {!rule.enabled && (
              <Badge variant="outline" className="text-muted-foreground">
                Paused
              </Badge>
            )}
          </div>
          <p className="mt-1.5 break-words font-mono text-xs text-muted-foreground">
            <span className="text-foreground/60">IF </span>
            {summary}
          </p>
          <p className="mt-1 break-words text-xs text-muted-foreground">
            <span className="text-foreground/60">THEN </span>
            {summarizeActions(rule.actions)}
          </p>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Priority
            </div>
            <div className="text-sm font-medium">{rule.priority}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Hits
            </div>
            <div className="text-sm font-medium">{rule.hitCount}</div>
          </div>
          <Switch
            checked={rule.enabled}
            onCheckedChange={(checked) =>
              updateRule.mutate({ id: rule.id, enabled: checked })
            }
            aria-label={rule.enabled ? 'Disable rule' : 'Enable rule'}
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                aria-label="Delete rule"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete rule?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &ldquo;{rule.name}&rdquo;. Future
                  emails will no longer be matched by it.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Button
                    variant="destructive"
                    onClick={() => deleteRule.mutate(rule.id)}
                  >
                    Delete
                  </Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Card>
  )
}

function CreatedByBadge({ source }: { source: Rule['createdBy'] }) {
  if (source === 'user') {
    return (
      <Badge variant="secondary" className="gap-1">
        <User className="h-3 w-3" />
        user
      </Badge>
    )
  }
  if (source === 'ai') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Bot className="h-3 w-3" />
        ai
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <Cpu className="h-3 w-3" />
      system
    </Badge>
  )
}

function summarizeActions(actions: RuleAction[]): string {
  if (actions.length === 0) return '—'
  return actions
    .map((a) => {
      switch (a.type) {
        case 'classify':
          return 'Classify into section'
        case 'mark_important':
          return 'Mark important'
        case 'mark_read':
          return 'Mark read'
        case 'mark_unread':
          return 'Mark unread'
        case 'star':
          return 'Star'
        case 'unstar':
          return 'Unstar'
        case 'add_label':
          return `Add label "${a.label ?? ''}"`
        case 'notify':
          return 'Notify'
        case 'create_deadline':
          return `Create deadline "${a.deadlineTitle ?? ''}"`
        default:
          return String(a.type)
      }
    })
    .join('  ·  ')
}

function RulesSkeleton() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="rounded-xl border border-border/60 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-48" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-5 w-9 rounded-full" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
          <Skeleton className="mt-3 h-3 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </li>
      ))}
    </ul>
  )
}
