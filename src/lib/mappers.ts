// Canonical API mappers — convert Prisma rows to the DTOs defined in types.ts.
// Centralized so every API route returns consistent shapes (one canonical model).

import type {
  EmailListItem,
  EmailDetail,
  EmailAttachmentMeta,
  EmailLinkMeta,
  CategoryRef,
  Recipient,
  SenderSummary,
  CategorySummary,
  Notification,
  Deadline,
  ActionItem,
  Rule,
  ConditionGroup,
  RuleAction,
} from '@/lib/types'
import type {
  Email,
  EmailAttachment,
  CategoryMembership,
  Category,
  Sender,
  Notification as NotificationRow,
  Deadline as DeadlineRow,
  ActionItem as ActionItemRow,
  Rule as RuleRow,
} from '@prisma/client'

function parseRecipients(json: string): Recipient[] {
  try {
    const arr = JSON.parse(json)
    if (!Array.isArray(arr)) return []
    return arr.map((r: unknown) => {
      if (typeof r === 'string') return { email: r }
      const obj = r as { name?: string; email: string }
      return { name: obj.name, email: obj.email }
    })
  } catch {
    return []
  }
}

function parseArray<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

export function gmailUrlFor(providerMessageId: string, providerThreadId?: string | null): string {
  // Best-effort Gmail deep link per spec: target exact message/thread when possible.
  if (providerThreadId) {
    return `https://mail.google.com/mail/u/0/#inbox/${providerThreadId}`
  }
  return `https://mail.google.com/mail/u/0/#all`
}

export function mapEmailToList(
  e: Email & {
    attachments?: EmailAttachment[]
    memberships?: (CategoryMembership & { category: Category })[]
  },
): EmailListItem {
  const categories: CategoryRef[] = (e.memberships ?? []).map((m) => ({
    id: m.category.id,
    name: m.category.name,
    color: m.category.color,
    icon: m.category.icon,
    source: m.source as CategoryRef['source'],
    confidence: m.confidence ?? undefined,
  }))
  return {
    id: e.id,
    accountId: e.accountId,
    threadId: e.threadId ?? null,
    providerMessageId: e.providerMessageId,
    providerThreadId: e.providerThreadId ?? null,
    fromName: e.fromName,
    fromEmail: e.fromEmail,
    toRecipients: parseRecipients(e.toRecipients),
    subject: e.subject,
    snippet: e.snippet,
    receivedAt: e.receivedAt ? e.receivedAt.toISOString() : null,
    hasAttachment: e.hasAttachment,
    attachmentsCount: e.attachments?.length ?? 0,
    categories,
    classificationSource: (e.classificationSource as EmailListItem['classificationSource']) ?? null,
    classificationConfidence: e.classificationConfidence ?? null,
    flags: {
      isRead: e.isRead,
      isStarred: e.isStarred,
      isImportant: e.isImportant,
      isSpam: e.isSpam,
      isDraft: e.isDraft,
      isSent: e.isSent,
      isArchived: e.isArchived,
      hasAttachment: e.hasAttachment,
    },
    labels: parseArray<string[]>(e.labels, []),
    snoozedUntil: e.snoozedUntil ? e.snoozedUntil.toISOString() : null,
  }
}

export function mapEmailToDetail(
  e: Email & {
    attachments: EmailAttachment[]
    memberships: (CategoryMembership & { category: Category })[]
  },
): EmailDetail {
  const base = mapEmailToList(e)
  const links: EmailLinkMeta[] = parseArray(e.extractedLinks, [])
  const attachments: EmailAttachmentMeta[] = e.attachments.map((a) => ({
    id: a.id,
    filename: a.filename,
    mimeType: a.mimeType,
    size: a.size,
    previewable: a.previewable,
  }))
  return {
    ...base,
    ccRecipients: parseRecipients(e.ccRecipients),
    bccRecipients: parseRecipients(e.bccRecipients),
    bodyText: e.bodyText,
    bodyHtmlSanitized: e.bodyHtmlSanitized,
    extractedLinks: links,
    attachments,
    gmailUrl: gmailUrlFor(e.providerMessageId, e.providerThreadId),
  }
}

export function mapSender(
  s: Sender & {
    emails?: ({ subject: string | null; memberships?: (CategoryMembership & { category: Category })[] })[]
  },
): SenderSummary {
  const catCounts = new Map<string, { id: string; name: string; count: number }>()
  for (const e of s.emails ?? []) {
    for (const m of e.memberships ?? []) {
      const key = m.category.id
      const existing = catCounts.get(key)
      if (existing) existing.count++
      else catCounts.set(key, { id: m.category.id, name: m.category.name, count: 1 })
    }
  }
  return {
    id: s.id,
    accountId: s.accountId,
    senderEmail: s.senderEmail,
    senderName: s.senderName,
    domain: s.domain,
    firstSeenAt: s.firstSeenAt ? s.firstSeenAt.toISOString() : null,
    lastSeenAt: s.lastSeenAt ? s.lastSeenAt.toISOString() : null,
    messageCount: s.messageCount,
    discovered: s.discovered,
    ruleStatus: s.ruleStatus as SenderSummary['ruleStatus'],
    categories: Array.from(catCounts.values()),
    recentSubjects: (s.emails ?? []).slice(0, 5).map((e) => e.subject ?? '(no subject)'),
  }
}

export function mapCategory(
  c: Category & {
    _count?: { memberships: number }
    memberships?: (CategoryMembership & { email: { isRead: boolean; isImportant: boolean; receivedAt: Date | null } })[]
  },
): CategorySummary {
  const memberships = c.memberships ?? []
  const unread = memberships.filter((m) => !m.email.isRead).length
  const important = memberships.filter((m) => m.email.isImportant).length
  const lastActivity = memberships
    .map((m) => m.email.receivedAt)
    .filter(Boolean)
    .sort((a, b) => (b!.getTime() - a!.getTime()))[0]
  return {
    id: c.id,
    accountId: c.accountId,
    name: c.name,
    description: c.description,
    systemDefault: c.systemDefault,
    sortOrder: c.sortOrder,
    color: c.color,
    icon: c.icon,
    totalCount: c._count?.memberships ?? memberships.length,
    unreadCount: unread,
    importantCount: important,
    lastActivityAt: lastActivity ? lastActivity.toISOString() : null,
  }
}

export function mapNotification(
  n: NotificationRow & { category?: Category | null },
): Notification {
  return {
    id: n.id,
    accountId: n.accountId,
    emailId: n.emailId ?? null,
    categoryId: n.categoryId ?? null,
    title: n.title,
    body: n.body,
    importance: n.importance as Notification['importance'],
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
    categoryName: n.category?.name ?? null,
    categoryColor: n.category?.color ?? null,
  }
}

export function mapDeadline(
  d: DeadlineRow & { email?: { subject: string | null } | null; category?: Category | null },
): Deadline {
  return {
    id: d.id,
    accountId: d.accountId,
    emailId: d.emailId ?? null,
    categoryId: d.categoryId ?? null,
    title: d.title,
    dueAt: d.dueAt ? d.dueAt.toISOString() : null,
    confidence: d.confidence ?? null,
    status: d.status as Deadline['status'],
    emailSubject: d.email?.subject ?? null,
    categoryName: d.category?.name ?? null,
    categoryColor: d.category?.color ?? null,
  }
}

export function mapActionItem(
  a: ActionItemRow,
): ActionItem {
  return {
    id: a.id,
    accountId: a.accountId,
    emailId: a.emailId ?? null,
    title: a.title,
    status: a.status as ActionItem['status'],
    dueAt: a.dueAt ? a.dueAt.toISOString() : null,
  }
}

export function mapRule(r: RuleRow): Rule {
  return {
    id: r.id,
    accountId: r.accountId,
    name: r.name,
    expression: parseArray<ConditionGroup>(r.expression, { combinator: 'AND', conditions: [] }),
    actions: parseArray<RuleAction[]>(r.actions, []),
    priority: r.priority,
    enabled: r.enabled,
    createdBy: r.createdBy as Rule['createdBy'],
    hitCount: r.hitCount,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}
