// ---------------------------------------------------------------------------
// Global keyboard shortcuts registry.
//
// This is the single source of truth for what shortcuts exist in the app. The
// help dialog renders it verbatim and the useKeyboardShortcuts hook looks up
// entries by `key` (for g-prefix sequences the `key` is the two-character
// "g<second>" form, e.g. "gi" for "g then i" → Inbox).
//
// Categories (rendered as section headings in the help dialog):
//   - Navigation    : g-prefix two-key sequences (Gmail-style)
//   - Email Actions : single-key shortcuts that only fire when an email is
//                     selected in the inbox
//   - General       : global single-key shortcuts (help, compose, search, Esc…)
//
// `global: true` means the shortcut fires on every view (subject to the
// input-field / dialog-open guards inside the hook). `global: false` shortcuts
// are scoped — the hook decides when they're eligible (e.g. email-action
// shortcuts require the inbox view + a selected email).
// ---------------------------------------------------------------------------

export type ShortcutCategory = 'Navigation' | 'Email Actions' | 'General'

export interface ShortcutEntry {
  /**
   * The key sequence the user presses. For g-prefix entries this is the
   * two-character form `"g" + secondKey` (e.g. "gi" for Inbox). For single-key
   * entries it's just the key (e.g. "j", "?", "/"). For modifier combos it's
   * the human-readable form (e.g. "cmd+k", "shift+r").
   */
  key: string
  /** Human-readable label rendered as the `key` of the <kbd> in the help dialog. */
  display: string
  description: string
  category: ShortcutCategory
  /**
   * `true` = fires on every view (subject to input/dialog guards).
   * `false` = scoped (the hook decides eligibility).
   */
  global: boolean
}

export const SHORTCUTS: ShortcutEntry[] = [
  // ----------------------------- Navigation -----------------------------
  // All g-prefix sequences. The first 'g' primes a 600ms window; the next key
  // (case-insensitive) selects the destination view.
  { key: 'gi', display: 'g then i', description: 'Go to Inbox', category: 'Navigation', global: true },
  { key: 'go', display: 'g then o', description: 'Go to Organized', category: 'Navigation', global: true },
  { key: 'gd', display: 'g then d', description: 'Go to Dashboard', category: 'Navigation', global: true },
  { key: 'gl', display: 'g then l', description: 'Go to Deadlines', category: 'Navigation', global: true },
  { key: 'ga', display: 'g then a', description: 'Go to AI Assistant', category: 'Navigation', global: true },
  { key: 'gn', display: 'g then n', description: 'Go to Notifications', category: 'Navigation', global: true },
  { key: 'gs', display: 'g then s', description: 'Go to Senders', category: 'Navigation', global: true },
  { key: 'gr', display: 'g then r', description: 'Go to Rules', category: 'Navigation', global: true },
  { key: 'gc', display: 'g then c', description: 'Go to Compose', category: 'Navigation', global: true },
  { key: 'gf', display: 'g then f', description: 'Go to Search', category: 'Navigation', global: true },
  { key: 'g,', display: 'g then ,', description: 'Go to Settings', category: 'Navigation', global: true },

  // --------------------------- Email Actions ----------------------------
  // Only active when the inbox view is open AND an email is selected.
  { key: 'j', display: 'j', description: 'Next email', category: 'Email Actions', global: false },
  { key: 'k', display: 'k', description: 'Previous email', category: 'Email Actions', global: false },
  { key: 'e', display: 'e', description: 'Archive selected email', category: 'Email Actions', global: false },
  { key: 's', display: 's', description: 'Toggle star', category: 'Email Actions', global: false },
  { key: 'i', display: 'i', description: 'Toggle important', category: 'Email Actions', global: false },
  { key: 'r', display: 'r', description: 'Reply', category: 'Email Actions', global: false },
  { key: 'shift+r', display: 'Shift + r', description: 'Reply all', category: 'Email Actions', global: false },
  { key: 'f', display: 'f', description: 'Forward', category: 'Email Actions', global: false },
  { key: '#', display: '#', description: 'Delete (asks for confirmation)', category: 'Email Actions', global: false },

  // ------------------------------ General -------------------------------
  { key: '?', display: '?', description: 'Toggle this help dialog', category: 'General', global: true },
  { key: 'cmd+k', display: '⌘ / Ctrl + K', description: 'Open the command palette', category: 'General', global: true },
  { key: 'Escape', display: 'Esc', description: 'Close dialog / palette', category: 'General', global: true },
  { key: 'c', display: 'c', description: 'Compose a new email', category: 'General', global: true },
  { key: '/', display: '/', description: 'Focus search', category: 'General', global: true },
]

// Group the registry by category for the help dialog (stable order).
export const SHORTCUTS_BY_CATEGORY: { category: ShortcutCategory; entries: ShortcutEntry[] }[] = [
  { category: 'Navigation', entries: SHORTCUTS.filter((s) => s.category === 'Navigation') },
  { category: 'Email Actions', entries: SHORTCUTS.filter((s) => s.category === 'Email Actions') },
  { category: 'General', entries: SHORTCUTS.filter((s) => s.category === 'General') },
]

// Map of g-prefix second-key → destination view. Used by the hook to resolve
// the two-key sequence. Keys are lowercased second keys; values are ViewKeys.
export const G_PREFIX_NAV: Record<string, import('@/store/ui-store').ViewKey> = {
  i: 'inbox',
  o: 'organized',
  d: 'dashboard',
  l: 'deadlines',
  a: 'assistant',
  n: 'notifications',
  s: 'senders',
  r: 'rules',
  c: 'compose',
  f: 'search',
  ',': 'settings',
}
