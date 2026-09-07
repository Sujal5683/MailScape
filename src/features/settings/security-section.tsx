'use client'

import * as React from 'react'
import {
  CheckCircle2,
  LogOut,
  ShieldCheck,
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { SettingsSection, PrincipleItem } from './section-wrapper'
import { clearLocalPrefs } from './local-prefs'
import { getSupabaseClient } from '@/lib/supabase-client'

const PRINCIPLES: { title: string; body: string }[] = [
  {
    title: 'Account-level data isolation',
    body: 'Each connected mailbox is sandboxed. Rules, categories, and history never cross account boundaries.',
  },
  {
    title: 'HTML email sanitization (XSS protection)',
    body: 'Inbound HTML is parsed and stripped of scripts, event handlers, and dangerous markup before it reaches the reader.',
  },
  {
    title: 'Prompt-injection defense',
    body: 'Email content is injected into AI context as quoted, untrusted data — never as instructions the model will follow.',
  },
  {
    title: 'Sensitive-action confirmation',
    body: 'Send, delete, and disconnect require explicit confirmation. Nothing destructive happens on a single click.',
  },
  {
    title: 'No client-side secrets',
    body: 'Google and Gemini tokens live only on the server. The browser never sees or sends credentials.',
  },
  {
    title: 'Attachment safety validation',
    body: 'Attachments are typed, sized, and validated before preview. Executable and disguised payloads are blocked.',
  },
]

export function SecuritySection() {
  const { toast } = useToast()
  const [isSigningOut, setIsSigningOut] = React.useState(false)

  const onSignOut = async () => {
    setIsSigningOut(true)
    try {
      // 1. Clear local preferences from this device.
      clearLocalPrefs()

      // 2. Sign out from Supabase (invalidates the Supabase session token).
      try {
        const supabase = getSupabaseClient()
        await supabase.auth.signOut()
      } catch (err) {
        // Non-fatal: Supabase sign-out failure should not block NextAuth sign-out.
        console.warn('[auth] Supabase signOut failed (non-fatal):', err)
      }

      // 3. Sign out from NextAuth (expires the server session cookie, redirects to /login).
      await signOut({ callbackUrl: '/login' })
    } catch (err) {
      console.error('[auth] Sign out error:', err)
      toast({
        title: 'Sign out failed',
        description: 'Please try again or close your browser to end the session.',
        variant: 'destructive',
      })
      setIsSigningOut(false)
    }
  }

  return (
    <SettingsSection
      icon={ShieldCheck}
      title="Security"
      description="The guarantees Institutional Email Intelligence enforces across every account and view."
    >
      <ul className="flex flex-col gap-4">
        {PRINCIPLES.map((p) => (
          <PrincipleItem key={p.title} icon={CheckCircle2} title={p.title}>
            {p.body}
          </PrincipleItem>
        ))}
      </ul>

      <Separator className="my-5 bg-border" />

      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Sign out</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Ends your Supabase session and NextAuth session, then redirects to the login page.
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2 text-destructive hover:text-destructive"
          onClick={onSignOut}
          disabled={isSigningOut}
        >
          <LogOut className="size-4" aria-hidden />
          {isSigningOut ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>
    </SettingsSection>
  )
}
