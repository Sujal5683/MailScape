// Shared Gemini model definitions — safe to import in both client and server code.
// The actual API calls are server-only (in src/lib/ai/llm.ts).

export interface GeminiModelInfo {
  id: string
  name: string
  description: string
}

export const GEMINI_MODELS: GeminiModelInfo[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    description: 'Latest & fastest — best for all tasks',
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    description: 'Highly capable, great for complex reasoning',
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    description: 'Balanced speed and capability',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    description: 'Fast and efficient for most tasks',
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    description: 'Lightweight — ideal for simple queries',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    description: 'Ultra-light fallback for maximum availability',
  },
]

export const DEFAULT_MODEL_ID = GEMINI_MODELS[0].id
