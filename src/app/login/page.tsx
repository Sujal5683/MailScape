'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { Mail, ArrowRight, Loader2, Shield, Zap, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'

const FEATURES = [
  {
    icon: Zap,
    title: 'AI-Powered Classification',
    description: 'Emails auto-sorted into smart sections the moment they arrive.',
  },
  {
    icon: BarChart3,
    title: 'Operational Dashboard',
    description: 'Real-time KPIs, trends, and deadline tracking in one view.',
  },
  {
    icon: Shield,
    title: 'Multi-Account Inbox',
    description: 'Connect multiple Google accounts into a single unified inbox.',
  },
]

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await signIn('google', { callbackUrl: '/' })
    } catch {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel — branding */}
      <div className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex lg:w-1/2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/10">
            <Mail className="h-5 w-5" />
          </div>
          <span className="text-xl font-semibold tracking-tight">MailScape</span>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight leading-tight">
              Your inbox,
              <br />
              intelligently organized.
            </h1>
            <p className="text-lg text-primary-foreground/80 leading-relaxed">
              Connect your Google account and let MailScape automatically classify, prioritize, and
              surface the emails that matter most.
            </p>
          </div>

          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-primary-foreground/70">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-primary-foreground/50">
          MailScape — Institutional Email Intelligence
        </p>
      </div>

      {/* Right panel — sign-in form */}
      <div className="flex flex-1 flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex flex-col items-center gap-3 lg:hidden">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Mail className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">MailScape</h1>
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-2xl font-semibold tracking-tight">Sign in to your account</h2>
            <p className="text-sm text-muted-foreground">
              Use your Google account to access your intelligent inbox.
            </p>
          </div>

          <div className="space-y-4">
            <Button
              size="lg"
              className="w-full gap-3 text-base"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              {isLoading ? 'Redirecting to Google…' : 'Continue with Google'}
              {!isLoading && <ArrowRight className="ml-auto h-4 w-4 opacity-50" />}
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            By signing in you agree to allow MailScape to read and modify your Gmail inbox in
            accordance with our privacy policy. Your credentials are never stored in plain text.
          </p>
        </div>
      </div>
    </div>
  )
}
