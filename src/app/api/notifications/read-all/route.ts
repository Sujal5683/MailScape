import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/notifications/read-all
export async function POST() {
  const session = await getSession()
  await db.notification.updateMany({
    where: { accountId: session.accountId, isRead: false },
    data: { isRead: true },
  })
  return NextResponse.json({ ok: true })
}
