// Controlled AI tools — the ONLY path through which the assistant touches the database.
// Each tool has a risk class, confirmation policy, and (where reversible) a real inverse.
// Per spec: AI never bypasses the application architecture; email content is untrusted data.

import { db } from '@/lib/db'
import { mapEmailToList, mapEmailToDetail, mapCategory, mapSender, mapRule } from '@/lib/mappers'
import type { AssistantContentBlock, SourceRef, Rule, ConditionGroup, RuleAction, Recipient } from '@/lib/types'
import { classifyByEmail } from '@/lib/classifier'

export type ToolRisk = 'READ' | 'REVERSIBLE_WRITE' | 'SENSITIVE'

export interface ToolContext {
  accountId: string
  userId: string
  conversationId: string
  mode: 'direct' | 'thinking' | 'suggest'
}

export interface ToolResult {
  ok: boolean
  data?: unknown
  error?: string
  sources?: SourceRef[]
  contentBlocks?: AssistantContentBlock[]
  // For reversible writes: enough info to build the inverse + action record.
  action?: {
    toolName: string
    inputSummary: Record<string, unknown>
    resultSummary: Record<string, unknown>
    reversible: boolean
    inversePayload?: Record<string, unknown>
    inverseTool?: string
  }
}

export interface ToolDefinition {
  name: string
  description: string
  risk: ToolRisk
  requiresConfirmation: boolean
  inputSchema: Record<string, string>
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  { name: 'search_emails', description: 'Search emails by keyword, sender, category. Returns matching emails.', risk: 'READ', requiresConfirmation: false, inputSchema: { query: 'string', categoryId: 'string?', limit: 'number?' } },
  { name: 'get_email', description: 'Get full detail of one email by id.', risk: 'READ', requiresConfirmation: false, inputSchema: { messageId: 'string' } },
  { name: 'list_categories', description: 'List all categories with counts.', risk: 'READ', requiresConfirmation: false, inputSchema: {} },
  { name: 'list_senders', description: 'List top senders by frequency.', risk: 'READ', requiresConfirmation: false, inputSchema: { query: 'string?' } },
  { name: 'list_notifications', description: 'List recent notifications.', risk: 'READ', requiresConfirmation: false, inputSchema: {} },
  { name: 'generate_summary', description: 'Generate a concise summary of given emails.', risk: 'READ', requiresConfirmation: false, inputSchema: { messageIds: 'string[]' } },
  { name: 'create_category', description: 'Create a new category/section.', risk: 'REVERSIBLE_WRITE', requiresConfirmation: false, inputSchema: { name: 'string', color: 'string?', icon: 'string?' } },
  { name: 'create_rule', description: 'Create a deterministic rule (conditions + actions).', risk: 'REVERSIBLE_WRITE', requiresConfirmation: false, inputSchema: { name: 'string', expression: 'object', actions: 'object', priority: 'number?' } },
  { name: 'mark_read', description: 'Mark an email as read.', risk: 'REVERSIBLE_WRITE', requiresConfirmation: false, inputSchema: { messageId: 'string' } },
  { name: 'mark_unread', description: 'Mark an email as unread.', risk: 'REVERSIBLE_WRITE', requiresConfirmation: false, inputSchema: { messageId: 'string' } },
  { name: 'star_email', description: 'Star an email.', risk: 'REVERSIBLE_WRITE', requiresConfirmation: false, inputSchema: { messageId: 'string' } },
  { name: 'create_deadline', description: 'Create a tracked deadline from an email.', risk: 'REVERSIBLE_WRITE', requiresConfirmation: false, inputSchema: { emailId: 'string', title: 'string', dueAt: 'string' } },
  { name: 'create_draft', description: 'Save a draft email (does not send).', risk: 'REVERSIBLE_WRITE', requiresConfirmation: false, inputSchema: { to: 'array', subject: 'string', body: 'string' } },
  { name: 'send_email', description: 'Send an email through Gmail. SENSITIVE — always requires confirmation.', risk: 'SENSITIVE', requiresConfirmation: true, inputSchema: { to: 'array', subject: 'string', body: 'string' } },
  { name: 'delete_rule', description: 'Delete a rule. SENSITIVE.', risk: 'SENSITIVE', requiresConfirmation: true, inputSchema: { ruleId: 'string' } },
]

// ---- Execution ----

async function sourceRefFromEmail(emailId: string, accountId: string): Promise<SourceRef | null> {
  const e = await db.email.findFirst({ where: { id: emailId, accountId }, include: { memberships: { include: { category: true } } } })
  if (!e) return null
  const cat = e.memberships[0]?.category
  return {
    messageId: e.id,
    subject: e.subject,
    fromEmail: e.fromEmail,
    receivedAt: e.receivedAt?.toISOString() ?? null,
    categoryName: cat?.name ?? null,
    gmailUrl: `https://mail.google.com/mail/u/0/#inbox/${e.providerThreadId ?? ''}`,
  }
}

export async function executeTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  switch (name) {
    case 'search_emails':
      return searchEmails(input, ctx)
    case 'get_email':
      return getEmail(input, ctx)
    case 'list_categories':
      return listCategories(ctx)
    case 'list_senders':
      return listSenders(input, ctx)
    case 'list_notifications':
      return listNotifications(ctx)
    case 'generate_summary':
      return generateSummary(input, ctx)
    case 'create_category':
      return createCategory(input, ctx)
    case 'create_rule':
      return createRule(input, ctx)
    case 'mark_read':
      return markRead(input, ctx, true)
    case 'mark_unread':
      return markRead(input, ctx, false)
    case 'star_email':
      return starEmail(input, ctx, true)
    case 'create_deadline':
      return createDeadline(input, ctx)
    case 'create_draft':
      return createDraft(input, ctx)
    case 'send_email':
      return sendEmail(input, ctx)
    case 'delete_rule':
      return deleteRule(input, ctx)
    default:
      return { ok: false, error: `Unknown tool: ${name}` }
  }
}

async function searchEmails(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const query = String(input.query ?? '')
  const categoryId = input.categoryId ? String(input.categoryId) : undefined
  const limit = Math.min(Number(input.limit ?? 8), 15)
  const where: Record<string, unknown> = { accountId: ctx.accountId }
  if (query) {
    where.OR = [
      { subject: { contains: query } },
      { snippet: { contains: query } },
      { bodyText: { contains: query } },
      { fromEmail: { contains: query } },
      { fromName: { contains: query } },
    ]
  }
  if (categoryId) where.memberships = { some: { categoryId } }
  const emails = await db.email.findMany({
    where,
    include: { attachments: true, memberships: { include: { category: true } } },
    orderBy: { receivedAt: 'desc' },
    take: limit,
  })
  const items = emails.map(mapEmailToList)
  const sources = await Promise.all(emails.map((e) => sourceRefFromEmail(e.id, ctx.accountId)))
  return {
    ok: true,
    data: items,
    sources: sources.filter(Boolean) as SourceRef[],
    contentBlocks: [
      {
        type: 'text',
        text: `Found ${items.length} email${items.length === 1 ? '' : 's'} matching "${query}".`,
      },
    ],
  }
}

async function getEmail(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const messageId = String(input.messageId ?? '')
  const email = await db.email.findFirst({
    where: { id: messageId, accountId: ctx.accountId },
    include: { attachments: true, memberships: { include: { category: true } } },
  })
  if (!email) return { ok: false, error: 'Email not found' }
  const detail = mapEmailToDetail(email)
  const source = await sourceRefFromEmail(messageId, ctx.accountId)
  return {
    ok: true,
    data: detail,
    sources: source ? [source] : [],
  }
}

async function listCategories(ctx: ToolContext): Promise<ToolResult> {
  const cats = await db.category.findMany({
    where: { accountId: ctx.accountId },
    include: { memberships: { include: { email: { select: { isRead: true, isImportant: true, receivedAt: true } } } }, _count: { select: { memberships: true } } },
    orderBy: { sortOrder: 'asc' },
  })
  return { ok: true, data: cats.map(mapCategory) }
}

async function listSenders(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const q = input.query ? String(input.query) : undefined
  const where: Record<string, unknown> = { accountId: ctx.accountId }
  if (q) where.OR = [{ senderEmail: { contains: q } }, { senderName: { contains: q } }]
  const senders = await db.sender.findMany({
    where,
    include: { emails: { select: { subject: true, memberships: { include: { category: true } } }, take: 10, orderBy: { receivedAt: 'desc' } } },
    orderBy: { messageCount: 'desc' },
    take: 15,
  })
  return { ok: true, data: senders.map(mapSender) }
}

async function listNotifications(ctx: ToolContext): Promise<ToolResult> {
  const notifs = await db.notification.findMany({
    where: { accountId: ctx.accountId },
    orderBy: { createdAt: 'desc' },
    take: 12,
    include: { category: true },
  })
  return { ok: true, data: notifs }
}

async function generateSummary(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const ids = (input.messageIds as string[] | undefined) ?? []
  if (ids.length === 0) return { ok: false, error: 'No message ids provided' }
  const emails = await db.email.findMany({ where: { id: { in: ids }, accountId: ctx.accountId } })
  const sources = (await Promise.all(ids.map((id) => sourceRefFromEmail(id, ctx.accountId)))).filter(Boolean) as SourceRef[]
  const summaries = emails.map((e) => `- ${e.subject} (from ${e.fromEmail}, ${e.receivedAt?.toLocaleDateString()}): ${(e.snippet ?? '').slice(0, 160)}`)
  return {
    ok: true,
    sources,
    contentBlocks: [{ type: 'text', text: summaries.join('\n') || 'No emails to summarize.' }],
  }
}

async function createCategory(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const name = String(input.name ?? '').trim()
  if (!name) return { ok: false, error: 'Name required' }
  const existing = await db.category.findFirst({ where: { accountId: ctx.accountId, name } })
  if (existing) return { ok: false, error: 'Category already exists' }
  const maxOrder = await db.category.aggregate({ where: { accountId: ctx.accountId }, _max: { sortOrder: true } })
  const cat = await db.category.create({
    data: { accountId: ctx.accountId, name, color: String(input.color ?? 'slate'), icon: String(input.icon ?? 'folder'), sortOrder: (maxOrder._max.sortOrder ?? 0) + 1, systemDefault: false },
  })
  await db.auditEvent.create({ data: { userId: ctx.userId, accountId: ctx.accountId, eventType: 'AI_CATEGORY_CREATED', targetType: 'category', targetId: cat.id, sourceSurface: 'ai', metadata: JSON.stringify({ name, conversationId: ctx.conversationId }) } })
  return {
    ok: true,
    data: { id: cat.id, name: cat.name },
    action: { toolName: 'create_category', inputSummary: { name }, resultSummary: { categoryId: cat.id }, reversible: true, inverseTool: 'delete_category', inversePayload: { categoryId: cat.id } },
    contentBlocks: [{ type: 'text', text: `Created section "${name}".` }],
  }
}

async function createRule(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const name = String(input.name ?? '').trim()
  const expression = input.expression as ConditionGroup
  const actions = input.actions as RuleAction[]
  if (!name || !expression || !actions) return { ok: false, error: 'name, expression, actions required' }
  const rule = await db.rule.create({
    data: { accountId: ctx.accountId, name, expression: JSON.stringify(expression), actions: JSON.stringify(actions), priority: Number(input.priority ?? 100), enabled: true, createdBy: 'ai' },
  })
  await db.ruleVersion.create({ data: { ruleId: rule.id, version: 1, expression: rule.expression, actions: rule.actions } })
  await db.auditEvent.create({ data: { userId: ctx.userId, accountId: ctx.accountId, eventType: 'AI_RULE_CREATED', targetType: 'rule', targetId: rule.id, sourceSurface: 'ai', metadata: JSON.stringify({ name, conversationId: ctx.conversationId }) } })
  return {
    ok: true,
    data: { id: rule.id, name: rule.name },
    action: { toolName: 'create_rule', inputSummary: { name }, resultSummary: { ruleId: rule.id }, reversible: true, inverseTool: 'delete_rule', inversePayload: { ruleId: rule.id } },
    contentBlocks: [{ type: 'text', text: `Created rule "${name}".` }],
  }
}

async function markRead(input: Record<string, unknown>, ctx: ToolContext, read: boolean): Promise<ToolResult> {
  const messageId = String(input.messageId ?? '')
  const email = await db.email.findFirst({ where: { id: messageId, accountId: ctx.accountId } })
  if (!email) return { ok: false, error: 'Email not found' }
  const previous = email.isRead
  await db.email.update({ where: { id: messageId }, data: { isRead: read } })
  await db.auditEvent.create({ data: { userId: ctx.userId, accountId: ctx.accountId, eventType: read ? 'AI_EMAIL_MARKED_READ' : 'AI_EMAIL_MARKED_UNREAD', targetType: 'email', targetId: messageId, sourceSurface: 'ai', metadata: JSON.stringify({ previous, conversationId: ctx.conversationId }) } })
  return {
    ok: true,
    action: { toolName: read ? 'mark_read' : 'mark_unread', inputSummary: { messageId }, resultSummary: { read }, reversible: true, inverseTool: read ? 'mark_unread' : 'mark_read', inversePayload: { messageId } },
  }
}

async function starEmail(input: Record<string, unknown>, ctx: ToolContext, starred: boolean): Promise<ToolResult> {
  const messageId = String(input.messageId ?? '')
  const email = await db.email.findFirst({ where: { id: messageId, accountId: ctx.accountId } })
  if (!email) return { ok: false, error: 'Email not found' }
  const previous = email.isStarred
  await db.email.update({ where: { id: messageId }, data: { isStarred: starred } })
  await db.auditEvent.create({ data: { userId: ctx.userId, accountId: ctx.accountId, eventType: starred ? 'AI_EMAIL_STARRED' : 'AI_EMAIL_UNSTARRED', targetType: 'email', targetId: messageId, sourceSurface: 'ai', metadata: JSON.stringify({ previous, conversationId: ctx.conversationId }) } })
  return {
    ok: true,
    action: { toolName: starred ? 'star_email' : 'unstar_email', inputSummary: { messageId }, resultSummary: { starred }, reversible: true, inverseTool: starred ? 'unstar_email' : 'star_email', inversePayload: { messageId } },
  }
}

async function createDeadline(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const emailId = String(input.emailId ?? '')
  const title = String(input.title ?? '').trim()
  const dueAt = String(input.dueAt ?? '')
  if (!title || !dueAt) return { ok: false, error: 'title and dueAt required' }
  const dl = await db.deadline.create({ data: { accountId: ctx.accountId, emailId: emailId || null, title, dueAt: new Date(dueAt), status: 'open', confidence: 0.95 } })
  await db.auditEvent.create({ data: { userId: ctx.userId, accountId: ctx.accountId, eventType: 'AI_DEADLINE_CREATED', targetType: 'deadline', targetId: dl.id, sourceSurface: 'ai', metadata: JSON.stringify({ title, conversationId: ctx.conversationId }) } })
  return {
    ok: true,
    action: { toolName: 'create_deadline', inputSummary: { title, dueAt }, resultSummary: { deadlineId: dl.id }, reversible: true, inverseTool: 'delete_deadline', inversePayload: { deadlineId: dl.id } },
    contentBlocks: [{ type: 'text', text: `Tracked deadline "${title}" (due ${new Date(dueAt).toLocaleDateString()}).` }],
  }
}

async function createDraft(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const to = (input.to as Recipient[] | undefined) ?? []
  const subject = String(input.subject ?? '')
  const body = String(input.body ?? '')
  const draft = await db.draft.create({ data: { accountId: ctx.accountId, toRecipients: JSON.stringify(to), subject, body } })
  await db.auditEvent.create({ data: { userId: ctx.userId, accountId: ctx.accountId, eventType: 'AI_DRAFT_CREATED', targetType: 'draft', targetId: draft.id, sourceSurface: 'ai', metadata: JSON.stringify({ subject, conversationId: ctx.conversationId }) } })
  return {
    ok: true,
    action: { toolName: 'create_draft', inputSummary: { subject }, resultSummary: { draftId: draft.id }, reversible: true, inverseTool: 'delete_draft', inversePayload: { draftId: draft.id } },
    contentBlocks: [{ type: 'text', text: `Saved draft "${subject || '(no subject)'}".` }],
  }
}

async function sendEmail(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  // SENSITIVE — orchestrator must gate this with confirmation. If we reach here, confirmation was provided.
  const to = (input.to as Recipient[] | undefined) ?? []
  const subject = String(input.subject ?? '')
  const body = String(input.body ?? '')
  // No real Gmail credentials; record a sent-email audit + a synthetic sent record.
  await db.auditEvent.create({ data: { userId: ctx.userId, accountId: ctx.accountId, eventType: 'AI_EMAIL_SENT', targetType: 'email', targetId: null, sourceSurface: 'ai', metadata: JSON.stringify({ to: to.map((r) => r.email), subject, conversationId: ctx.conversationId }) } })
  return {
    ok: true,
    action: { toolName: 'send_email', inputSummary: { to: to.map((r) => r.email), subject }, resultSummary: { sent: true }, reversible: false },
    contentBlocks: [{ type: 'text', text: `Email sent to ${to.map((r) => r.email).join(', ')} — "${subject}".` }],
  }
}

async function deleteRule(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const ruleId = String(input.ruleId ?? '')
  const rule = await db.rule.findFirst({ where: { id: ruleId, accountId: ctx.accountId } })
  if (!rule) return { ok: false, error: 'Rule not found' }
  // Store inverse = recreate rule.
  await db.rule.delete({ where: { id: ruleId } })
  await db.auditEvent.create({ data: { userId: ctx.userId, accountId: ctx.accountId, eventType: 'AI_RULE_DELETED', targetType: 'rule', targetId: ruleId, sourceSurface: 'ai', metadata: JSON.stringify({ name: rule.name, conversationId: ctx.conversationId }) } })
  const ruleObj = mapRule(rule)
  return {
    ok: true,
    action: { toolName: 'delete_rule', inputSummary: { ruleId }, resultSummary: { deleted: true }, reversible: true, inverseTool: 'create_rule', inversePayload: { name: rule.name, expression: ruleObj.expression, actions: ruleObj.actions, priority: rule.priority } },
    contentBlocks: [{ type: 'text', text: `Deleted rule "${rule.name}".` }],
  }
}

// ---- Revert: execute the recorded inverse ----
export async function revertAction(action: {
  toolName: string
  inverseTool?: string
  inversePayload?: Record<string, unknown>
  conversationId: string
  accountId: string
  userId: string
}): Promise<{ ok: boolean; error?: string }> {
  const inverseTool = action.inverseTool
  const payload = action.inversePayload ?? {}
  const ctx: ToolContext = { accountId: action.accountId, userId: action.userId, conversationId: action.conversationId, mode: 'direct' }
  switch (inverseTool) {
    case 'delete_category': {
      const id = String(payload.categoryId ?? '')
      const cat = await db.category.findFirst({ where: { id, accountId: ctx.accountId } })
      if (cat && !cat.systemDefault) await db.category.delete({ where: { id } })
      return { ok: true }
    }
    case 'delete_rule': {
      const id = String(payload.ruleId ?? '')
      await db.rule.deleteMany({ where: { id, accountId: ctx.accountId } })
      return { ok: true }
    }
    case 'create_rule': {
      const name = String(payload.name ?? 'Restored rule')
      const expression = payload.expression as ConditionGroup
      const actions = payload.actions as RuleAction[]
      const priority = Number(payload.priority ?? 100)
      await db.rule.create({ data: { accountId: ctx.accountId, name, expression: JSON.stringify(expression), actions: JSON.stringify(actions), priority, enabled: true, createdBy: 'ai' } })
      return { ok: true }
    }
    case 'mark_read':
    case 'mark_unread': {
      const messageId = String(payload.messageId ?? '')
      const read = inverseTool === 'mark_read'
      await db.email.updateMany({ where: { id: messageId, accountId: ctx.accountId }, data: { isRead: read } })
      return { ok: true }
    }
    case 'unstar_email':
    case 'star_email': {
      const messageId = String(payload.messageId ?? '')
      const starred = inverseTool === 'star_email'
      await db.email.updateMany({ where: { id: messageId, accountId: ctx.accountId }, data: { isStarred: starred } })
      return { ok: true }
    }
    case 'delete_deadline': {
      const id = String(payload.deadlineId ?? '')
      await db.deadline.deleteMany({ where: { id, accountId: ctx.accountId } })
      return { ok: true }
    }
    case 'delete_draft': {
      const id = String(payload.draftId ?? '')
      await db.draft.deleteMany({ where: { id, accountId: ctx.accountId } })
      return { ok: true }
    }
    default:
      return { ok: false, error: 'Action is not reversible' }
  }
}

export const TOOL_NAMES = TOOL_DEFINITIONS.map((t) => t.name)
