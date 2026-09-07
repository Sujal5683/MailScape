import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { readBody, ApiError } from '@/lib/api-helpers'
import type { EmailTemplate, EmailTemplateCategory } from '@/lib/types'

export const dynamic = 'force-dynamic'

// Allowed category values — anything else is rejected. Mirrors the
// EmailTemplateCategory union so the persisted value is always one of the
// 5 known categories.
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
  // Coerce to the union; defaults to 'custom' if the DB ever holds an
  // unexpected value (defensive — the API never allows that today).
  const category: EmailTemplateCategory = isCategory(row.category)
    ? row.category
    : 'custom'
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

// GET /api/templates — list email templates for the session account.
// Optional ?category=<value> filter restricts to a single category; omit
// for all categories. Newest first (updatedAt desc). Empty list when none
// saved — the panel renders an empty state either way.
export async function GET(req: Request) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(req.url)
  const categoryParam = url.searchParams.get('category')

  const where: { accountId: string; category?: string } = { accountId: session.accountId }
  if (categoryParam) {
    if (!isCategory(categoryParam)) {
      throw new ApiError(`Invalid category: ${categoryParam}`, 400)
    }
    where.category = categoryParam
  }

  const rows = await db.emailTemplate.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(rows.map(mapRow))
}

// POST /api/templates — create a new template.
// Body: { name: string, subject?: string, body?: string, category?: string }
// Returns the created row (mapped to EmailTemplate DTO). Validates name +
// (when supplied) category; rejects empty/over-long names. Emits a
// TEMPLATE_CREATED audit event.
export async function POST(req: Request) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await readBody<{
    name?: string
    subject?: string
    body?: string
    category?: string
  }>(req)

  const name = body.name?.trim()
  if (!name) throw new ApiError('Name is required', 400)
  if (name.length > 120) throw new ApiError('Name must be 120 characters or fewer', 400)

  if (body.category !== undefined && body.category !== null && !isCategory(body.category)) {
    throw new ApiError(`Invalid category: ${String(body.category)}`, 400)
  }

  const category: EmailTemplateCategory =
    body.category !== undefined && body.category !== null && isCategory(body.category)
      ? body.category
      : 'general'

  const subject = body.subject ?? ''
  const bodyText = body.body ?? ''

  const row = await db.emailTemplate.create({
    data: {
      accountId: session.accountId,
      name,
      subject,
      body: bodyText,
      category,
    },
  })

  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: 'TEMPLATE_CREATED',
      targetType: 'email_template',
      targetId: row.id,
      sourceSurface: 'ui',
      metadata: JSON.stringify({ name, category }),
    },
  })

  return NextResponse.json(mapRow(row))
}
