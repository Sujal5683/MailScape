'use client'

import { cn } from '@/lib/utils'
import { type LucideIcon, Inbox, AlertCircle, SearchX } from 'lucide-react'

// ---------------------------------------------------------------------------
// Optional inline SVG illustrations for EmptyState.
//
// Each illustration is a minimal 80x80 line drawing using `currentColor`
// (which inherits text-muted-foreground from the parent) plus a single
// `text-primary` accent (the active stroke/fill on one feature). They are
// intentionally restrained — 1-2 colors, no decorative chrome.
// ---------------------------------------------------------------------------

export type EmptyIllustrationVariant =
  | 'inbox'
  | 'search'
  | 'notifications'
  | 'deadlines'
  | 'generic'

function EmptyIllustration({
  variant,
  className,
}: {
  variant: EmptyIllustrationVariant
  className?: string
}) {
  // Shared svg props. The wrapper <svg> inherits text-muted-foreground so
  // every stroke=currentColor element uses the muted color by default; the
  // className="text-primary" on an inner element flips currentColor to the
  // primary accent for just that element.
  const common = {
    viewBox: '0 0 80 80',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2 as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className: cn('h-20 w-20 text-muted-foreground', className),
  }

  switch (variant) {
    case 'inbox':
      return (
        <svg {...common}>
          {/* envelope */}
          <rect x="14" y="18" width="52" height="28" rx="3" />
          <path d="M14 24l26 18 26-18" />
          {/* tray */}
          <path d="M10 46h18l4 8h16l4-8h18" />
          {/* primary accent: seal on the envelope flap */}
          <circle cx="40" cy="38" r="2.5" className="text-primary" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'search':
      return (
        <svg {...common}>
          {/* magnifying glass */}
          <circle cx="34" cy="34" r="16" />
          <line x1="46" y1="46" x2="60" y2="60" />
          {/* primary accent: result lines inside the lens */}
          <line x1="26" y1="33" x2="42" y2="33" className="text-primary" />
          <line x1="26" y1="40" x2="38" y2="40" className="text-primary" />
        </svg>
      )
    case 'notifications':
      return (
        <svg {...common}>
          {/* bell body */}
          <path d="M22 50V36a18 18 0 0136 0v14l4 8H18z" />
          {/* clapper */}
          <path d="M34 58a6 6 0 0012 0" />
          {/* primary accent: notification dot */}
          <circle cx="56" cy="26" r="5" className="text-primary" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'deadlines':
      return (
        <svg {...common}>
          {/* calendar frame */}
          <rect x="14" y="20" width="52" height="46" rx="4" />
          <line x1="14" y1="32" x2="66" y2="32" />
          {/* hanging pins */}
          <line x1="26" y1="14" x2="26" y2="24" />
          <line x1="54" y1="14" x2="54" y2="24" />
          {/* primary accent: highlighted date */}
          <rect x="34" y="44" width="12" height="10" rx="2" className="text-primary" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'generic':
    default:
      return (
        <svg {...common}>
          {/* circle outline */}
          <circle cx="40" cy="40" r="22" />
          {/* three dots inside — the middle one is the primary accent */}
          <circle cx="32" cy="40" r="2" fill="currentColor" stroke="none" />
          <circle cx="40" cy="40" r="2.5" fill="currentColor" stroke="none" className="text-primary" />
          <circle cx="48" cy="40" r="2" fill="currentColor" stroke="none" />
        </svg>
      )
  }
}

export function EmptyState({
  icon: Icon = Inbox,
  illustration,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  illustration?: EmptyIllustrationVariant
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 p-10 text-center', className)}>
      {illustration ? (
        <div className="mb-4">
          <EmptyIllustration variant={illustration} />
        </div>
      ) : (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-sm font-medium">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  className,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center', className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="text-sm font-medium">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          Try again
        </button>
      )}
    </div>
  )
}

export function NoSearchResults({ query }: { query?: string }) {
  return (
    <EmptyState
      illustration="search"
      title="No matching emails"
      description={query ? `No emails matched "${query}". Try adjusting your filters.` : 'No emails matched these filters. Try widening your search.'}
    />
  )
}
