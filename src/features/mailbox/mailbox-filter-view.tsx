'use client'

import { useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { EmailList } from '@/features/inbox/email-list'
import { EmailDetail } from '@/features/inbox/email-detail'
import { MailboxViewHeader } from './mailbox-view-header'
import { EmptyState } from '@/components/common/states'
import { SleekSeparator } from '@/components/common/separator'
import { EmailListSkeleton } from '@/components/common/skeletons'
import { PaneScroll } from '@/components/ui/pane-scroll'
import { useEmails } from '@/hooks/use-queries'
import { MasterDetailLayout } from '@/components/layout/master-detail-layout'
import { Mail } from 'lucide-react'

// ---------------------------------------------------------------------------
// MailboxFilterView — shared master-detail view for the Drafts / Sent / Spam
// (and Starred) mailbox surfaces. Renders a MailboxViewHeader, then a
// responsive list-on-left / detail-on-right layout that mirrors InboxView.
//
// The list is rendered via the shared EmailList component (extended to accept
// the `filter` prop), so every row UI — avatar, category badge, star toggle,
// unread indicator, snoozed indicator — is reused 1:1 with the inbox. The
// detail column reuses EmailDetail verbatim. Loading → EmailListSkeleton,
// empty → EmptyState with the caller-supplied title/description.
//
// DRY by construction: three (or four) near-identical views collapse into one
// orchestrator that takes a `filter` string + copy props. The parent (page.tsx)
// decides which filter to pass and what optional action button to render in
// the header (e.g. "New draft" for the Drafts view).
// ---------------------------------------------------------------------------

export type MailboxFilterBucket = 'drafts' | 'sent' | 'spam' | 'starred'

export interface MailboxFilterViewProps {
  icon: LucideIcon
  title: string
  description: string
  filter: MailboxFilterBucket
  emptyTitle: string
  emptyDescription: string
  /** Tint class for the header icon circle (e.g. 'text-warning', 'cat-amber'). */
  iconTint?: string
  /** Empty-state illustration variant; falls back to the icon-in-circle when omitted. */
  emptyIllustration?: 'inbox' | 'search' | 'notifications' | 'deadlines' | 'generic'
  /** Empty-state icon (used when `emptyIllustration` is omitted). Defaults to Mail. */
  emptyIcon?: LucideIcon
  /** Optional trailing action rendered in the header (e.g. a "New draft" Button). */
  action?: ReactNode
}

export function MailboxFilterView({
  icon,
  title,
  description,
  filter,
  emptyTitle,
  emptyDescription,
  iconTint,
  emptyIllustration,
  emptyIcon = Mail,
  action,
}: MailboxFilterViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Lift the list data via the same useEmails call EmailList will make (same
  // query key → TanStack dedupes). Used to drive the header count and to
  // surface a custom empty state without modifying EmailList.
  const { data, isLoading, error } = useEmails({ filter })

  const count = data?.total ?? data?.items.length ?? 0

  return (
    <div className="flex h-full flex-col">
      <MailboxViewHeader
        icon={icon}
        title={title}
        description={description}
        count={count}
        iconTint={iconTint}
        action={action}
      />

      <SleekSeparator />

      <div className="min-h-0 flex-1">
        <MasterDetailLayout
          selectedId={selectedId}
          onBack={() => setSelectedId(null)}
          masterMinWidth={300}
          masterDefaultWidth={400}
          masterMaxWidth={500}
          storageKey="mailbox-layout"
          master={
            <PaneScroll>
              <div className="p-2 pb-20 md:pb-2">
                {isLoading ? (
                  <EmailListSkeleton />
                ) : error ? (
                  <EmptyState
                    title="Couldn't load emails"
                    description={error.message}
                  />
                ) : !data || data.items.length === 0 ? (
                  <EmptyState
                    icon={emptyIcon}
                    illustration={emptyIllustration}
                    title={emptyTitle}
                    description={emptyDescription}
                  />
                ) : (
                  <EmailList
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    filter={{ filter }}
                  />
                )}
              </div>
            </PaneScroll>
          }
          detail={<EmailDetail emailId={selectedId} onBack={() => setSelectedId(null)} />}
        />
      </div>
    </div>
  )
}
