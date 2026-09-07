// LLM wrapper using Google Gemini API (@google/genai SDK).
// Backend-only — credentials never reach the client bundle.
// Uses GEMINI_API_KEY from environment.
// Automatic fallback through the model chain when rate-limited or unavailable.

import { GoogleGenAI } from '@google/genai'
import {
  GEMINI_MODELS,
  DEFAULT_MODEL_ID,
  type GeminiModelInfo,
} from './models'

export { GEMINI_MODELS, DEFAULT_MODEL_ID, type GeminiModelInfo }

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
// Rate-limit / unavailable errors that trigger model fallback
// ---------------------------------------------------------------------------

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
  model?: string
  json?: boolean   // true → use responseMimeType: 'application/json' for reliable JSON output
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

  // Collect ALL system messages and join them as one systemInstruction.
  // Previously only the first system message was used — this caused the
  // orchestrator's JSON schema instruction (the 3rd system message) to be
  // silently dropped, making the model return free text instead of JSON.
  const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content)
  const systemInstruction = systemParts.length > 0 ? systemParts.join('\n\n') : undefined

  const conversationTurns = messages.filter((m) => m.role !== 'system')
  const contents = conversationTurns.map((m) => ({
    role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: m.content }],
  }))

  const response = await ai.models.generateContent({
    model: modelId,
    contents,
    config: {
      ...(systemInstruction ? { systemInstruction } : {}),
      ...(opts?.json ? { responseMimeType: 'application/json' } : {}),
      ...(opts?.thinking
        ? { thinkingConfig: { thinkingBudget: 8192 } }
        : {}),
    },
  })

  return response.text ?? ''
}

// ---------------------------------------------------------------------------
// chat() — plain text completion with automatic model fallback
// ---------------------------------------------------------------------------

export async function chat(messages: ChatTurn[], opts?: ChatOptions): Promise<string> {
  const preferredId = opts?.model ?? DEFAULT_MODEL_ID
  const chain = [
    preferredId,
    ...GEMINI_MODELS.map((m) => m.id).filter((id) => id !== preferredId),
  ]

  let lastError: unknown
  for (const modelId of chain) {
    try {
      return await attemptChat(modelId, messages, opts)
    } catch (err) {
      lastError = err
      if (isFallbackError(err)) {
        console.warn(`[llm] ${modelId} unavailable, trying next model…`)
        continue
      }
      throw err
    }
  }

  throw lastError ?? new Error('All Gemini models exhausted')
}

// ---------------------------------------------------------------------------
// chatJson<T>() — JSON-mode completion
// Always uses responseMimeType: 'application/json' so the model is constrained
// to return valid JSON — no markdown fences, no commentary.
// ---------------------------------------------------------------------------

export async function chatJson<T = unknown>(
  messages: ChatTurn[],
  opts?: Omit<ChatOptions, 'json'>,
): Promise<T> {
  const text = await chat(messages, { ...opts, json: true })
  return extractJson<T>(text)
}

// ---------------------------------------------------------------------------
// extractJson<T>() — parse JSON from model output robustly
// ---------------------------------------------------------------------------

export function extractJson<T>(text: string): T {
  // 1. Direct parse (works when responseMimeType: 'application/json' is set).
  try { return JSON.parse(text) as T } catch { /* continue */ }

  // 2. Fenced ```json block.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    try { return JSON.parse(fenced[1]) as T } catch { /* continue */ }
  }

  // 3. First { ... } block.
  const obj = text.match(/\{[\s\S]*\}/)
  if (obj) {
    try { return JSON.parse(obj[0]) as T } catch { /* continue */ }
  }

  // 4. First [ ... ] block.
  const arr = text.match(/\[[\s\S]*\]/)
  if (arr) {
    try { return JSON.parse(arr[0]) as T } catch { /* continue */ }
  }

  throw new Error('Model did not return valid JSON')
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

  throw new Error('All models exhausted for vision')
}
