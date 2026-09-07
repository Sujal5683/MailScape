import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { readBody, ApiError, notFound } from '@/lib/api-helpers'
import type { EmailTemplate, EmailTemplateCategory } from '@/lib/types'

export const dynamic = 'force-dynamic'

const ALLOWED_CATEGORIES: ReadonlyArray<EmailTemplateCategory> = [
  'general',
  'followup',
  'request',
  'announcement',
  'custom',
]

function isCategory(v: unknown): v is EmailTemplateCategory {
  return typeof v === 'string' && (ALLOWED_CATEGORIES as ReadonlyArray<string>).includes(v)
}

function mapRow(row: {
  id: string
  accountId: string
  name: string
  subject: string
  body: string
  category: string
  createdAt: Date
  updatedAt: Date
}): EmailTemplate {
  const category: EmailTemplateCategory = isCategory(row.category) ? row.category : 'custom'
  return {
    id: row.id,
    accountId: row.accountId,
    name: row.name,
    subject: row.subject,
    body: row.body,
    category,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// Resolve an id as owned by the session account. Foreign-account templates
// are treated as "not found" (404) so we never leak existence across accounts.
async function getOwned(session: { accountId: string; userId: string }, id: string) {
  const row = await db.emailTemplate.findFirst({
    where: { id, accountId: session.accountId },
  })
  if (!row) throw notFound('Template not found')
  return row
}

// PUT /api/templates/[id] — update an existing template.
// Body: { name?, subject?, body?, category? } — all fields optional; only
// the supplied fields are written. Validates name (when supplied) +
// category (when supplied). Emits a TEMPLATE_UPDATED audit event with the
// changed-field summary.
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  const { id } = await ctx.params
  await getOwned(session, id)

  const body = await readBody<{
    name?: string
    subject?: string
    body?: string
    category?: string
  }>(req)

  if (body.name !== undefined) {
    const trimmed = body.name.trim()
    if (!trimmed) throw new ApiError('Name cannot be empty', 400)
    if (trimmed.length > 120) throw new ApiError('Name must be 120 characters or fewer', 400)
    body.name = trimmed
  }
  if (body.category !== undefined && body.category !== null && !isCategory(body.category)) {
    throw new ApiError(`Invalid category: ${String(body.category)}`, 400)
  }

  const data: Record<string, string> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.subject !== undefined) data.subject = body.subject
  if (body.body !== undefined) data.body = body.body
  if (body.category !== undefined && body.category !== null) data.category = body.category

  if (Object.keys(data).length === 0) {
    throw new ApiError('No fields supplied for update', 400)
  }

  const row = await db.emailTemplate.update({
    where: { id },
    data,
  })

  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: 'TEMPLATE_UPDATED',
      targetType: 'email_template',
      targetId: id,
      sourceSurface: 'ui',
      metadata: JSON.stringify(data),
    },
  })

  return NextResponse.json(mapRow(row))
}

// DELETE /api/templates/[id] — delete a template. Account-scoped: a template
// owned by a different account is treated as "not found" (404). Returns
// { ok: true } and emits a TEMPLATE_DELETED audit event.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  const { id } = await ctx.params

  const row = await getOwned(session, id)

  await db.emailTemplate.delete({ where: { id: row.id } })

  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: 'TEMPLATE_DELETED',
      targetType: 'email_template',
      targetId: row.id,
      sourceSurface: 'ui',
      metadata: JSON.stringify({ name: row.name, category: row.category }),
    },
  })

  return NextResponse.json({ ok: true })
}
