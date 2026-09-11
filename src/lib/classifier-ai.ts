/**
 * AI-powered email classifier — Gemini fallback for low-confidence emails.
 *
 * Called AFTER the deterministic heuristics in classifier.ts when confidence < 0.7.
 * Uses gemini-2.0-flash (fast, cheap) with structured JSON output.
 *
 * Design: This is purely additive — it never overwrites a high-confidence
 * deterministic result. Used only when the heuristics can't decide.
 */

import { GoogleGenAI } from '@google/genai'
import type { ClassifyInput, ClassifyResult } from '@/lib/classifier'

let _ai: GoogleGenAI | null = null

function getAI(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  return _ai
}

/**
 * Classify an email using Gemini AI.
 *
 * @param input      - Parsed email fields (from, subject, body snippet)
 * @param categories - Available category names to pick from
 * @returns A ClassifyResult with source 'ai', or null on failure
 */
export async function classifyWithGemini(
  input: ClassifyInput,
  categories: string[],
): Promise<ClassifyResult | null> {
  const ai = getAI()
  if (!ai) return null

  const prompt = `You are an email classifier. Classify the following email into EXACTLY ONE category from this list:

Categories: ${categories.join(', ')}

Email details:
- From: ${input.fromEmail} (${input.fromName ?? 'Unknown'})
- Domain: ${input.domain ?? 'unknown'}
- Subject: ${input.subject ?? '(no subject)'}
- Body preview: ${(input.bodyText ?? '').slice(0, 600)}

Rules:
- Pick the MOST specific category that fits
- Use "Others" only if no other category fits at all
- Consider the sender's domain heavily (e.g. @company.com → Work, @university.edu → Academic)
- Consider newsletter/promo patterns → Social or Updates
- "Work" = professional, business, HR, job-related
- "Social" = newsletters, communities, social media notifications
- "Updates" = receipts, order confirmations, password resets, system notifications

Respond with ONLY valid JSON (no markdown, no explanation):
{ "category": "<one of the categories>", "confidence": 0.0-1.0, "rationale": "<brief reason>" }`

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,  // Low temperature = consistent, deterministic output
      },
    })

    const text = response.text
    if (!text) return null

    const parsed = JSON.parse(text) as {
      category: string
      confidence: number
      rationale: string
    }

    // Validate the category is in the allowed list
    if (!categories.includes(parsed.category)) {
      return {
        categoryName: 'Others',
        source: 'ai',
        confidence: 0.5,
        rationale: `AI returned unknown category: ${parsed.category}`,
      }
    }

    return {
      categoryName: parsed.category,
      source: 'ai',
      confidence: Math.min(1, Math.max(0, parsed.confidence)),
      rationale: parsed.rationale ?? 'AI classification',
    }
  } catch (err) {
    console.error('[classifier-ai] Gemini classification failed:', err)
    return null
  }
}
