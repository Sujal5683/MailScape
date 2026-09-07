import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { readBody } from '@/lib/api-helpers'
import { chat } from '@/lib/ai/llm'
import type { SearchFilters } from '@/lib/types'

export const dynamic = 'force-dynamic'

// POST /api/search/natural-language — convert NL query to structured filters.
export async function POST(req: Request) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { query } = await readBody<{ query: string }>(req)
  if (!query?.trim()) return NextResponse.json({ parsed: {}, summary: 'Empty query' })

  // Provide available category names to the model for mapping.
  const categories = await db.category.findMany({
    where: { accountId: session.accountId },
    select: { id: true, name: true },
  })

  const today = new Date().toISOString().slice(0, 10)
  const system = `You convert a natural-language email search into structured filters.
Today is ${today}.
Available categories: ${categories.map((c) => `${c.name}(${c.id})`).join(', ')}.
Return ONLY JSON matching this shape:
{
  "query": "free text keywords" | null,
  "sender": "sender substring" | null,
  "categoryIds": ["id"] | [],
  "isRead": true|false | null,
  "isStarred": true|false | null,
  "isImportant": true|false | null,
  "hasAttachment": true|false | null,
  "attachmentType": "pdf"|"image"|"doc" | null,
  "dateFrom": "YYYY-MM-DD" | null,
  "dateTo": "YYYY-MM-DD" | null,
  "timeFrom": "HH:MM" | null,
  "timeTo": "HH:MM" | null,
  "labels": ["label"] | [],
  "summary": "one short human-readable sentence describing the parsed filters"
}
- For "last week"/"last 7 days", set dateFrom to 7 days ago.
- For "today", set dateFrom and dateTo to today.
- For "yesterday", set dateFrom and dateTo to yesterday.
- For "this month", set dateFrom to first day of this month.
- If a category is mentioned, map it to the closest category id. Empty/unknown → empty array.
- Use null for filters that don't apply. Do not invent ids.`

  let parsed: Partial<SearchFilters> = {}
  let summary = query
  try {
    const text = await chat([
      { role: 'system', content: system },
      { role: 'user', content: query },
    ], { thinking: false })
    const obj = JSON.parse(text) as Partial<SearchFilters> & { summary?: string }
    summary = obj.summary ?? query
    parsed = obj
    delete (parsed as { summary?: string }).summary
  } catch {
    // Fallback: simple keyword.
    parsed = { query }
  }

  // Sanitize: only allow known category ids.
  if (parsed.categoryIds) {
    const valid = new Set(categories.map((c) => c.id))
    parsed.categoryIds = parsed.categoryIds.filter((id) => valid.has(id))
  }

  return NextResponse.json({ parsed, summary })
}
