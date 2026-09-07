import { cn } from '@/lib/utils'

/**
 * A sleek, thin separation line with a gradient fade.
 * Use between major sections/cards for a premium, modern look.
 */
export function SleekSeparator({ className }: { className?: string }) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={cn(
        'h-px w-full bg-gradient-to-r from-transparent via-border to-transparent opacity-60',
        className,
      )}
    />
  )
}
