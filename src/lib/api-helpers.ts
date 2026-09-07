// Helpers for Next.js App Router route handlers.
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

// Wraps a handler with session resolution + error handling.
export function withSession<T>(
  fn: (req: Request, session: Awaited<ReturnType<typeof getSession>>, ctx: { params: Record<string, string> }) => Promise<T>,
): (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response> {
  return async (req, ctx) => {
    try {
      const params = await ctx.params
      const session = await getSession()
      const result = await fn(req, session, { params })
      if (result instanceof NextResponse) return result
      return NextResponse.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error'
      const status = err instanceof ApiError ? err.status : 500
      return NextResponse.json({ error: message }, { status })
    }
  }
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export function notFound(msg = 'Not found'): ApiError {
  return new ApiError(msg, 404)
}

export function badRequest(msg = 'Bad request'): ApiError {
  return new ApiError(msg, 400)
}

export async function readBody<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new ApiError('Invalid JSON body', 400)
  }
}
