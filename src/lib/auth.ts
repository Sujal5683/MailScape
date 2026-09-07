// Auth helper — Supabase-primary session resolution.
//
// Flow:
//   1. Extract the Supabase JWT from the request cookie (x-supabase-token) or
//      the `Authorization: Bearer <token>` header.
//   2. Verify the JWT via supabaseAdmin.auth.getUser().
//   3. Upsert a matching User record in Prisma keyed by supabaseId.
//   4. Fetch ALL active AccountConnection records for that userId.
//   5. Return a Session containing userId + accountIds[] (plural for multi-inbox).
//
// No seed data. No fake bypasses. If the user is not authenticated, getSession()
// throws — callers (API routes) will catch and return 401.

import { headers, cookies } from 'next/headers'
import { db } from '@/lib/db'
import { verifySupabaseToken } from '@/lib/supabase'

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
  // --- 1. Extract Supabase JWT ---
  // Try Authorization header first (API clients), then cookie (browser).
  const headerStore = await headers()
  const cookieStore = await cookies()

  let token: string | null = null

  const authHeader = headerStore.get('authorization') ?? headerStore.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  }

  if (!token) {
    // Next.js Supabase SSR puts the access token in sb-access-token cookie.
    token =
      cookieStore.get('sb-access-token')?.value ??
      cookieStore.get('supabase-auth-token')?.value ??
      null
  }

  // Fallback: try the NEXTAUTH_SECRET session cookie for NextAuth-authenticated users.
  // When GoogleProvider successfully completes, we can read the sub from the JWT.
  // This allows the app to work when user logs in via NextAuth Google flow.
  if (!token) {
    // Check for any supabase-related cookie (handles various naming schemes).
    for (const [name, value] of Object.entries(Object.fromEntries(
      cookieStore.getAll().map(c => [c.name, c.value])
    ))) {
      if (name.includes('supabase') && name.includes('token')) {
        token = value
        break
      }
    }
  }

  if (!token) {
    throw new AuthError('No authentication token found. Please log in.')
  }

  // --- 2. Verify JWT ---
  const supabaseUser = await verifySupabaseToken(token)
  if (!supabaseUser) {
    throw new AuthError('Invalid or expired session. Please log in again.')
  }

  // --- 3. Upsert User in Prisma ---
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

  // --- 4. Fetch all active AccountConnections ---
  const accounts = await db.accountConnection.findMany({
    where: { userId: user.id, status: { not: 'disconnected' } },
    select: { id: true },
  })

  const accountIds = accounts.map((a) => a.id)

  // --- 5. Return session ---
  return {
    userId: user.id,
    accountIds,
    // Backwards-compat single accessor — first account or empty string.
    accountId: accountIds[0] ?? '',
    email: user.email,
    name: user.name,
  }
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
