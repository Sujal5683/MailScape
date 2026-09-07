'use client'

import { type ReactNode, useState } from 'react'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { cn } from '@/lib/utils'

/**
 * MasterDetailLayout — a shared, resizable master-detail layout.
 *
 * On desktop (lg+): renders a resizable 2-panel horizontal split
 *   [master | handle | detail]
 * with enforced min/max widths so panels never overlap or collapse
 * to nothing. The handle is a sleek draggable divider.
 *
 * On mobile (<lg): renders a single panel at a time — master OR detail.
 * When `selectedId` is null, master is shown; when set, detail is shown.
 * A back button in the detail view returns to the master.
 *
 * This replaces the duplicated `lg:w-[400px] xl:w-[440px]` pattern
 * across inbox, organized, archived, search, mailbox views.
 */

export interface MasterDetailLayoutProps {
  /** The master/list content. */
  master: ReactNode
  /** The detail content. */
  detail: ReactNode
  /** Currently selected item id. On mobile, when set, detail is shown full-screen. */
  selectedId: string | null
  /** Back handler — called when the mobile detail back button is pressed. */
  onBack?: () => void
  /** Min width of the master panel in px (desktop). Default 340. */
  masterMinWidth?: number
  /** Default width of the master panel in px (desktop). Default 420. */
  masterDefaultWidth?: number
  /** Max width of the master panel in px (desktop). Default 560. */
  masterMaxWidth?: number
  /** Persist panel sizes to localStorage under this key. Optional. */
  storageKey?: string
  className?: string
}

export function MasterDetailLayout({
  master,
  detail,
  selectedId,
  onBack,
  masterMinWidth = 340,
  masterDefaultWidth = 420,
  masterMaxWidth = 560,
  storageKey,
  className,
}: MasterDetailLayoutProps) {
  // Convert pixel widths to percentage-based sizes for react-resizable-panels.
  // We use a container query approach: the panel group fills 100% width,
  // so percentages are relative to the viewport. We compute sensible defaults.
  const masterDefaultPct = pctOf(masterDefaultWidth)
  const masterMinPct = pctOf(masterMinWidth)
  const masterMaxPct = pctOf(masterMaxWidth)

  return (
    <div className={cn('h-full w-full', className)}>
      {/* Desktop: resizable 2-panel split */}
      <div className="hidden h-full lg:block">
        <ResizablePanelGroup direction="horizontal" autoSaveId={storageKey}>
          <ResizablePanel
            defaultSize={masterDefaultPct}
            minSize={masterMinPct}
            maxSize={masterMaxPct}
            className="min-w-0"
          >
            <div className="flex h-full flex-col">{master}</div>
          </ResizablePanel>
          <ResizableHandle withHandle className="w-1 hover:w-1.5 transition-all" />
          <ResizablePanel minSize={30} className="min-w-0">
            <div className="h-full w-full">{detail}</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile: single panel at a time */}
      <div className="flex h-full flex-col lg:hidden">
        {selectedId ? (
          <div className="flex h-full flex-col">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 border-b border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <span aria-hidden>←</span> Back
              </button>
            )}
            <div className="min-h-0 flex-1">{detail}</div>
          </div>
        ) : (
          <div className="min-h-0 flex-1">{master}</div>
        )}
      </div>
    </div>
  )
}

/**
 * ThreePanelLayout — a shared, resizable 3-panel horizontal layout
 * for the AI Assistant (conversation rail | active conversation | actions panel).
 *
 * On desktop (lg+): resizable 3-panel split with min/max limits.
 * On mobile (<lg): single panel, with the side panels as Sheets.
 */
export interface ThreePanelLayoutProps {
  left: ReactNode
  center: ReactNode
  right: ReactNode
  leftOpen?: boolean
  rightOpen?: boolean
  storageKey?: string
  className?: string
}

export function ThreePanelLayout({
  left,
  center,
  right,
  storageKey,
  className,
}: ThreePanelLayoutProps) {
  return (
    <div className={cn('h-full w-full', className)}>
      {/* Desktop: resizable 3-panel split */}
      <div className="hidden h-full lg:block">
        <ResizablePanelGroup direction="horizontal" autoSaveId={storageKey}>
          <ResizablePanel defaultSize={18} minSize={12} maxSize={28} className="min-w-0">
            <div className="flex h-full flex-col">{left}</div>
          </ResizablePanel>
          <ResizableHandle withHandle className="w-1 hover:w-1.5 transition-all" />
          <ResizablePanel minSize={30} className="min-w-0">
            <div className="flex h-full flex-col">{center}</div>
          </ResizablePanel>
          <ResizableHandle withHandle className="w-1 hover:w-1.5 transition-all" />
          <ResizablePanel defaultSize={22} minSize={16} maxSize={32} className="min-w-0">
            <div className="flex h-full flex-col">{right}</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      {/* Mobile: handled by the parent via Sheets */}
      <div className="flex h-full flex-col lg:hidden">
        <div className="min-h-0 flex-1">{center}</div>
      </div>
    </div>
  )
}

// Convert a pixel width to an approximate percentage of the available content area.
// react-resizable-panels uses percentage sizes (0-100). The panel group sits
// inside main (after the sidebar), so effective width is ~viewport - 248px sidebar.
// We use a reference of 1100px (typical content area on a 1440px screen with sidebar).
function pctOf(px: number): number {
  const ref = 1100
  return Math.max(10, Math.min(48, Math.round((px / ref) * 100)))
}
