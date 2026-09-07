// Shared Gemini model definitions — safe to import in both client and server code.
// The actual API calls are server-only (in src/lib/ai/llm.ts).

export interface GeminiModelInfo {
  id: string
  name: string
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

export const DEFAULT_MODEL_ID = GEMINI_MODELS[0].id
