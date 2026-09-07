'use client'

import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'
import { BottomNav } from './bottom-nav'
import { CommandPalette } from './command-palette'
import { ShortcutsHelpDialog } from './shortcuts-help-dialog'
import { OnboardingTour } from './onboarding-tour'
import { ScrollToTop } from '@/components/common/scroll-to-top'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { ScanDialog } from '@/features/scan/scan-dialog'
import { useScanDialogStore } from '@/features/scan/scan-dialog-store'

export function AppShell({ children }: { children: React.ReactNode }) {
  // Mount the global keyboard shortcuts listener once for the whole app. The
  // hook returns nothing — it's called purely for its keydown side effect.
  useKeyboardShortcuts()

  // The ScanDialog is mounted once at the app root so any component can
  // open it via the scan-dialog store (TopBar button, SyncStatusWidget,
  // EmptyInboxScanCta) without prop-drilling open state through every view.
  const scanOpen = useScanDialogStore((s) => s.open)
  const setScanOpen = useScanDialogStore((s) => s.setOpen)

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      {/* `overflow-x-clip` (not `hidden`) prevents horizontal page-scroll WITHOUT
          breaking `position: sticky` on descendants. `min-w-0` lets the column
          shrink below its intrinsic content width so wide cards scroll instead
          of pushing the layout wider than the viewport. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
        <TopBar />
        {/* `pb-20 md:pb-0` clears the mobile bottom nav (~56px + safe area)
            so the last items in any inner scroll container stay visible.
            On desktop there is no bottom nav, so no padding is needed. */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col pb-20 md:pb-0">
          {children}
          <CommandPalette />
          <ShortcutsHelpDialog />
        </main>
      </div>
      <BottomNav />
      {/* First-run onboarding tour. Auto-opens when !onboardingComplete. */}
      <OnboardingTour />
      {/* Floating scroll-to-top button. Renders above the mobile bottom nav. */}
      <ScrollToTop />
      {/* Mailbox scan configuration dialog — opened via useScanDialogStore. */}
      <ScanDialog open={scanOpen} onOpenChange={setScanOpen} />
    </div>
  )
}
