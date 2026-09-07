// GET /api/ai/models — returns the list of available Gemini models for the UI picker.
import { NextResponse } from 'next/server'
import { GEMINI_MODELS } from '@/lib/ai/llm'

export const dynamic = 'force-static'

export async function GET() {
  return NextResponse.json({ models: GEMINI_MODELS })
}
