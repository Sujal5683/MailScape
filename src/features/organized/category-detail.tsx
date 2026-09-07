'use client'

import { useState } from 'react'
import { EmailList } from '@/features/inbox/email-list'
import { EmailDetail } from '@/features/inbox/email-detail'
import { CategoryAvatar } from '@/components/common/category-icon'
import { MasterDetailLayout } from '@/components/layout/master-detail-layout'
import type { CategorySummary } from '@/lib/types'
import { useDeleteCategory } from '@/hooks/use-queries'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { ArrowLeft, Trash2 } from 'lucide-react'

export function CategoryDetail({
  category,
  onBack,
}: {
  category: CategorySummary
  onBack: () => void
}) {
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)
  const deleteCategory = useDeleteCategory()
  const isCustom = !category.systemDefault

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">All sections</span>
          <span className="sm:hidden">Back</span>
        </Button>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <CategoryAvatar icon={category.icon} color={category.color} className="h-7 w-7 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-sm font-semibold">{category.name}</h2>
            {category.unreadCount > 0 && (
              <Badge className="shrink-0 px-1.5 py-0 text-[10px]">
                {category.unreadCount} unread
              </Badge>
            )}
            {category.systemDefault && (
              <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px] text-muted-foreground">
                System
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {category.totalCount} total · {category.importantCount} important
            {category.description ? ` · ${category.description}` : ''}
          </p>
        </div>
        {isCustom && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${category.name} section`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
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
                  onClick={() => deleteCategory.mutate(category.id, { onSuccess: onBack })}
                >
                  {deleteCategory.isPending ? 'Deleting…' : 'Delete section'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </header>

      {/* Master-detail (reuses Inbox primitives) */}
      <div className="min-h-0 flex-1">
        <MasterDetailLayout
          selectedId={selectedEmailId}
          onBack={() => setSelectedEmailId(null)}
          masterMinWidth={300}
          masterDefaultWidth={400}
          masterMaxWidth={500}
          storageKey="organized-detail-layout"
          master={
            <ScrollArea className="min-h-0 flex-1">
              <div className="p-2">
                <EmailList
                  selectedId={selectedEmailId}
                  onSelect={setSelectedEmailId}
                  filter={{ categoryId: category.id }}
                />
              </div>
            </ScrollArea>
          }
          detail={<EmailDetail emailId={selectedEmailId} onBack={() => setSelectedEmailId(null)} />}
        />
      </div>
    </div>
  )
}
