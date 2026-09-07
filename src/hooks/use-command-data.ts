'use client'

import { useMemo } from 'react'
import { useTheme } from 'next-themes'
import {
  useAccounts,
  useCategories,
  useEmails,
  useSenders,
  useSyncAccount,
  useMarkAllNotificationsRead,
} from '@/hooks/use-queries'
import { useToast } from '@/hooks/use-toast'
import { useUIStore } from '@/store/ui-store'

// ---------------------------------------------------------------------------
// Types — single source of truth for the palette's data shape.
// ---------------------------------------------------------------------------
export type CommandItemType = 'email' | 'sender' | 'category' | 'action'
export type CommandGroupKey = 'email' | 'sender' | 'category' | 'action'

export interface CommandItemData {
  id: string
  type: CommandItemType
  group: CommandGroupKey
  label: string
  sublabel?: string
  /** ActionIcon name (resolved via createElement in the palette). */
  icon: string
  /** Raw category color name (e.g. 'amber') — only set for category items. */
  color?: string
  /** Extra searchable text appended to the cmdk value. */
  keywords?: string
  onSelect: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function relTime(iso: string | null): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Math.max(0, Date.now() - t)
  const MIN = 60_000
  const HOUR = 3_600_000
  const DAY = 86_400_000
  if (diff < MIN) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m ago`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`
  return new Date(iso).toLocaleDateString()
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
/**
 * Aggregates every searchable item for the command palette.
 *
 * The hook itself is cheap to call — it only fetches data when React mounts
 * the component that calls it. Because the palette renders its inner content
 * (which calls this hook) only while `commandOpen === true`, the underlying
 * TanStack Query requests are effectively lazy: they fire on first open and
 * are served from cache on subsequent opens (data is shared with Inbox /
 * Senders / Organized views via the shared query keys).
 */
export function useCommandData() {
  const navigate = useUIStore((s) => s.navigate)
  const setComposeOpen = useUIStore((s) => s.setComposeOpen)
  const setCommandOpen = useUIStore((s) => s.setCommandOpen)
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const syncMut = useSyncAccount()
  const markAllNotifs = useMarkAllNotificationsRead()

  const emailsQ = useEmails({ limit: 20 })
  const sendersQ = useSenders()
  const categoriesQ = useCategories()
  const accountsQ = useAccounts()

  const isLoading =
    emailsQ.isLoading || sendersQ.isLoading || categoriesQ.isLoading

  const items = useMemo<CommandItemData[]>(() => {
    const close = () => setCommandOpen(false)

    // ----- Actions (hardcoded, always present) -----
    const actions: CommandItemData[] = [
      {
        id: 'act:assistant',
        type: 'action',
        group: 'action',
        label: 'New conversation',
        sublabel: 'Open the AI assistant',
        icon: 'sparkles',
        keywords: 'assistant ask ai chat new conversation',
        onSelect: () => {
          close()
          navigate('assistant')
        },
      },
      {
        id: 'act:compose',
        type: 'action',
        group: 'action',
        label: 'Compose',
        sublabel: 'Write & send a new email',
        icon: 'pen',
        keywords: 'compose write new email draft send',
        onSelect: () => {
          close()
          navigate('compose')
          setComposeOpen(true)
        },
      },
      {
        id: 'act:inbox',
        type: 'action',
        group: 'action',
        label: 'Go to Inbox',
        sublabel: 'All synchronized emails',
        icon: 'inbox',
        keywords: 'inbox go navigate emails all',
        onSelect: () => {
          close()
          navigate('inbox')
        },
      },
      {
        id: 'act:dashboard',
        type: 'action',
        group: 'action',
        label: 'Go to Dashboard',
        sublabel: 'Operational overview',
        icon: 'dashboard',
        keywords: 'dashboard overview stats go navigate',
        onSelect: () => {
          close()
          navigate('dashboard')
        },
      },
      {
        id: 'act:organized',
        type: 'action',
        group: 'action',
        label: 'Go to Organized',
        sublabel: 'Institutional sections',
        icon: 'grid',
        keywords: 'organized sections categories go navigate',
        onSelect: () => {
          close()
          navigate('organized')
        },
      },
      {
        id: 'act:rules',
        type: 'action',
        group: 'action',
        label: 'Go to Rules',
        sublabel: 'Automation & rules',
        icon: 'workflow',
        keywords: 'rules automation go navigate',
        onSelect: () => {
          close()
          navigate('rules')
        },
      },
      {
        id: 'act:settings',
        type: 'action',
        group: 'action',
        label: 'Go to Settings',
        sublabel: 'Accounts, themes, privacy',
        icon: 'settings',
        keywords: 'settings preferences go navigate',
        onSelect: () => {
          close()
          navigate('settings')
        },
      },
      {
        id: 'act:create-section',
        type: 'action',
        group: 'action',
        label: 'Create section',
        sublabel: 'Add a new institutional section',
        icon: 'plus',
        keywords: 'create section category new organize',
        onSelect: () => {
          close()
          navigate('organized')
        },
      },
      {
        id: 'act:toggle-theme',
        type: 'action',
        group: 'action',
        label: 'Toggle theme',
        sublabel: `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`,
        icon: theme === 'dark' ? 'sun' : 'moon',
        keywords: 'toggle theme dark light mode appearance',
        onSelect: () => {
          setTheme(theme === 'dark' ? 'light' : 'dark')
          close()
        },
      },
      {
        id: 'act:mark-notifs',
        type: 'action',
        group: 'action',
        label: 'Mark all notifications read',
        sublabel: 'Clear unread badges',
        icon: 'check',
        keywords: 'mark read notifications clear all unread',
        onSelect: () => {
          markAllNotifs.mutate()
          toast({ title: 'All notifications marked read' })
          close()
        },
      },
    ]

    // Sync account (only once the first account is known).
    const firstAccount = accountsQ.data?.[0]
    if (firstAccount) {
      actions.push({
        id: 'act:sync',
        type: 'action',
        group: 'action',
        label: 'Sync account',
        sublabel: firstAccount.emailAddress,
        icon: 'refresh',
        keywords: 'sync account fetch refresh emails',
        onSelect: () => {
          syncMut.mutate(firstAccount.id)
          toast({ title: 'Syncing account…' })
          close()
        },
      })
    }

    // ----- Categories -----
    const categories: CommandItemData[] = (categoriesQ.data ?? []).map((c) => ({
      id: `cat:${c.id}`,
      type: 'category',
      group: 'category',
      label: c.name,
      sublabel: `${c.totalCount} emails · ${c.unreadCount} unread`,
      icon: 'folder',
      color: c.color,
      keywords: `${c.name} ${c.description ?? ''} section category`,
      onSelect: () => {
        close()
        navigate('organized', { contextCategoryId: c.id })
      },
    }))

    // ----- Senders -----
    const senders: CommandItemData[] = (sendersQ.data ?? []).map((s) => ({
      id: `snd:${s.id}`,
      type: 'sender',
      group: 'sender',
      label: s.senderName || s.senderEmail,
      sublabel: `${s.messageCount} messages${s.domain ? ' · ' + s.domain : ''}`,
      icon: 'users',
      keywords: `${s.senderName ?? ''} ${s.senderEmail} ${s.domain ?? ''} sender`,
      onSelect: () => {
        close()
        navigate('senders', { contextSenderId: s.id })
      },
    }))

    // ----- Emails (top 20 recent) -----
    const emails: CommandItemData[] = (emailsQ.data?.items ?? []).map((e) => ({
      id: `eml:${e.id}`,
      type: 'email',
      group: 'email',
      label: e.subject || '(no subject)',
      sublabel: `from ${e.fromName || e.fromEmail} · ${relTime(e.receivedAt)}`,
      icon: 'mail',
      keywords: `${e.subject ?? ''} ${e.fromName ?? ''} ${e.fromEmail} ${e.snippet ?? ''}`,
      onSelect: () => {
        close()
        navigate('inbox', { contextEmailId: e.id })
      },
    }))

    return [...actions, ...categories, ...senders, ...emails]
  }, [
    emailsQ.data,
    sendersQ.data,
    categoriesQ.data,
    accountsQ.data,
    theme,
    navigate,
    setComposeOpen,
    setCommandOpen,
    setTheme,
    syncMut,
    markAllNotifs,
    toast,
  ])

  return { items, isLoading }
}
