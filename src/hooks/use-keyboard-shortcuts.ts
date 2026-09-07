'use client'

// ---------------------------------------------------------------------------
// Global keyboard shortcuts hook.
//
// Mounted ONCE inside AppShell. Registers a single window keydown listener
// that handles:
//
//   1. Gmail-style "g-prefix" two-key sequences (g then i / o / d / l / a / n /
//      s / r / c / f / ,). Pressing 'g' primes a 600ms window; the next key
//      (case-insensitive) selects the destination view via useUIStore.navigate.
//      An invalid second key or a timeout silently resets.
//
//   2. Single-key shortcuts (j, k, e, s, i, r, f, #, c, /, ?). Only fire when
//      the user is NOT typing in an input/textarea/contenteditable AND no
//      dialog / sheet / alert-dialog / command-palette overlay is open.
//      Email-action shortcuts (j, k, e, s, i, r, f, #) additionally require
//      the active view to be 'inbox' AND an email to be selected — the
//      currently selected email + visible email list come from the email
//      context registered by inbox-view via useEmailShortcutContext().
//
//   3. Escape — closes any open overlay (help dialog, command palette, alert,
//      sheet). The Radix overlays handle their own Esc, but we also clear the
//      g-prefix state and the help-dialog store flag explicitly so the help
//      dialog closes even if it lost focus.
//
// Email-action callbacks are looked up from a module-level singleton ref
// (`emailContext`) that inbox-view populates via useEmailShortcutContext().
// This avoids wrapping the app in a React context provider just to share one
// ref between AppShell and inbox-view.
//
// The hook returns nothing — it's called purely for its side effect.
// ---------------------------------------------------------------------------

import { useEffect } from 'react'
import { useUIStore } from '@/store/ui-store'
import type { ViewKey } from '@/store/ui-store'
import { G_PREFIX_NAV } from '@/lib/shortcuts'

export interface EmailShortcutContext {
  /** Currently selected email id in the inbox (or null if none). */
  selectedId: string | null
  /** Ordered list of visible email ids (the list the user sees). */
  emailIds: string[]
  /** Open a different email by id (used by j / k). */
  onSelect: (id: string) => void
  /** Archive the email by id. */
  onArchive: (id: string) => void
  /** Toggle the star flag on the email by id. */
  onStar: (id: string) => void
  /** Toggle the important flag on the email by id. */
  onImportant: (id: string) => void
  /** Open the compose drawer pre-filled as a reply to the email by id. */
  onReply: (id: string) => void
  /** Open the compose drawer pre-filled as a reply-all to the email by id. */
  onReplyAll: (id: string) => void
  /** Open the compose drawer pre-filled as a forward of the email by id. */
  onForward: (id: string) => void
  /** Delete the email by id (the implementation is expected to confirm). */
  onDelete: (id: string) => void
}

// Module-level singleton — set by useEmailShortcutContext() inside inbox-view,
// read by the keydown handler. Using a module-level holder (rather than React
// context) keeps the registration API a plain function call from a useEffect,
// with no provider wrapping required.
let emailContext: EmailShortcutContext | null = null

/**
 * Imperative registration entry point. Called from inbox-view's useEffect to
 * publish the current email context (selected id, visible ids, action
 * callbacks). Pass `null` on unmount to disable email-action shortcuts.
 */
export function registerEmailContext(ctx: EmailShortcutContext | null) {
  emailContext = ctx
}

/**
 * Hook that inbox-view calls. Returns the stable `registerEmailContext`
 * function. The return value is intentionally a function reference (not a
 * context object) so callers can pass it straight into a useEffect dependency
 * array without re-running on every render.
 */
export function useEmailShortcutContext() {
  return registerEmailContext
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const G_PREFIX_TIMEOUT_MS = 600

// Single-key email-action shortcuts. Matched against e.key directly.
const EMAIL_ACTION_KEYS = new Set(['j', 'k', 'e', 's', 'i', 'r', 'f', '#'])

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  const tag = t.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (t.isContentEditable) return true
  return false
}

function isOverlayOpen(): boolean {
  if (typeof document === 'undefined') return false
  // Radix Dialog/AlertDialog/Sheet set role=dialog|alertdialog + data-state=open.
  // The cmdk command palette mounts a [cmdk-root] element while open.
  return Boolean(
    document.querySelector(
      '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [cmdk-root]',
    ),
  )
}

// ---------------------------------------------------------------------------
// The hook — mounted once in AppShell.
// ---------------------------------------------------------------------------

export function useKeyboardShortcuts() {
  const navigate = useUIStore((s) => s.navigate)
  const setShortcutsHelpOpen = useUIStore((s) => s.setShortcutsHelpOpen)
  const setComposeOpen = useUIStore((s) => s.setComposeOpen)

  useEffect(() => {
    let gPrefixTimer: ReturnType<typeof setTimeout> | null = null
    let gPrefixPrimed = false

    const clearGPrefix = () => {
      if (gPrefixTimer) {
        clearTimeout(gPrefixTimer)
        gPrefixTimer = null
      }
      gPrefixPrimed = false
    }

    const onKey = (e: KeyboardEvent) => {
      const key = e.key

      // --- Escape: always handled. Closes the help dialog (if open) and
      // clears any primed g-prefix state. Radix overlays handle their own Esc
      // separately; this is additive, not a replacement.
      if (key === 'Escape') {
        clearGPrefix()
        if (useUIStore.getState().shortcutsHelpOpen) {
          setShortcutsHelpOpen(false)
        }
        return
      }

      // Cmd/Ctrl/Alt combos are out of scope (Cmd+K is handled by the command
      // palette's own listener). Shift is allowed through so '?', '#', and
      // 'Shift+r' work.
      if (e.metaKey || e.ctrlKey || e.altKey) {
        clearGPrefix()
        return
      }

      const typing = isTypingTarget(e.target)
      const overlayOpen = isOverlayOpen()

      // --- '?' toggles the help dialog. Always allowed when not typing —
      // pressing '?' inside an input passes through to the input as a literal
      // character (typing === true → fall through). If the help dialog is
      // already open, '?' closes it. If another overlay is open, '?' does
      // nothing (avoid stacking).
      if (!typing && key === '?') {
        const helpOpen = useUIStore.getState().shortcutsHelpOpen
        if (helpOpen) {
          e.preventDefault()
          setShortcutsHelpOpen(false)
        } else if (!overlayOpen) {
          e.preventDefault()
          setShortcutsHelpOpen(true)
        }
        clearGPrefix()
        return
      }

      // From here on, single-key shortcuts only fire when not typing AND no
      // overlay is open. The g-prefix sequence is also gated this way (we
      // don't want 'g' priming while a dialog is open).
      if (typing || overlayOpen) {
        clearGPrefix()
        return
      }

      // --- g-prefix two-key sequence ---
      // Prime on 'g' (Shift G or plain g). The next key (within 600ms) selects
      // the destination view from G_PREFIX_NAV.
      if (key === 'g' || key === 'G') {
        clearGPrefix()
        gPrefixPrimed = true
        gPrefixTimer = setTimeout(() => {
          gPrefixPrimed = false
          gPrefixTimer = null
        }, G_PREFIX_TIMEOUT_MS)
        e.preventDefault()
        return
      }

      // If primed, look for a valid second key.
      if (gPrefixPrimed) {
        const second = key.toLowerCase()
        const dest = G_PREFIX_NAV[second]
        clearGPrefix()
        if (dest) {
          e.preventDefault()
          navigate(dest as ViewKey)
        }
        // Invalid second key: silently reset (no action).
        return
      }

      // --- '/' : focus search → navigate to search view ---
      if (key === '/') {
        e.preventDefault()
        navigate('search')
        return
      }

      // --- 'c' : compose ---
      if (key === 'c') {
        e.preventDefault()
        setComposeOpen(true)
        return
      }

      // --- Email-action shortcuts (j, k, e, s, i, r, f, #) ---
      // Only fire when the inbox view is active AND an email is selected.
      const activeView = useUIStore.getState().activeView
      const ctx = emailContext
      if (activeView !== 'inbox' || !ctx || !ctx.selectedId) {
        clearGPrefix()
        return
      }

      // Shift+r → reply-all (handled before plain 'r').
      if (e.shiftKey && key.toLowerCase() === 'r') {
        e.preventDefault()
        ctx.onReplyAll(ctx.selectedId)
        return
      }
      // Other Shift+key combos aren't defined; ignore.
      if (e.shiftKey) {
        clearGPrefix()
        return
      }

      if (!EMAIL_ACTION_KEYS.has(key)) {
        clearGPrefix()
        return
      }

      e.preventDefault()
      const id = ctx.selectedId
      switch (key) {
        case 'j': {
          const idx = ctx.emailIds.indexOf(id)
          const next = idx >= 0 ? ctx.emailIds[idx + 1] : undefined
          if (next) ctx.onSelect(next)
          break
        }
        case 'k': {
          const idx = ctx.emailIds.indexOf(id)
          const prev = idx >= 0 ? ctx.emailIds[idx - 1] : undefined
          if (prev) ctx.onSelect(prev)
          break
        }
        case 'e':
          ctx.onArchive(id)
          break
        case 's':
          ctx.onStar(id)
          break
        case 'i':
          ctx.onImportant(id)
          break
        case 'r':
          ctx.onReply(id)
          break
        case 'f':
          ctx.onForward(id)
          break
        case '#':
          ctx.onDelete(id)
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearGPrefix()
    }
  }, [navigate, setShortcutsHelpOpen, setComposeOpen])
}
