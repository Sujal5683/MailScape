'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'

import { Badge } from '@/components/ui/badge'
import { summarizeExpression } from '@/lib/rules/engine'
import { useCategories, useCreateRule, useSender } from '@/hooks/use-queries'
import { useToast } from '@/hooks/use-toast'
import { colorClass } from '@/lib/category-meta'
import { cn } from '@/lib/utils'
import type {
  Condition,
  ConditionField,
  ConditionGroup,
  ConditionOp,
  RuleAction,
  RuleActionType,
} from '@/lib/types'
import { Filter, Plus, Save, Sparkles, Trash2, Zap } from 'lucide-react'

const FIELD_OPTIONS: { value: ConditionField; label: string }[] = [
  { value: 'sender_email', label: 'Sender email' },
  { value: 'sender_domain', label: 'Sender domain' },
  { value: 'sender_name', label: 'Sender name' },
  { value: 'subject', label: 'Subject' },
  { value: 'contains_text', label: 'Body contains' },
  { value: 'not_contains_text', label: 'Body excludes' },
  { value: 'has_attachment', label: 'Has attachment' },
  { value: 'is_important', label: 'Is important' },
  { value: 'is_starred', label: 'Is starred' },
  { value: 'to', label: 'Recipient (To)' },
  { value: 'cc', label: 'Recipient (CC)' },
  { value: 'labels', label: 'Has label' },
]

const OP_OPTIONS: { value: ConditionOp; label: string }[] = [
  { value: 'contains', label: 'contains' },
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'in', label: 'in list' },
  { value: 'is_true', label: 'is true' },
  { value: 'is_false', label: 'is false' },
]

const ACTION_OPTIONS: { value: RuleActionType; label: string }[] = [
  { value: 'classify', label: 'Classify into section' },
  { value: 'mark_important', label: 'Mark important' },
  { value: 'mark_read', label: 'Mark as read' },
  { value: 'mark_unread', label: 'Mark as unread' },
  { value: 'star', label: 'Star' },
  { value: 'unstar', label: 'Unstar' },
  { value: 'add_label', label: 'Add label' },
  { value: 'notify', label: 'Notify' },
  { value: 'create_deadline', label: 'Create deadline' },
]

const BOOL_FIELDS: ConditionField[] = ['has_attachment', 'is_important', 'is_starred']
const BOOL_OPS: ConditionOp[] = ['is_true', 'is_false']

function isBoolField(f: ConditionField) {
  return BOOL_FIELDS.includes(f)
}

function shouldShowValue(field: ConditionField, op: ConditionOp) {
  if (BOOL_OPS.includes(op)) return false
  if (isBoolField(field)) return false
  return true
}

interface DraftCondition {
  field: ConditionField
  op: ConditionOp
  value: string
}

interface DraftAction {
  type: RuleActionType
  categoryId?: string
  label?: string
  deadlineTitle?: string
}

function summarizeAction(action: DraftAction, categoryName?: string): string {
  switch (action.type) {
    case 'classify':
      return `Classify into ${categoryName ?? 'a section'}`
    case 'mark_important':
      return 'Mark as important'
    case 'mark_read':
      return 'Mark as read'
    case 'mark_unread':
      return 'Mark as unread'
    case 'star':
      return 'Add star'
    case 'unstar':
      return 'Remove star'
    case 'add_label':
      return `Add label "${action.label ?? ''}"`
    case 'notify':
      return 'Send a notification'
    case 'create_deadline':
      return `Create deadline "${action.deadlineTitle ?? ''}"`
    default:
      return String(action.type)
  }
}

export function RuleBuilder({
  open,
  onOpenChange,
  prefillSenderId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefillSenderId: string | null
}) {
  const createRule = useCreateRule()
  const { data: categories } = useCategories()
  const { data: prefillSender } = useSender(prefillSenderId)
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [priority, setPriority] = useState('100')
  const [combinator, setCombinator] = useState<'AND' | 'OR'>('AND')
  const [enabled, setEnabled] = useState(true)
  const [conditions, setConditions] = useState<DraftCondition[]>([
    { field: 'sender_email', op: 'contains', value: '' },
  ])
  const [actions, setActions] = useState<DraftAction[]>([{ type: 'classify' }])
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null)

  // Prefill sender condition when opening with a sender context.
  // Uses the documented "adjust state during render when a prop changes" pattern
  // (avoids setState-in-effect cascading renders).
  if (
    open &&
    prefillSenderId &&
    prefillSender &&
    prefillSenderId !== prefilledFor
  ) {
    setPrefilledFor(prefillSenderId)
    setConditions([
      { field: 'sender_email', op: 'contains', value: prefillSender.senderEmail },
    ])
    if (!name) {
      setName(`Rule for ${prefillSender.senderName ?? prefillSender.senderEmail}`)
    }
  }

  // Reset form shortly after the dialog closes (avoid close flicker).
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setName('')
        setPriority('100')
        setCombinator('AND')
        setEnabled(true)
        setConditions([{ field: 'sender_email', op: 'contains', value: '' }])
        setActions([{ type: 'classify' }])
        setPrefilledFor(null)
      }, 220)
      return () => clearTimeout(t)
    }
  }, [open])

  function updateCondition(idx: number, patch: Partial<DraftCondition>) {
    setConditions((cs) =>
      cs.map((c, i) => {
        if (i !== idx) return c
        const next: DraftCondition = { ...c, ...patch }
        if (patch.field && isBoolField(patch.field)) {
          next.op = 'is_true'
          next.value = ''
        } else if (patch.field && !isBoolField(patch.field) && BOOL_OPS.includes(c.op)) {
          next.op = 'contains'
        }
        return next
      }),
    )
  }

  function addCondition() {
    setConditions((cs) => [...cs, { field: 'subject', op: 'contains', value: '' }])
  }

  function removeCondition(idx: number) {
    setConditions((cs) => cs.filter((_, i) => i !== idx))
  }

  function updateAction(idx: number, patch: Partial<DraftAction>) {
    setActions((as) => as.map((a, i) => (i === idx ? { ...a, ...patch } : a)))
  }

  function addAction() {
    setActions((as) => [...as, { type: 'mark_read' }])
  }

  function removeAction(idx: number) {
    setActions((as) => as.filter((_, i) => i !== idx))
  }

  const expression: ConditionGroup = {
    combinator,
    conditions: conditions.map<Condition>((c) => ({
      field: c.field,
      op: c.op,
      value: BOOL_OPS.includes(c.op) ? true : c.value,
    })),
  }

  const summary = summarizeExpression(expression)
  const actionSummary = actions
    .map((a) => summarizeAction(a, categories?.find((c) => c.id === a.categoryId)?.name))
    .join('  ·  ')

  const nameMissing = !name.trim()
  const noConditions = conditions.length === 0
  const noActions = actions.length === 0

  function handleSave() {
    if (nameMissing) {
      toast({ title: 'Rule name is required', variant: 'destructive' })
      return
    }
    if (noConditions) {
      toast({ title: 'Add at least one condition', variant: 'destructive' })
      return
    }
    if (noActions) {
      toast({ title: 'Add at least one action', variant: 'destructive' })
      return
    }
    const cleanedActions: RuleAction[] = actions.map((a) => {
      const out: RuleAction = { type: a.type }
      if (a.type === 'classify' && a.categoryId) out.categoryId = a.categoryId
      if (a.type === 'add_label' && a.label) out.label = a.label
      if (a.type === 'create_deadline' && a.deadlineTitle) out.deadlineTitle = a.deadlineTitle
      return out
    })
    createRule.mutate(
      {
        name: name.trim(),
        expression,
        actions: cleanedActions,
        priority: Number(priority) || 100,
        enabled,
      },
      {
        onSuccess: () => onOpenChange(false),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-h-[700px] sm:max-w-2xl">
        <DialogHeader className="gap-1 border-b border-border px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Rule Builder
          </DialogTitle>
          <DialogDescription>
            Deterministic rules run on every incoming email — before any AI classification.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-6 px-6 py-5">
            {/* Name + priority */}
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <div className="space-y-1.5">
                <Label htmlFor="rule-name">Rule name</Label>
                <Input
                  id="rule-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Route placement emails"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-priority">Priority</Label>
                <Input
                  id="rule-priority"
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                />
              </div>
            </div>

            {/* Conditions */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  When these match
                </Label>
                <CombinatorToggle value={combinator} onChange={setCombinator} />
              </div>
              <div className="space-y-2">
                {conditions.map((c, idx) => (
                  <ConditionRow
                    key={idx}
                    condition={c}
                    combinator={combinator}
                    isFirst={idx === 0}
                    onChange={(patch) => updateCondition(idx, patch)}
                    onRemove={() => removeCondition(idx)}
                  />
                ))}
                {conditions.length === 0 && (
                  <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                    No conditions yet. Add at least one.
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={addCondition} className="w-full">
                <Plus className="h-3.5 w-3.5" />
                Add condition
              </Button>
            </div>

            <Separator />

            {/* Actions */}
            <div className="space-y-3">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                Then do
              </Label>
              <div className="space-y-2">
                {actions.map((a, idx) => (
                  <ActionRow
                    key={idx}
                    action={a}
                    categories={categories ?? []}
                    onChange={(patch) => updateAction(idx, patch)}
                    onRemove={() => removeAction(idx)}
                  />
                ))}
                {actions.length === 0 && (
                  <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                    No actions yet. Add at least one.
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={addAction} className="w-full">
                <Plus className="h-3.5 w-3.5" />
                Add action
              </Button>
            </div>

            <Separator />

            {/* Live summary */}
            <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Live preview
              </div>
              <div className="break-words font-mono text-xs">
                <span className="text-muted-foreground">IF </span>
                <span>{summary || '—'}</span>
              </div>
              <div className="break-words text-xs">
                <span className="text-muted-foreground">THEN </span>
                <span>{actionSummary || '—'}</span>
              </div>
            </div>

            {/* Enabled toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="pr-3">
                <div className="text-sm font-medium">Enabled</div>
                <div className="text-xs text-muted-foreground">
                  Run this rule on incoming mail
                </div>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={createRule.isPending}>
            <Save className="h-3.5 w-3.5" />
            {createRule.isPending ? 'Saving…' : 'Save rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CombinatorToggle({
  value,
  onChange,
}: {
  value: 'AND' | 'OR'
  onChange: (v: 'AND' | 'OR') => void
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-border p-0.5 text-xs">
      {(['AND', 'OR'] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={cn(
            'rounded px-2.5 py-1 font-medium transition-colors',
            value === opt
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Match {opt}
        </button>
      ))}
    </div>
  )
}

function ConditionRow({
  condition,
  combinator,
  isFirst,
  onChange,
  onRemove,
}: {
  condition: DraftCondition
  combinator: 'AND' | 'OR'
  isFirst: boolean
  onChange: (patch: Partial<DraftCondition>) => void
  onRemove: () => void
}) {
  const showValue = shouldShowValue(condition.field, condition.op)
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2">
      {!isFirst && (
        <Badge variant="secondary" className="shrink-0">
          {combinator}
        </Badge>
      )}
      <Select
        value={condition.field}
        onValueChange={(v) => onChange({ field: v as ConditionField })}
      >
        <SelectTrigger className="h-8 min-w-[140px] flex-1 sm:flex-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FIELD_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={condition.op}
        onValueChange={(v) => onChange({ op: v as ConditionOp })}
      >
        <SelectTrigger className="h-8 min-w-[110px] flex-1 sm:flex-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OP_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showValue && (
        <Input
          className="h-8 min-w-[120px] flex-1"
          value={condition.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="value"
        />
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        aria-label="Remove condition"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function ActionRow({
  action,
  categories,
  onChange,
  onRemove,
}: {
  action: DraftAction
  categories: { id: string; name: string; color: string }[]
  onChange: (patch: Partial<DraftAction>) => void
  onRemove: () => void
}) {
  const selectedCategory = categories.find((c) => c.id === action.categoryId)
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2">
      <Select
        value={action.type}
        onValueChange={(v) => onChange({ type: v as RuleActionType })}
      >
        <SelectTrigger className="h-8 min-w-[160px] flex-1 sm:flex-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ACTION_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {action.type === 'classify' && (
        <Select
          value={action.categoryId ?? ''}
          onValueChange={(v) => onChange({ categoryId: v })}
        >
          <SelectTrigger
            className={cn(
              'h-8 min-w-[160px] flex-1 sm:flex-none',
              selectedCategory && colorClass(selectedCategory.color),
            )}
          >
            <span
              className={cn(
                'inline-block h-2 w-2 shrink-0 rounded-full',
                selectedCategory ? 'cat-dot' : 'bg-muted-foreground/40',
              )}
            />
            <SelectValue placeholder="Choose section" />
          </SelectTrigger>
          <SelectContent>
            {categories.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                No sections available
              </div>
            ) : (
              categories.map((c) => (
                <SelectItem key={c.id} value={c.id} className={colorClass(c.color)}>
                  <span className="cat-dot mr-1.5 inline-block h-2 w-2 rounded-full align-middle" />
                  <span className="cat-text">{c.name}</span>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      )}
      {action.type === 'add_label' && (
        <Input
          className="h-8 min-w-[120px] flex-1"
          value={action.label ?? ''}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="label name"
        />
      )}
      {action.type === 'create_deadline' && (
        <Input
          className="h-8 min-w-[120px] flex-1"
          value={action.deadlineTitle ?? ''}
          onChange={(e) => onChange({ deadlineTitle: e.target.value })}
          placeholder="deadline title"
        />
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        aria-label="Remove action"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
