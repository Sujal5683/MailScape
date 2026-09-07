// Classification pipeline.
// Priority (per spec): manual_rules → user_overrides → sender_rules → ai → system_default (Others).
// Deterministic rules/heuristics run first; AI is invoked ONLY when explicitly requested
// for unresolved items or enrichment (never silently overriding deterministic results).

import type { ClassificationSource } from '@/lib/types'

export interface ClassifyInput {
  fromEmail: string
  fromName: string | null
  domain: string | null
  subject: string | null
  bodyText: string | null
  hasAttachment: boolean
  attachmentTypes: string[]
}

export interface ClassifyResult {
  categoryName: string
  source: ClassificationSource
  confidence: number
  rationale: string
}

// Institutional category heuristics — deterministic sender/keyword mapping.
// This emulates "trusted sender rules" + "discovered sender rules" deterministically.
const SENDER_HEURISTICS: { match: (i: ClassifyInput) => boolean; category: string; confidence: number }[] = [
  { match: (i) => i.fromEmail.includes('placement') || i.fromEmail.includes('cdc'), category: 'Placement', confidence: 0.98 },
  { match: (i) => i.fromEmail.includes('academic') || i.fromEmail.includes('registrar') || i.fromEmail.includes('examcell'), category: 'Academic', confidence: 0.97 },
  { match: (i) => i.domain === 'iitjammu.ac.in' && /@(iitjammu\.ac\.in)/.test(i.fromEmail) && !i.fromEmail.includes('@'), category: 'Professors', confidence: 0.6 },
  { match: (i) => i.fromEmail.includes('research') || i.fromEmail.includes('library') || i.fromEmail.includes('ieee'), category: 'Research', confidence: 0.95 },
  { match: (i) => i.fromEmail.includes('swelfare') || i.fromEmail.includes('scholarship') || i.fromEmail.includes('sports'), category: 'Student Welfare', confidence: 0.96 },
  { match: (i) => i.fromEmail.includes('medical'), category: 'Medical', confidence: 0.99 },
  { match: (i) => i.fromEmail.includes('hostel') || i.fromEmail.includes('mess'), category: 'Hostel', confidence: 0.97 },
  { match: (i) => i.fromEmail.includes('cultural') || i.fromEmail.includes('techboard') || i.fromEmail.includes('alumni') || i.fromEmail.includes('events'), category: 'Events', confidence: 0.95 },
  { match: (i) => i.fromEmail.includes('finance'), category: 'Finance', confidence: 0.99 },
]

const KEYWORD_HEURISTICS: { keywords: string[]; category: string; confidence: number }[] = [
  { keywords: ['internship', 'placement', 'pre-placement', 'shortlist', 'company-wise'], category: 'Placement', confidence: 0.78 },
  { keywords: ['examination', 'mid-sem', 'grade card', 'course registration', 'elective', 're-evaluation'], category: 'Academic', confidence: 0.75 },
  { keywords: ['project', 'literature review', 'assignment', 'recommendation letter'], category: 'Professors', confidence: 0.7 },
  { keywords: ['srip', 'research proposal', 'inter-library', 'paper presentation'], category: 'Research', confidence: 0.8 },
  { keywords: ['counseling', 'mental health', 'scholarship', 'tournament'], category: 'Student Welfare', confidence: 0.8 },
  { keywords: ['vaccination', 'health check-up', 'medical'], category: 'Medical', confidence: 0.85 },
  { keywords: ['room allotment', 'mess menu', 'hostel maintenance'], category: 'Hostel', confidence: 0.85 },
  { keywords: ['cultural fest', 'hackathon', 'alumni talk', 'fest'], category: 'Events', confidence: 0.82 },
  { keywords: ['fee reminder', 'mess fee', 'hostel fee', 'receipt'], category: 'Finance', confidence: 0.85 },
]

// Professor detection: institutional domain + personal-looking email (not a known office).
const OFFICE_PREFIXES = ['placement', 'academic', 'registrar', 'examcell', 'research', 'library', 'ieee', 'swelfare', 'scholarship', 'sports', 'medical', 'hostel', 'mess', 'cultural', 'techboard', 'alumni', 'finance', 'events', 'dean', 'office', 'no-reply', 'noreply', 'admin', 'support', 'admissions']

export function classifyByEmail(input: ClassifyInput): ClassifyResult {
  const domain = input.domain ?? ''
  const isInstitutional = domain === 'iitjammu.ac.in'

  // 1. Trusted sender heuristics (sender_rule).
  for (const h of SENDER_HEURISTICS) {
    if (h.match(input)) {
      return {
        categoryName: h.category,
        source: 'sender_rule',
        confidence: h.confidence,
        rationale: `Sender pattern matched (${input.fromEmail})`,
      }
    }
  }

  // 2. Professor detection — institutional personal email not matching an office.
  if (isInstitutional) {
    const localPart = input.fromEmail.split('@')[0].toLowerCase()
    const isOffice = OFFICE_PREFIXES.some((p) => localPart.includes(p))
    if (!isOffice && localPart.length > 0) {
      return {
        categoryName: 'Professors',
        source: 'sender_rule',
        confidence: 0.82,
        rationale: 'Institutional personal sender detected',
      }
    }
  }

  // 3. Keyword heuristics on subject + body.
  const haystack = `${input.subject ?? ''} ${input.bodyText ?? ''}`.toLowerCase()
  const hits: Record<string, number> = {}
  for (const h of KEYWORD_HEURISTICS) {
    const score = h.keywords.filter((k) => haystack.includes(k)).length
    if (score > 0) hits[h.category] = Math.max(hits[h.category] ?? 0, h.confidence * (0.6 + 0.4 * Math.min(score / 2, 1)))
  }
  const best = Object.entries(hits).sort((a, b) => b[1] - a[1])[0]
  if (best && best[1] >= 0.7) {
    return {
      categoryName: best[0],
      source: 'system_default',
      confidence: best[1],
      rationale: `Keyword match (${best[0]})`,
    }
  }

  // 4. Fallback — Others.
  return {
    categoryName: 'Others',
    source: 'system_default',
    confidence: 0.5,
    rationale: 'No deterministic match; routed to Others',
  }
}

// Deadline extraction — deterministic regex-based, no AI call needed for common patterns.
export interface ExtractedDeadline {
  title: string
  dueAt: string | null
  confidence: number
}

export function extractDeadlines(subject: string | null, bodyText: string | null): ExtractedDeadline[] {
  const out: ExtractedDeadline[] = []
  const text = `${subject ?? ''}\n${bodyText ?? ''}`
  const now = new Date()

  // "Deadline to apply: 25th of this month, 11:59 PM"
  const deadlineMatches = text.match(/(?:deadline|due|last date|submit by|register by|closes? on|expires in)[^.\n]{0,80}/gi)
  if (deadlineMatches) {
    for (const dm of deadlineMatches.slice(0, 3)) {
      const due = parseRelativeDate(dm, now)
      out.push({ title: dm.trim().slice(0, 120), dueAt: due, confidence: 0.7 })
    }
  }

  // Explicit date patterns near "by"/"on".
  const byDate = text.match(/by\s+(this\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi)
  if (byDate) {
    for (const bd of byDate.slice(0, 2)) {
      const due = parseRelativeDate(bd, now)
      out.push({ title: subject ?? bd, dueAt: due, confidence: 0.65 })
    }
  }
  return out.slice(0, 4)
}

function parseRelativeDate(text: string, now: Date): string | null {
  const lower = text.toLowerCase()
  const t = new Date(now)
  if (lower.includes('today')) {
    // today
  } else if (lower.includes('tomorrow')) {
    t.setDate(t.getDate() + 1)
  } else if (lower.includes('monday')) t.setDate(t.getDate() + ((1 + 7 - t.getDay()) % 7 || 7))
  else if (lower.includes('tuesday')) t.setDate(t.getDate() + ((2 + 7 - t.getDay()) % 7 || 7))
  else if (lower.includes('wednesday')) t.setDate(t.getDate() + ((3 + 7 - t.getDay()) % 7 || 7))
  else if (lower.includes('thursday')) t.setDate(t.getDate() + ((4 + 7 - t.getDay()) % 7 || 7))
  else if (lower.includes('friday')) t.setDate(t.getDate() + ((5 + 7 - t.getDay()) % 7 || 7))
  else if (lower.includes('saturday')) t.setDate(t.getDate() + ((6 + 7 - t.getDay()) % 7 || 7))
  else if (lower.includes('sunday')) t.setDate(t.getDate() + ((0 + 7 - t.getDay()) % 7 || 7))
  else if (lower.match(/\b(\d{1,2})(st|nd|rd|th)?\s+of\s+this\s+month/)) {
    const day = parseInt(lower.match(/\b(\d{1,2})/)?.[1] ?? '0', 10)
    if (day) t.setDate(day)
  } else if (lower.includes('end of this month')) {
    t.setMonth(t.getMonth() + 1, 0)
  } else if (lower.match(/in\s+(\d+)\s+days?/)) {
    const n = parseInt(lower.match(/in\s+(\d+)\s+days?/)?.[1] ?? '0', 10)
    t.setDate(t.getDate() + n)
  } else if (lower.includes('in 10 days')) {
    t.setDate(t.getDate() + 10)
  } else {
    return null
  }
  if (lower.includes('11:59')) t.setHours(23, 59, 0, 0)
  return t.toISOString()
}

// Action item extraction — deterministic patterns for common institutional action verbs.
export interface ExtractedActionItem {
  title: string
  dueAt: string | null
}

export function extractActionItems(subject: string | null, bodyText: string | null): ExtractedActionItem[] {
  const out: ExtractedActionItem[] = []
  const text = `${subject ?? ''}\n${bodyText ?? ''}`
  const now = new Date()

  // Imperative verbs near "you"/students → action item.
  const verbs = [
    { re: /\b(submit|upload|send|share|register|apply|confirm|book|attend|bring|collect|pay|complete|fill|review|check|report|RSVP)\b[^.\n]{0,80}/gi, prefix: '' },
  ]
  const seen = new Set<string>()
  for (const { re } of verbs) {
    const matches = text.match(re)
    if (matches) {
      for (const m of matches.slice(0, 3)) {
        const clean = m.trim().replace(/\s+/g, ' ').slice(0, 120)
        const key = clean.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        if (clean.length < 8) continue
        out.push({ title: clean, dueAt: parseRelativeDate(clean, now) })
      }
    }
  }
  return out.slice(0, 3)
}
