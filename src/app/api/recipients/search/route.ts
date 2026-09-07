import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/recipients/search?q=... — autocomplete from stored senders.
export async function GET(req: Request) {
  const session = await getSession()
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').toLowerCase().trim()
  if (!q) return NextResponse.json([])
  const senders = await db.sender.findMany({
    where: {
      accountId: session.accountId,
      OR: [
        { senderEmail: { contains: q } },
        { senderName: { contains: q } },
        { domain: { contains: q } },
      ],
    },
    orderBy: { messageCount: 'desc' },
    take: 10,
    select: { senderEmail: true, senderName: true, domain: true },
  })
  return NextResponse.json(
    senders.map((s) => ({ name: s.senderName ?? undefined, email: s.senderEmail })),
  )
}
