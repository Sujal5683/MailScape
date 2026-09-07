// LLM wrapper using Google Gemini API (@google/genai SDK).
// Backend-only — credentials never reach the client bundle.
// Uses GEMINI_API_KEY from environment.

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

// Model to use — gemini-2.0-flash is fast and cost-effective for structured tasks.
// Upgrade to gemini-2.5-pro for complex reasoning if needed.
const DEFAULT_MODEL = 'gemini-2.0-flash'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// ---------------------------------------------------------------------------
// chat() — plain text completion
// ---------------------------------------------------------------------------

export async function chat(
  messages: ChatTurn[],
  opts?: { thinking?: boolean; model?: string },
): Promise<string> {
  const ai = getClient()
  const model = opts?.model ?? DEFAULT_MODEL

  // Separate the system prompt from the conversation turns.
  const systemTurn = messages.find((m) => m.role === 'system')
  const conversationTurns = messages.filter((m) => m.role !== 'system')

  // Map our ChatTurn format → Gemini content format.
  const contents = conversationTurns.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      ...(systemTurn ? { systemInstruction: systemTurn.content } : {}),
      // Enable thinking for complex reasoning tasks.
      ...(opts?.thinking
        ? { thinkingConfig: { thinkingBudget: 1024 } }
        : {}),
    },
  })

  return response.text ?? ''
}

// ---------------------------------------------------------------------------
// chatJson<T>() — JSON-mode completion
// ---------------------------------------------------------------------------

export async function chatJson<T = unknown>(
  messages: ChatTurn[],
  opts?: { thinking?: boolean },
): Promise<T> {
  const text = await chat(messages, opts)
  return extractJson<T>(text)
}

// ---------------------------------------------------------------------------
// extractJson<T>() — parse JSON from model output robustly
// ---------------------------------------------------------------------------

export function extractJson<T>(text: string): T {
  // 1. Try direct parse.
  try {
    return JSON.parse(text) as T
  } catch { /* continue */ }

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

  // Strip the data URI prefix if present.
  const base64Data = imageBase64.startsWith('data:')
    ? imageBase64.split(',')[1]
    : imageBase64

  const mimeType = imageBase64.startsWith('data:image/png')
    ? 'image/png'
    : imageBase64.startsWith('data:image/jpeg') || imageBase64.startsWith('data:image/jpg')
    ? 'image/jpeg'
    : 'image/png'

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
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
}
