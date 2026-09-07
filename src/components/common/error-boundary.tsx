'use client'

// ---------------------------------------------------------------------------
// ErrorBoundary + ViewErrorBoundary
//
// React error boundaries MUST be class components (the official exception to
// the function-component convention). When a child throws during render or in
// a lifecycle method, the boundary catches it and renders a fallback instead
// of unmounting the entire tree — so a failure in one view doesn't crash the
// app shell (architecture directive section 24).
//
// - ErrorBoundary: generic, reusable. Accepts a `fallback` (ReactNode or a
//   render function that receives { error, resetErrorBoundary }) and an
//   `onError` callback.
// - ViewErrorBoundary: domain-specific wrapper used in page.tsx to wrap each
//   of the 15 views with a consistent, friendly fallback UI.
// ---------------------------------------------------------------------------

import * as React from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface FallbackProps {
  error: Error | null
  resetErrorBoundary: () => void
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode | ((props: FallbackProps) => React.ReactNode)
  onError?: (error: Error, info: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // In production this would ship to a monitoring service (Sentry, etc.).
    console.error('[ErrorBoundary]', error, info.componentStack)
    this.props.onError?.(error, info)
  }

  resetErrorBoundary = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      const { fallback } = this.props
      if (typeof fallback === 'function') {
        return fallback({ error: this.state.error, resetErrorBoundary: this.resetErrorBoundary })
      }
      return fallback ?? null
    }
    return this.props.children
  }
}

export interface ViewErrorBoundaryProps {
  name: string
  children: React.ReactNode
}

export function ViewErrorBoundary({ name, children }: ViewErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={({ resetErrorBoundary }) => (
        <div
          role="alert"
          aria-live="assertive"
          className="mx-auto flex w-full max-w-md flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center sm:p-8"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" aria-hidden />
          </div>
          <h3 className="text-sm font-medium text-foreground">
            <span className="break-words">{name}</span> encountered an error
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            This section failed to load. Other parts of the app are unaffected.
          </p>
          <div className="mt-5 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="w-full sm:w-auto"
              onClick={resetErrorBoundary}
            >
              Retry
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => window.location.reload()}
            >
              Reload page
            </Button>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}

export default ErrorBoundary
