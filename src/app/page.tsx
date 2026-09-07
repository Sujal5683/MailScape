'use client'

import { AppShell } from '@/components/layout/app-shell'
import { useUIStore } from '@/store/ui-store'
import { InboxView } from '@/features/inbox/inbox-view'
import { OrganizedView } from '@/features/organized/organized-view'
import { DashboardView } from '@/features/dashboard/dashboard-view'
import { AssistantView } from '@/features/assistant/assistant-view'
import { NotificationsView } from '@/features/notifications/notifications-view'
import { SendersView } from '@/features/senders/senders-view'
import { RulesView } from '@/features/rules/rules-view'
import { ComposeView } from '@/features/compose/compose-view'
import { SearchView } from '@/features/search/search-view'
import { SettingsView } from '@/features/settings/settings-view'
import { DeadlinesView } from '@/features/deadlines/deadlines-view'
import { ArchivedView } from '@/features/archived/archived-view'
import { ComposeDrawer } from '@/features/compose/compose-drawer'
import { MailboxFilterView } from '@/features/mailbox/mailbox-filter-view'
import { Button } from '@/components/ui/button'
import { FileEdit, Send, ShieldAlert, PenSquare } from 'lucide-react'
import { ViewErrorBoundary } from '@/components/common/error-boundary'

export default function Home() {
  const activeView = useUIStore((s) => s.activeView)
  const setComposeOpen = useUIStore((s) => s.setComposeOpen)

  return (
    <AppShell>
      <div className="h-full w-full animate-fade-in-up" key={activeView}>
        {activeView === 'inbox' && (
          <ViewErrorBoundary name="Inbox">
            <InboxView />
          </ViewErrorBoundary>
        )}
        {activeView === 'organized' && (
          <ViewErrorBoundary name="Organized">
            <OrganizedView />
          </ViewErrorBoundary>
        )}
        {activeView === 'dashboard' && (
          <ViewErrorBoundary name="Dashboard">
            <DashboardView />
          </ViewErrorBoundary>
        )}
        {activeView === 'deadlines' && (
          <ViewErrorBoundary name="Deadlines">
            <DeadlinesView />
          </ViewErrorBoundary>
        )}
        {activeView === 'archived' && (
          <ViewErrorBoundary name="Archived">
            <ArchivedView />
          </ViewErrorBoundary>
        )}
        {activeView === 'drafts' && (
          <ViewErrorBoundary name="Drafts">
            <MailboxFilterView
              filter="drafts"
              title="Drafts"
              description="Saved drafts — finish and send when ready"
              icon={FileEdit}
              iconTint="text-primary"
              emptyTitle="No drafts"
              emptyDescription="Drafts you save while composing will appear here. Start a new message to create one."
              emptyIllustration="generic"
              emptyIcon={FileEdit}
              action={
                <Button size="sm" onClick={() => setComposeOpen(true)} className="gap-1.5">
                  <PenSquare className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">New draft</span>
                  <span className="sm:hidden">New</span>
                </Button>
              }
            />
          </ViewErrorBoundary>
        )}
        {activeView === 'sent' && (
          <ViewErrorBoundary name="Sent">
            <MailboxFilterView
              filter="sent"
              title="Sent"
              description="Emails you have sent from this account"
              icon={Send}
              iconTint="text-muted-foreground"
              emptyTitle="Nothing sent yet"
              emptyDescription="Emails you send will appear here. Compose a new message to get started."
              emptyIllustration="generic"
              emptyIcon={Send}
            />
          </ViewErrorBoundary>
        )}
        {activeView === 'spam' && (
          <ViewErrorBoundary name="Spam">
            <MailboxFilterView
              filter="spam"
              title="Spam"
              description="Flagged spam and suspicious messages — review carefully"
              icon={ShieldAlert}
              iconTint="text-destructive"
              emptyTitle="No spam"
              emptyDescription="Messages flagged as spam will appear here. A clean spam folder is a good sign."
              emptyIllustration="generic"
              emptyIcon={ShieldAlert}
            />
          </ViewErrorBoundary>
        )}
        {activeView === 'assistant' && (
          <ViewErrorBoundary name="Assistant">
            <AssistantView />
          </ViewErrorBoundary>
        )}
        {activeView === 'notifications' && (
          <ViewErrorBoundary name="Notifications">
            <NotificationsView />
          </ViewErrorBoundary>
        )}
        {activeView === 'senders' && (
          <ViewErrorBoundary name="Senders">
            <SendersView />
          </ViewErrorBoundary>
        )}
        {activeView === 'rules' && (
          <ViewErrorBoundary name="Rules">
            <RulesView />
          </ViewErrorBoundary>
        )}
        {activeView === 'compose' && (
          <ViewErrorBoundary name="Compose">
            <ComposeView />
          </ViewErrorBoundary>
        )}
        {activeView === 'search' && (
          <ViewErrorBoundary name="Search">
            <SearchView />
          </ViewErrorBoundary>
        )}
        {activeView === 'settings' && (
          <ViewErrorBoundary name="Settings">
            <SettingsView />
          </ViewErrorBoundary>
        )}
      </div>
      <ComposeDrawer />
    </AppShell>
  )
}
