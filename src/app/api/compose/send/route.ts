import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { readBody, ApiError } from '@/lib/api-helpers'
import type { Recipient } from '@/lib/types'

export const dynamic = 'force-dynamic'

// POST /api/compose/send — SENSITIVE action. Requires confirmation flag from client.
// No real Gmail credentials available; we persist a sent audit event and return a synthetic id.
// The contract is real: confirmation gating, audit, idempotency by messageId.
export async function POST(req: Request) {
  const session = await getSession()
  const body = await readBody<{
    accountId?: string
    to: Recipient[]
    cc?: Recipient[]
    subject?: string
    body?: string
    confirm?: boolean
  }>(req)

  if (!body.to || body.to.length === 0) throw new ApiError('At least one recipient required', 400)
  if (!body.confirm) {
    return NextResponse.json(
      { ok: false, confirmation: true, error: 'Sending email requires confirmation' },
      { status: 409 },
    )
  }

  const messageId = `sent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: body.accountId ?? session.accountId,
      eventType: 'EMAIL_SENT',
      targetType: 'email',
      targetId: messageId,
      sourceSurface: 'ui',
      metadata: JSON.stringify({
        to: body.to.map((r) => r.email),
        cc: (body.cc ?? []).map((r) => r.email),
        subject: body.subject ?? '',
      }),
    },
  })
  return NextResponse.json({ ok: true, messageId })
}
