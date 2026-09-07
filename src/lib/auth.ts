// Auth helper — Supabase-primary + NextAuth-secondary session resolution.
//
// Flow:
//   1. Extract the Supabase JWT from the request cookie (sb-access-token) or
//      the `Authorization: Bearer <token>` header.
//   2. Verify the JWT via supabaseAdmin.auth.getUser().
//   3. Upsert a matching User record in Prisma keyed by supabaseId.
//   4. Fetch ALL active AccountConnection records for that userId.
//   5. Return a Session containing userId + accountIds[] (plural for multi-inbox).
//
// Fallback (NextAuth Google OAuth login):
//   When the user logs in via NextAuth (Google sign-in on the login page),
//   they get a next-auth.session-token cookie but NOT a Supabase cookie.
//   In that case we fall back to reading the NextAuth JWT and resolving the
//   user from their Google email address in the Prisma DB.
//
// No seed data. No fake bypasses. If the user is not authenticated, getSession()
// throws — callers (API routes) will catch and return 401.

import { headers, cookies } from 'next/headers'
import { db } from '@/lib/db'
import { verifySupabaseToken } from '@/lib/supabase'
import { getToken } from 'next-auth/jwt'

export interface Session {
  userId: string
  accountIds: string[]   // All connected Google account IDs for this user
  // Convenience single-account accessor (first active account).
  // Kept for backwards compat with API routes not yet migrated to multi-account.
  accountId: string
  email: string
  name: string | null
}

export class AuthError extends Error {
  status = 401
  constructor(message = 'Not authenticated') {
    super(message)
    this.name = 'AuthError'
  }
}

/**
 * Resolve the current request's session.
 * Called at the top of every authenticated API route handler.
 * Throws AuthError (401) if unauthenticated.
 */
export async function getSession(): Promise<Session> {
  const headerStore = await headers()
  const cookieStore = await cookies()

  // ── 1. Try Supabase JWT ──────────────────────────────────────────────────
  let token: string | null = null

  const authHeader = headerStore.get('authorization') ?? headerStore.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  }

  if (!token) {
    token =
      cookieStore.get('sb-access-token')?.value ??
      cookieStore.get('supabase-auth-token')?.value ??
      null
  }

  if (!token) {
    // Check for any supabase-related cookie (handles various naming schemes).
    for (const c of cookieStore.getAll()) {
      if (c.name.includes('supabase') && (c.name.includes('token') || c.name.includes('auth'))) {
        token = c.value
        break
      }
    }
  }

  if (token) {
    // Verify Supabase JWT
    const supabaseUser = await verifySupabaseToken(token)
    if (!supabaseUser) {
      throw new AuthError('Invalid or expired Supabase session. Please log in again.')
    }

    // Upsert User in Prisma
    const user = await db.user.upsert({
      where: { supabaseId: supabaseUser.id },
      update: {
        email: supabaseUser.email ?? '',
        name: supabaseUser.user_metadata?.full_name ?? supabaseUser.user_metadata?.name ?? null,
        avatarUrl: supabaseUser.user_metadata?.avatar_url ?? null,
      },
      create: {
        supabaseId: supabaseUser.id,
        email: supabaseUser.email ?? '',
        name: supabaseUser.user_metadata?.full_name ?? supabaseUser.user_metadata?.name ?? null,
        avatarUrl: supabaseUser.user_metadata?.avatar_url ?? null,
      },
    })

    const accounts = await db.accountConnection.findMany({
      where: { userId: user.id, status: { not: 'disconnected' } },
      select: { id: true },
    })
    const accountIds = accounts.map((a) => a.id)

    return {
      userId: user.id,
      accountIds,
      accountId: accountIds[0] ?? '',
      email: user.email,
      name: user.name,
    }
  }

  // ── 2. Fall back to NextAuth JWT (Google OAuth login flow) ──────────────
  // When user logs in via the login page's "Continue with Google" button,
  // NextAuth handles the OAuth flow and sets a next-auth.session-token cookie.
  // We decode that token to get the user's Google email, then look them up
  // in Prisma (they were upserted in the NextAuth signIn callback).
  try {
    const nextAuthToken = await getToken({
      req: {
        cookies: Object.fromEntries(cookieStore.getAll().map((c) => [c.name, c.value])),
        headers: Object.fromEntries(headerStore.entries()),
      } as Parameters<typeof getToken>[0]['req'],
      secret: process.env.NEXTAUTH_SECRET ?? '',
    })

    if (nextAuthToken?.email) {
      const email = nextAuthToken.email as string
      const user = await db.user.findUnique({ where: { email } })
      if (user) {
        const accounts = await db.accountConnection.findMany({
          where: { userId: user.id, status: { not: 'disconnected' } },
          select: { id: true },
        })
        const accountIds = accounts.map((a) => a.id)

        return {
          userId: user.id,
          accountIds,
          accountId: accountIds[0] ?? '',
          email: user.email,
          name: user.name,
        }
      }
    }
  } catch {
    // NextAuth token decode failed — fall through to the error below.
  }

  throw new AuthError('No authentication token found. Please log in.')
}

/**
 * Convenience getter — returns the first accountId.
 * Prefer session.accountIds for multi-account-aware code.
 */
export async function getAccountId(): Promise<string> {
  const s = await getSession()
  return s.accountId
}

/**
 * Type-safe response helper for unauthenticated requests.
 * Import in API routes to avoid repetitive try/catch boilerplate.
 */
export function isAuthError(e: unknown): e is AuthError {
  return e instanceof AuthError
}
