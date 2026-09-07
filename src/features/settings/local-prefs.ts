// LocalStorage-backed preference helpers for the Settings view.
// Keys are namespaced under `iei-*` to match the rest of the app.

export type AssistantMode = 'direct' | 'thinking' | 'suggest'

export interface AiPrefs {
  defaultMode: AssistantMode
  speakerMode: boolean
}

export interface NotifPrefs {
  inApp: boolean
  web: boolean
  push: boolean
}

const AI_KEY = 'iei-ai-prefs'
const NOTIF_KEY = 'iei-notif-prefs'

export const DEFAULT_AI_PREFS: AiPrefs = { defaultMode: 'suggest', speakerMode: false }
export const DEFAULT_NOTIF_PREFS: NotifPrefs = { inApp: true, web: false, push: false }

const AI_MODES: AssistantMode[] = ['direct', 'thinking', 'suggest']

function isAiPrefs(v: unknown): v is AiPrefs {
  if (!v || typeof v !== 'object') return false
  const p = v as Partial<AiPrefs>
  return (
    typeof p.defaultMode === 'string' &&
    AI_MODES.includes(p.defaultMode as AssistantMode) &&
    typeof p.speakerMode === 'boolean'
  )
}

function isNotifPrefs(v: unknown): v is NotifPrefs {
  if (!v || typeof v !== 'object') return false
  const p = v as Partial<NotifPrefs>
  return (
    typeof p.inApp === 'boolean' &&
    typeof p.web === 'boolean' &&
    typeof p.push === 'boolean'
  )
}

export function loadAiPrefs(): AiPrefs {
  if (typeof window === 'undefined') return DEFAULT_AI_PREFS
  try {
    const raw = localStorage.getItem(AI_KEY)
    if (!raw) return DEFAULT_AI_PREFS
    const parsed = JSON.parse(raw) as unknown
    return isAiPrefs(parsed) ? parsed : DEFAULT_AI_PREFS
  } catch {
    return DEFAULT_AI_PREFS
  }
}

export function saveAiPrefs(p: AiPrefs): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(AI_KEY, JSON.stringify(p))
}

export function loadNotifPrefs(): NotifPrefs {
  if (typeof window === 'undefined') return DEFAULT_NOTIF_PREFS
  try {
    const raw = localStorage.getItem(NOTIF_KEY)
    if (!raw) return DEFAULT_NOTIF_PREFS
    const parsed = JSON.parse(raw) as unknown
    return isNotifPrefs(parsed) ? parsed : DEFAULT_NOTIF_PREFS
  } catch {
    return DEFAULT_NOTIF_PREFS
  }
}

export function saveNotifPrefs(p: NotifPrefs): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(NOTIF_KEY, JSON.stringify(p))
}

// "Sign out" — cosmetic: clears every known local-pref key we own.
export function clearLocalPrefs(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(AI_KEY)
  localStorage.removeItem(NOTIF_KEY)
}
