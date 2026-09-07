import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/emails/[messageId]/classification — latest ClassificationResult for the email,
// with the associated category denormalized for convenient rendering.
// (ClassificationResult.categoryId is a loose String? without a Prisma relation, so we
// resolve the category in a second lightweight query when a categoryId is present.)
// Returns null when no ClassificationResult row exists.
export async function GET(_req: Request, ctx: { params: Promise<{ messageId: string }> }) {
  const session = await getSession()
  const { messageId } = await ctx.params

  const email = await db.email.findFirst({
    where: { id: messageId, accountId: session.accountId },
    select: { id: true },
  })
  if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 })

  const latest = await db.classificationResult.findFirst({
    where: { emailId: messageId },
    orderBy: { createdAt: 'desc' },
  })

  if (!latest) return NextResponse.json(null)

  // Resolve the category (account-scoped) when referenced.
  const category =
    latest.categoryId != null
      ? await db.category.findFirst({
          where: { id: latest.categoryId, accountId: session.accountId },
          select: { name: true, color: true, icon: true },
        })
      : null

  return NextResponse.json({
    id: latest.id,
    emailId: latest.emailId,
    source: latest.source,
    categoryId: latest.categoryId,
    categoryName: category?.name ?? null,
    categoryColor: category?.color ?? null,
    categoryIcon: category?.icon ?? null,
    confidence: latest.confidence ?? null,
    rationaleSummary: latest.rationaleSummary ?? null,
    createdAt: latest.createdAt.toISOString(),
  })
}
