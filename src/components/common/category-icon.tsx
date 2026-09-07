'use client'

import { createElement } from 'react'
import { iconFor, colorClass } from '@/lib/category-meta'
import { cn } from '@/lib/utils'

// Renders a category icon by name. Uses createElement with a lowercase alias
// so the icon lookup is a runtime reference, not a "component created during render".
export function CategoryIcon({
  icon,
  color,
  className,
}: {
  icon: string
  color?: string
  className?: string
}) {
  const cmp = iconFor(icon)
  return createElement(cmp, {
    className: cn('h-4 w-4', color && [colorClass(color), 'cat-text'].filter(Boolean).join(' '), className),
  })
}

export function CategoryDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn('h-1.5 w-1.5 rounded-full cat-dot', colorClass(color), className)} />
}

export function CategoryAvatar({
  icon,
  color,
  className,
}: {
  icon: string
  color: string
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-center rounded-full cat-bg-soft cat-text', colorClass(color), className)}>
      <CategoryIcon icon={icon} color={color} className="h-4 w-4" />
    </div>
  )
}
