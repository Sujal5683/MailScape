// Next.js middleware — authentication guard.
//
// Protects all app routes. Unauthenticated users are redirected to /login.
// The middleware checks for the Supabase session cookie; if it's absent,
// the user hasn't completed auth and gets sent to the login page.
//
// Public routes (no auth required):
//   - /login          — the sign-in page itself
//   - /api/auth/**    — NextAuth OAuth endpoints (must be public)
//   - /_next/**       — Next.js static assets
//   - /favicon.ico    — browser favicon

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that do NOT require authentication.
const PUBLIC_PATHS = ['/login', '/api/auth']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?'))
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow public routes and Next.js internals.
  if (
    isPublicPath(pathname) ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check for a Supabase session token.
  // The Supabase SSR client stores the access token in a cookie named
  // `sb-<project-ref>-auth-token` or `sb-access-token`. We check for any
  // cookie that contains 'supabase' and 'token' in its name.
  const cookies = request.cookies
  const hasSupabaseToken = cookies.getAll().some(
    (c) => c.name.includes('supabase') && (c.name.includes('token') || c.name.includes('auth')),
  )

  // Also check for a NextAuth session cookie (populated after Google OAuth).
  const hasNextAuthToken =
    cookies.has('next-auth.session-token') ||
    cookies.has('__Secure-next-auth.session-token')

  // If authenticated via either provider, allow the request.
  if (hasSupabaseToken || hasNextAuthToken) {
    return NextResponse.next()
  }

  // Unauthenticated — redirect to the login page, preserving the original URL
  // as the `callbackUrl` so the user is sent back after signing in.
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('callbackUrl', request.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Run the middleware on all routes except static files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
