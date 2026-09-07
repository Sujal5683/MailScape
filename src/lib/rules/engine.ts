// Rule engine — deterministic condition evaluation.
// Conditions and groups are evaluated against a normalized email context.
// This runs BEFORE any AI classification, per the spec's classification priority.

import type { Condition, ConditionGroup, RuleAction } from '@/lib/types'

export interface RuleContext {
  fromName: string | null
  fromEmail: string
  domain: string | null
  toRecipients: string[]
  ccRecipients: string[]
  bccRecipients: string[]
  subject: string | null
  bodyText: string | null
  snippet: string | null
  hasAttachment: boolean
  attachmentTypes: string[]
  receivedAt: Date | null
  labels: string[]
  keywords: string[]
  isRead: boolean
  isStarred: boolean
  isImportant: boolean
}

export interface MatchResult {
  matched: boolean
  actions: RuleAction[]
}

function normalize(value: string): string {
  return value.toLowerCase().trim()
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v))
  if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean)
  return []
}

function evalCondition(cond: Condition, ctx: RuleContext): boolean {
  const v = cond.value
  switch (cond.field) {
    case 'sender': {
      const sender = `${ctx.fromName ?? ''} ${ctx.fromEmail}`.toLowerCase()
      return compareString(sender, cond.op, String(v))
    }
    case 'sender_name':
      return compareString((ctx.fromName ?? '').toLowerCase(), cond.op, String(v).toLowerCase())
    case 'sender_email':
      return compareString(ctx.fromEmail.toLowerCase(), cond.op, String(v).toLowerCase())
    case 'sender_domain':
      return compareString((ctx.domain ?? '').toLowerCase(), cond.op, String(v).toLowerCase())
    case 'to':
      return ctx.toRecipients.some((r) => compareString(r.toLowerCase(), cond.op, String(v).toLowerCase()))
    case 'cc':
      return ctx.ccRecipients.some((r) => compareString(r.toLowerCase(), cond.op, String(v).toLowerCase()))
    case 'bcc':
      return ctx.bccRecipients.some((r) => compareString(r.toLowerCase(), cond.op, String(v).toLowerCase()))
    case 'subject':
      return compareString((ctx.subject ?? '').toLowerCase(), cond.op, String(v).toLowerCase())
    case 'contains_text':
      return (ctx.bodyText ?? '').toLowerCase().includes(String(v).toLowerCase())
    case 'not_contains_text':
      return !(ctx.bodyText ?? '').toLowerCase().includes(String(v).toLowerCase())
    case 'has_attachment':
      return cond.op === 'is_true' ? ctx.hasAttachment : !ctx.hasAttachment
    case 'attachment_type':
      return ctx.attachmentTypes.some((t) => t.toLowerCase() === String(v).toLowerCase())
    case 'date': {
      if (!ctx.receivedAt) return false
      const d = ctx.receivedAt.getTime()
      const target = new Date(String(v)).getTime()
      if (Number.isNaN(target)) return false
      return cond.op === 'before' ? d < target : d > target
    }
    case 'time': {
      if (!ctx.receivedAt) return false
      const minutes = ctx.receivedAt.getHours() * 60 + ctx.receivedAt.getMinutes()
      const [h, m] = String(v).split(':').map(Number)
      const target = h * 60 + (m || 0)
      return cond.op === 'before' ? minutes < target : minutes > target
    }
    case 'labels':
      return ctx.labels.some((l) => asStringArray(v).includes(l.toLowerCase()))
    case 'keywords':
      return ctx.keywords.some((k) => asStringArray(v).includes(k.toLowerCase()))
    case 'category':
      return false
    case 'is_read':
      return cond.op === 'is_true' ? ctx.isRead : !ctx.isRead
    case 'is_starred':
      return cond.op === 'is_true' ? ctx.isStarred : !ctx.isStarred
    case 'is_important':
      return cond.op === 'is_true' ? ctx.isImportant : !ctx.isImportant
    default:
      return false
  }
}

function compareString(actual: string, op: Condition['op'], expected: string): boolean {
  switch (op) {
    case 'equals':
      return actual === expected
    case 'not_equals':
      return actual !== expected
    case 'contains':
      return actual.includes(expected)
    case 'not_contains':
      return !actual.includes(expected)
    case 'starts_with':
      return actual.startsWith(expected)
    case 'ends_with':
      return actual.endsWith(expected)
    case 'in':
      return expected.split(',').map((s) => s.trim()).includes(actual)
    default:
      return false
  }
}

function evalGroup(group: ConditionGroup, ctx: RuleContext): boolean {
  const results = group.conditions.map((c) =>
    'combinator' in c ? evalGroup(c, ctx) : evalCondition(c, ctx),
  )
  if (results.length === 0) return true
  return group.combinator === 'AND' ? results.every(Boolean) : results.some(Boolean)
}

export function evaluateExpression(expression: ConditionGroup, ctx: RuleContext): boolean {
  return evalGroup(expression, ctx)
}

export function summarizeExpression(group: ConditionGroup): string {
  const parts = group.conditions.map((c) => {
    if ('combinator' in c) return `(${summarizeExpression(c)})`
    return `${c.field} ${c.op.replace('_', ' ')} "${String(c.value)}"`
  })
  return parts.join(` ${group.combinator} `)
}
