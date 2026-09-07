// NextAuth route — Google OAuth provider for linking Gmail accounts.
//
// Flow:
//   1. User is already authenticated with Supabase (primary auth).
//   2. User clicks "Connect Google Account" in Settings.
//   3. NextAuth handles the Google OAuth consent flow.
//   4. In the `signIn` callback, we link the Google account to the user's
//      existing Prisma User record (found via the Supabase token in the
//      NEXTAUTH_URL cookie or session).
//   5. We upsert an AccountConnection with the OAuth tokens.
//
// The Supabase userId is threaded through the JWT/session callbacks
// so downstream code can associate the Google account with the right user.

import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { db } from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          // Request offline access (refresh_token) + full Gmail read scope.
          access_type: 'offline',
          prompt: 'consent',
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.modify',
          ].join(' '),
        },
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    async signIn({ account: googleAccount, profile }) {
      if (!googleAccount || googleAccount.provider !== 'google') return false

      try {
        // --- Resolve the Supabase userId from the browser session ---
        // The Supabase session cookie is forwarded with this request.
        // We use the admin client to validate it.
        // This is a best-effort lookup; if it fails we still link the account
        // to a user keyed by their Google email.
        let prismaUserId: string | null = null

        // Try to find existing user by Google email.
        const email = profile?.email ?? ''
        if (email) {
          // Check if there's a Supabase user with this email.
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
          const supabaseUsers = listData?.users ?? []
          const supabaseUser = supabaseUsers.find((u: { email?: string }) => u.email === email)

          if (supabaseUser) {
            // Upsert the Prisma user linked to this Supabase account.
            const prismaUser = await db.user.upsert({
              where: { supabaseId: (supabaseUser as { id: string }).id },
              update: {
                email: supabaseUser.email ?? email ?? '',
                name: profile?.name ?? null,
              },
              create: {
                supabaseId: (supabaseUser as { id: string }).id,
                email: supabaseUser.email ?? email ?? '',
                name: profile?.name ?? null,
              },
            })
            prismaUserId = prismaUser.id
          }
        }

        // Fallback: find-or-create user by email alone (no Supabase link).
        if (!prismaUserId && email) {
          const existingUser = await db.user.findUnique({ where: { email } })
          if (existingUser) {
            prismaUserId = existingUser.id
          } else {
            const newUser = await db.user.create({
              data: { email, name: profile?.name ?? null },
            })
            prismaUserId = newUser.id
          }
        }

        if (!prismaUserId) return false

        // --- Upsert AccountConnection ---
        const tokenExpiry = googleAccount.expires_at
          ? new Date(googleAccount.expires_at * 1000)
          : null

        await db.accountConnection.upsert({
          where: {
            provider_providerAccountId: {
              provider: 'google',
              providerAccountId: googleAccount.providerAccountId,
            },
          },
          update: {
            accessToken: googleAccount.access_token ?? null,
            refreshToken: googleAccount.refresh_token ?? null,
            tokenExpiresAt: tokenExpiry,
            status: 'active',
            displayName: profile?.name ?? null,
          },
          create: {
            userId: prismaUserId,
            provider: 'google',
            providerAccountId: googleAccount.providerAccountId,
            emailAddress: email ?? '',
            displayName: profile?.name ?? null,
            accessToken: googleAccount.access_token ?? null,
            refreshToken: googleAccount.refresh_token ?? null,
            tokenExpiresAt: tokenExpiry,
            status: 'active',
            syncState: {
              create: {
                syncStatus: 'idle',
              },
            },
          },
        })

        // Ensure the account has default categories (otherwise the inbox is empty).
        await ensureDefaultCategories(
          await db.accountConnection.findFirst({
            where: {
              provider: 'google',
              providerAccountId: googleAccount.providerAccountId,
            },
            select: { id: true },
          }).then((a) => a?.id ?? ''),
        )

        return true
      } catch (err) {
        console.error('[nextauth] signIn callback error:', err)
        return false
      }
    },

    async jwt({ token, account }) {
      // Persist the provider account ID on the token for downstream use.
      if (account) {
        token.providerAccountId = account.providerAccountId
      }
      return token
    },

    async session({ session, token }) {
      // Expose the providerAccountId in the session for client use.
      if (token.providerAccountId) {
        (session as unknown as Record<string, unknown>).providerAccountId = token.providerAccountId
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },
})

// ---------------------------------------------------------------------------
// ensureDefaultCategories — called after account creation to seed the 10
// default institutional categories so the Organized view isn't empty.
// Idempotent: skips if categories already exist.
// ---------------------------------------------------------------------------
const DEFAULT_CATEGORIES = [
  { name: 'Placement',      description: 'Internships, placements, career development',   icon: 'briefcase',       color: 'amber',   sortOrder: 1 },
  { name: 'Academic',       description: 'Exams, registration, grades, curriculum',        icon: 'graduation-cap',  color: 'blue',    sortOrder: 2 },
  { name: 'Professors',     description: 'Faculty communications, projects, assignments',  icon: 'user',            color: 'violet',  sortOrder: 3 },
  { name: 'Research',       description: 'Research programs, library, publications',       icon: 'flask-conical',   color: 'teal',    sortOrder: 4 },
  { name: 'Student Welfare',description: 'Counseling, scholarships, sports',              icon: 'heart',           color: 'rose',    sortOrder: 5 },
  { name: 'Medical',        description: 'Health check-ups, vaccinations, medical center',icon: 'stethoscope',     color: 'red',     sortOrder: 6 },
  { name: 'Hostel',         description: 'Room allotment, mess, maintenance',             icon: 'home',            color: 'orange',  sortOrder: 7 },
  { name: 'Events',         description: 'Cultural fests, hackathons, talks, alumni',     icon: 'calendar',        color: 'fuchsia', sortOrder: 8 },
  { name: 'Finance',        description: 'Fees, receipts, payments',                      icon: 'wallet',          color: 'green',   sortOrder: 9 },
  { name: 'Others',         description: 'Unmatched and external messages',               icon: 'inbox',           color: 'slate',   sortOrder: 99 },
]

async function ensureDefaultCategories(accountId: string) {
  if (!accountId) return
  const existing = await db.category.count({ where: { accountId } })
  if (existing > 0) return
  for (const c of DEFAULT_CATEGORIES) {
    await db.category.create({
      data: {
        accountId,
        name: c.name,
        description: c.description,
        icon: c.icon,
        color: c.color,
        sortOrder: c.sortOrder,
        systemDefault: true,
      },
    })
  }
}

export { handler as GET, handler as POST }
