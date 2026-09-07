'use client'

import { create } from 'zustand'

/**
 * ScanDialog open-state store. The ScanDialog is mounted once in AppShell
 * (alongside the ComposeDrawer) so any component — TopBar button,
 * SyncStatusWidget "Scan now", EmptyInboxScanCTA — can open it via
 * `useScanDialogStore.getState().open()` without prop-drilling.
 */
interface ScanDialogState {
  open: boolean
  openDialog: () => void
  closeDialog: () => void
  setOpen: (o: boolean) => void
}

export const useScanDialogStore = create<ScanDialogState>((set) => ({
  open: false,
  openDialog: () => set({ open: true }),
  closeDialog: () => set({ open: false }),
  setOpen: (open) => set({ open }),
}))
