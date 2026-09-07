import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { mapDeadline } from '@/lib/mappers'

export const dynamic = 'force-dynamic'

// GET /api/deadlines?status=open|done|missed|all (default: all)
export async function GET(req: Request) {
  const session = await getSession()
  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? 'all'
  const where: Record<string, unknown> = { accountId: session.accountId }
  if (status !== 'all') where.status = status
  const rows = await db.deadline.findMany({
    where,
    orderBy: { dueAt: 'asc' },
    include: { email: { select: { subject: true } }, category: true },
  })
  return NextResponse.json(rows.map(mapDeadline))
}
