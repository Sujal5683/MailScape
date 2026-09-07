import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { readBody, ApiError } from '@/lib/api-helpers'
import type { Recipient, Draft } from '@/lib/types'

export const dynamic = 'force-dynamic'

// POST /api/compose/drafts — save a draft (reversible).
export async function POST(req: Request) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await readBody<{ accountId?: string; to: Recipient[]; cc?: Recipient[]; subject?: string; body?: string }>(req)
  if (!body.to || !Array.isArray(body.to)) throw new ApiError('Recipients required', 400)
  const draft = await db.draft.create({
    data: {
      accountId: body.accountId ?? session.accountId,
      toRecipients: JSON.stringify(body.to),
      ccRecipients: JSON.stringify(body.cc ?? []),
      subject: body.subject ?? '',
      body: body.body ?? '',
    },
  })
  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: 'DRAFT_SAVED',
      targetType: 'draft',
      targetId: draft.id,
      sourceSurface: 'ui',
      metadata: JSON.stringify({ subject: draft.subject }),
    },
  })
  const out: Draft = {
    id: draft.id,
    accountId: draft.accountId,
    toRecipients: body.to,
    ccRecipients: body.cc ?? [],
    subject: draft.subject,
    body: draft.body,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
  }
  return NextResponse.json(out)
}
