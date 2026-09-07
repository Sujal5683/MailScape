'use client'

import { ComposeForm } from './compose-form'

/**
 * ComposeView — full-page compose surface rendered when navigating to the
 * Compose view via the sidebar / bottom nav.
 *
 * Layout: sticky header (title + subtitle) → scrollable body holding the
 * ComposeForm centered in a `max-w-3xl` column with responsive padding.
 * The root is `h-full flex flex-col` so the form fills the viewport height
 * and the body scrolls when content overflows.
 */
export function ComposeView() {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border bg-background px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-xl font-semibold text-foreground">New message</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compose and send email from any of your connected accounts. Drafts
            and sent mail are tracked by the platform.
          </p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-4 pb-20 sm:p-6 md:pb-6">
          <ComposeForm />
        </div>
      </div>
    </div>
  )
}
