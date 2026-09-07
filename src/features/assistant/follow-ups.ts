// Deterministic generator for follow-up prompt suggestions.
//
// Given an assistant message's content blocks + sources, returns exactly 3
// suggested follow-up prompts (in priority order). The generator is pure:
// same inputs → same outputs. No network, no storage.

import type { AssistantContentBlock, SourceRef } from '@/lib/types'

const GENERIC_FALLBACKS = [
  'Summarize in one sentence',
  'Show me the most important part',
  'What should I do next?',
  'Explain this in plain language',
]

function firstNonEmpty<T>(arr: T[] | undefined | null, n = 1): T[] {
  if (!arr || arr.length === 0) return []
  return arr.slice(0, n)
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n - 1).trimEnd() + '…'
}

export function generateFollowUps(
  blocks: AssistantContentBlock[],
  sources: SourceRef[] = [],
): string[] {
  const out: string[] = []

  // 1. If sources exist, suggest "Tell me more about [first source subject]".
  if (sources.length > 0) {
    const first = sources[0]
    const subject = first.subject ?? first.fromEmail
    if (subject) {
      out.push(`Tell me more about "${truncate(subject, 48)}"`)
    }
  }

  // 2. Scan content blocks for specific, high-signal suggestions.
  for (const b of blocks) {
    if (out.length >= 3) break
    if (b.type === 'deadlines' && b.deadlines && b.deadlines.length > 0) {
      out.push('Add these to my deadlines')
      break
    }
    if (b.type === 'action_items' && b.actionItems && b.actionItems.length > 0) {
      out.push('Turn these into tasks')
      break
    }
    if (b.type === 'table' && b.rows && b.rows.length > 0) {
      out.push('Export this as a summary')
      break
    }
    if (b.type === 'cards' && b.cards && b.cards.length > 0) {
      out.push('Explain these numbers')
      break
    }
    if (b.type === 'sources' && b.sources && b.sources.length > 0) {
      const first = b.sources[0]
      const subject = first.subject ?? first.fromEmail
      if (subject) {
        out.push(`Tell me more about "${truncate(subject, 48)}"`)
      }
      break
    }
  }

  // 3. If we still have room, add the generic "summarize" suggestion.
  if (out.length < 3) {
    out.push(GENERIC_FALLBACKS[0])
  }

  // 4. Top up with remaining generic fallbacks (capped at 3 total).
  let i = 1
  while (out.length < 3 && i < GENERIC_FALLBACKS.length) {
    const candidate = GENERIC_FALLBACKS[i]
    if (!out.includes(candidate)) out.push(candidate)
    i++
  }

  // Defensive: ensure exactly 3 (or fewer if blocks/sources were totally empty).
  return firstNonEmpty(out, 3)
}
