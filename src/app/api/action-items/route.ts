import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapActionItem } from '@/lib/mappers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  const rows = await db.actionItem.findMany({
    where: { accountId: session.accountId, status: 'open' },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(rows.map(mapActionItem))
}
