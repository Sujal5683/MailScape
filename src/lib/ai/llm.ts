// LLM wrapper using Google Gemini API (@google/genai SDK).
// Backend-only — credentials never reach the client bundle.
// Uses GEMINI_API_KEY from environment.
// Features automatic fallback through the model chain when rate-limited or unavailable.

import { GoogleGenAI } from '@google/genai'

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------

let _client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
    _client = new GoogleGenAI({ apiKey })
  }
  return _client
}

// ---------------------------------------------------------------------------
// Model registry — ordered fallback chain (fastest/newest → smaller/lite)
// ---------------------------------------------------------------------------

export interface GeminiModelInfo {
  id: string
  name: string        // Human-readable name shown in UI
  description: string
}

export const GEMINI_MODELS: GeminiModelInfo[] = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Fastest, most capable — great for all tasks',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    description: 'Highly capable, efficient for complex tasks',
  },
  {
    id: 'gemini-1.5-flash-latest',
    name: 'Gemini 1.5 Flash (Latest)',
    description: 'Latest 1.5 Flash snapshot with recent improvements',
  },
  {
    id: 'gemini-1.5-flash-8b',
    name: 'Gemini 1.5 Flash Lite',
    description: 'Lightweight, very fast — ideal for simple queries',
  },
  {
    id: 'gemini-1.0-pro',
    name: 'Gemini 1.0 Pro',
    description: 'Stable baseline model for text generation',
  },
]

// The default model to use when none is specified.
export const DEFAULT_MODEL_ID = GEMINI_MODELS[0].id

// Rate-limit / unavailable error codes that trigger fallback.
const FALLBACK_TRIGGERS = new Set([429, 503, 500, 503])
function isFallbackError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    return (
      msg.includes('429') ||
      msg.includes('rate') ||
      msg.includes('quota') ||
      msg.includes('503') ||
      msg.includes('overloaded') ||
      msg.includes('unavailable')
    )
  }
  return false
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  thinking?: boolean
  model?: string   // If provided, tries this model first then falls back
}

// ---------------------------------------------------------------------------
// Internal: single-model attempt
// ---------------------------------------------------------------------------

async function attemptChat(
  modelId: string,
  messages: ChatTurn[],
  opts?: ChatOptions,
): Promise<string> {
  const ai = getClient()

  const systemTurn = messages.find((m) => m.role === 'system')
  const conversationTurns = messages.filter((m) => m.role !== 'system')

  const contents = conversationTurns.map((m) => ({
    role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: m.content }],
  }))

  const response = await ai.models.generateContent({
    model: modelId,
    contents,
    config: {
      ...(systemTurn ? { systemInstruction: systemTurn.content } : {}),
      ...(opts?.thinking
        ? { thinkingConfig: { thinkingBudget: 1024 } }
        : {}),
    },
  })

  return response.text ?? ''
}

// ---------------------------------------------------------------------------
// chat() — plain text completion with automatic fallback
// ---------------------------------------------------------------------------

export async function chat(messages: ChatTurn[], opts?: ChatOptions): Promise<string> {
  // Build the model attempt order:
  // 1. User-specified model (if any) goes first
  // 2. Then the rest of the fallback chain in order
  const preferredId = opts?.model ?? DEFAULT_MODEL_ID
  const chain = [
    preferredId,
    ...GEMINI_MODELS.map((m) => m.id).filter((id) => id !== preferredId),
  ]

  let lastError: unknown
  for (const modelId of chain) {
    try {
      const result = await attemptChat(modelId, messages, opts)
      return result
    } catch (err) {
      lastError = err
      if (isFallbackError(err)) {
        // Rate limited or unavailable — try next model
        console.warn(`[llm] Model ${modelId} unavailable, falling back…`, err)
        continue
      }
      // Non-rate-limit error (bad request, auth, etc.) — don't retry
      throw err
    }
  }

  // All models exhausted
  throw lastError ?? new Error('All Gemini models exhausted')
}

// ---------------------------------------------------------------------------
// chatJson<T>() — JSON-mode completion
// ---------------------------------------------------------------------------

export async function chatJson<T = unknown>(
  messages: ChatTurn[],
  opts?: ChatOptions,
): Promise<T> {
  const text = await chat(messages, opts)
  return extractJson<T>(text)
}

// ---------------------------------------------------------------------------
// extractJson<T>() — parse JSON from model output robustly
// ---------------------------------------------------------------------------

export function extractJson<T>(text: string): T {
  // 1. Try direct parse.
  try { return JSON.parse(text) as T } catch { /* continue */ }

  // 2. Try fenced ```json block.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    try { return JSON.parse(fenced[1]) as T } catch { /* continue */ }
  }

  // 3. Try first { ... } block.
  const obj = text.match(/\{[\s\S]*\}/)
  if (obj) {
    try { return JSON.parse(obj[0]) as T } catch { /* continue */ }
  }

  // 4. Try first [ ... ] block.
  const arr = text.match(/\[[\s\S]*\]/)
  if (arr) {
    try { return JSON.parse(arr[0]) as T } catch { /* continue */ }
  }

  throw new Error('Gemini did not return valid JSON')
}

// ---------------------------------------------------------------------------
// describeImage() — vision / multimodal
// ---------------------------------------------------------------------------

export async function describeImage(imageBase64: string, prompt: string): Promise<string> {
  const ai = getClient()

  const base64Data = imageBase64.startsWith('data:')
    ? imageBase64.split(',')[1]
    : imageBase64

  const mimeType = imageBase64.startsWith('data:image/png')
    ? 'image/png'
    : imageBase64.startsWith('data:image/jpeg') || imageBase64.startsWith('data:image/jpg')
    ? 'image/jpeg'
    : 'image/png'

  // Vision — use flash with fallback
  for (const modelId of GEMINI_MODELS.map((m) => m.id)) {
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: base64Data } },
            ],
          },
        ],
      })
      return response.text ?? ''
    } catch (err) {
      if (isFallbackError(err)) continue
      throw err
    }
  }

  throw new Error('All Gemini models exhausted for vision')
}
