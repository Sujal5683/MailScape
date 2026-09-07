import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import type { AccountConnectionDTO } from '@/lib/types'

export const dynamic = 'force-dynamic'

function mapAccount(a: {
  id: string
  userId: string
  provider: string
  providerAccountId: string
  emailAddress: string
  displayName: string | null
  status: string
  createdAt: Date
  syncState: { syncStatus: string; lastSyncedAt: Date | null; errorMessage: string | null; retryCount: number } | null
}): AccountConnectionDTO {
  return {
    id: a.id,
    userId: a.userId,
    provider: a.provider,
    providerAccountId: a.providerAccountId,
    emailAddress: a.emailAddress,
    displayName: a.displayName,
    status: a.status,
    syncState: a.syncState
      ? {
          syncStatus: a.syncState.syncStatus as 'idle' | 'syncing' | 'error' | 'success',
          lastSyncedAt: a.syncState.lastSyncedAt?.toISOString() ?? null,
          errorMessage: a.syncState.errorMessage,
          retryCount: a.syncState.retryCount,
        }
      : null,
    createdAt: a.createdAt.toISOString(),
  }
}

// GET /api/accounts — list all connected accounts for the authenticated user.
export async function GET() {
  const session = await getSession()
  const accounts = await db.accountConnection.findMany({
    where: { userId: session.userId, status: { not: 'disconnected' } },
    include: { syncState: true },
  })
  return NextResponse.json(accounts.map(mapAccount))
}

// POST /api/accounts — connect a new Google account via NextAuth.
// The real connection is handled by NextAuth Google OAuth at /api/auth/signin/google.
// This endpoint exists so the client can trigger the flow; it returns instructions
// telling the client to redirect to NextAuth.
export async function POST() {
  // The actual account linking is done by the NextAuth signIn callback.
  // Return a 200 with the sign-in URL so the frontend can redirect.
  return NextResponse.json({
    redirectUrl: '/api/auth/signin/google',
    message: 'Redirect to Google OAuth to connect an account.',
  })
}
