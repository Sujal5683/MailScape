'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CategoryAvatar } from '@/components/common/category-icon'
import { cn } from '@/lib/utils'
import { formatRelative } from '@/lib/format'
import type { CategorySummary } from '@/lib/types'
import { useDeleteCategory } from '@/hooks/use-queries'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Trash2 } from 'lucide-react'

export function CategoryCard({
  category,
  index,
  onOpen,
}: {
  category: CategorySummary
  index: number
  onOpen: () => void
}) {
  const deleteCategory = useDeleteCategory()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const isCustom = !category.systemDefault

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
      className="h-full"
    >
      <Card
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen()
          }
        }}
        aria-label={`Open ${category.name} section`}
        className="group h-full cursor-pointer gap-3 p-4 transition-colors hover:border-foreground/20 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* Header row */}
        <div className="flex items-start gap-3">
          <CategoryAvatar icon={category.icon} color={category.color} className="h-10 w-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold">{category.name}</h3>
              {category.systemDefault && (
                <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px] text-muted-foreground">
                  System
                </Badge>
              )}
            </div>
            <p className="line-clamp-2 text-xs text-muted-foreground" title={category.description ?? undefined}>
              {category.description ?? 'Uncategorized institutional source.'}
            </p>
          </div>

          {(category.unreadCount > 0 || isCustom) && (
            <div className="flex shrink-0 flex-col items-end gap-1">
              {category.unreadCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {category.unreadCount}
                </span>
              )}
              {isCustom && (
                <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-all',
                        'opacity-0 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100',
                        'group-hover:opacity-100',
                      )}
                      aria-label={`Delete ${category.name} section`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete &ldquo;{category.name}&rdquo;?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This section will be removed. Its {category.totalCount}{' '}
                        email{category.totalCount === 1 ? '' : 's'} will be moved to{' '}
                        <strong>Others</strong>. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deleteCategory.isPending}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-white hover:bg-destructive/90"
                        disabled={deleteCategory.isPending}
                        onClick={() =>
                          deleteCategory.mutate(category.id, {
                            onSuccess: () => setConfirmOpen(false),
                          })
                        }
                      >
                        {deleteCategory.isPending ? 'Deleting…' : 'Delete section'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-baseline gap-1">
            <span className="font-semibold text-foreground">{category.totalCount}</span>
            <span className="text-muted-foreground">total</span>
          </span>
          {category.importantCount > 0 && (
            <span className="flex items-baseline gap-1">
              <span className="font-semibold text-warning">{category.importantCount}</span>
              <span className="text-muted-foreground">important</span>
            </span>
          )}
          <span className="ml-auto shrink-0 truncate text-muted-foreground">
            {category.lastActivityAt ? `Active ${formatRelative(category.lastActivityAt)}` : 'No activity yet'}
          </span>
        </div>
      </Card>
    </motion.div>
  )
}
