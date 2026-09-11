'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Recipient } from '@/lib/types'

export type ViewKey =
  | 'inbox'
  | 'organized'
  | 'dashboard'
  | 'assistant'
  | 'notifications'
  | 'senders'
  | 'rules'
  | 'compose'
  | 'search'
  | 'settings'
  | 'deadlines'
  | 'archived'
  | 'drafts'
  | 'sent'
  | 'spam'

/**
 * Compose prefill payload. When set, {@link ComposeForm} reads it once on mount
 * (via a lazy initializer) and immediately clears it from the store so the
 * prefill is consumed exactly once. Used by smart replies / reply / forward
 * flows to seed the compose drawer with subject + body + recipients.
 */
export interface ComposePrefill {
  to?: Recipient[]
  cc?: Recipient[]
  subject?: string
  body?: string
}

interface UIState {
  activeView: ViewKey
  sidebarCollapsed: boolean
  mobileNavOpen: boolean
  composeOpen: boolean
  commandOpen: boolean
  shortcutsHelpOpen: boolean
  // First-run onboarding tour. `onboardingComplete` is persisted so the tour
  // only auto-opens the first time a user visits; `tourOpen` is ephemeral so
  // a refresh never re-opens an in-progress tour.
  onboardingComplete: boolean
  tourOpen: boolean
  // context for navigation: e.g. open a category from dashboard
  contextCategoryId: string | null
  contextSenderId: string | null
  contextEmailId: string | null
  contextSearchQuery: string | null
  // One-shot prefill consumed by ComposeForm when the drawer opens.
  composePrefill: ComposePrefill | null
  // Active account for multi-inbox support. null = use first available account.
  activeAccountId: string | null
  setView: (v: ViewKey) => void
  toggleSidebar: () => void
  setMobileNav: (open: boolean) => void
  setComposeOpen: (open: boolean) => void
  setCommandOpen: (open: boolean) => void
  setShortcutsHelpOpen: (open: boolean) => void
  setOnboardingComplete: (complete: boolean) => void
  setTourOpen: (open: boolean) => void
  setContext: (ctx: Partial<Pick<UIState, 'contextCategoryId' | 'contextSenderId' | 'contextEmailId' | 'contextSearchQuery'>>) => void
  navigate: (view: ViewKey, ctx?: Partial<Pick<UIState, 'contextCategoryId' | 'contextSenderId' | 'contextEmailId' | 'contextSearchQuery'>>) => void
  setComposePrefill: (prefill: ComposePrefill | null) => void
  setActiveAccountId: (id: string | null) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeView: 'inbox',
      sidebarCollapsed: false,
      mobileNavOpen: false,
      composeOpen: false,
      commandOpen: false,
      shortcutsHelpOpen: false,
      onboardingComplete: false,
      tourOpen: false,
      contextCategoryId: null,
      contextSenderId: null,
      contextEmailId: null,
      contextSearchQuery: null,
      composePrefill: null,
      activeAccountId: null,
      setView: (v) => set({ activeView: v, mobileNavOpen: false }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileNav: (open) => set({ mobileNavOpen: open }),
      setComposeOpen: (open) => set({ composeOpen: open }),
      setCommandOpen: (open) => set({ commandOpen: open }),
      setShortcutsHelpOpen: (open) => set({ shortcutsHelpOpen: open }),
      setOnboardingComplete: (complete) => set({ onboardingComplete: complete }),
      setTourOpen: (open) => set({ tourOpen: open }),
      setContext: (ctx) => set(ctx),
      navigate: (view, ctx) =>
        set({
          activeView: view,
          mobileNavOpen: false,
          contextCategoryId: null,
          contextSenderId: null,
          contextEmailId: null,
          contextSearchQuery: null,
          ...ctx,
        }),
      setComposePrefill: (prefill) => set({ composePrefill: prefill }),
      setActiveAccountId: (id) => set({ activeAccountId: id }),
    }),
    {
      name: 'iei-ui-store',
      partialize: (s) => ({
        activeView: s.activeView,
        sidebarCollapsed: s.sidebarCollapsed,
        onboardingComplete: s.onboardingComplete,
        activeAccountId: s.activeAccountId,
      }),
    },
  ),
)
