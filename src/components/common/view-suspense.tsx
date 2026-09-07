'use client'

import { Suspense, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Wraps lazy-loaded views in a Suspense boundary. The default fallback is a
 * minimal centered spinner shown only during the initial chunk fetch — the
 * views themselves own their richer per-view skeletons once mounted.
 */
export function ViewSuspense({
  children,
  fallback,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  return (
    <Suspense fallback={fallback ?? <DefaultFallback />}>{children}</Suspense>
  )
}

function DefaultFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  )
}
