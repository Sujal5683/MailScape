// Server-side Supabase client (uses SERVICE_ROLE key — never exposed to browser).
// Used in API routes and server-side auth helpers.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL ?? ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

// Warn once during cold start if creds are missing (non-fatal in dev).
if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    '[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. ' +
    'Authentication will not work until these are configured in .env',
  )
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

/**
 * Verify a Supabase JWT and return the user payload, or null if invalid.
 * Used by `getSession()` in auth.ts to validate the bearer token from
 * the browser's Supabase session.
 */
export async function verifySupabaseToken(token: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}
