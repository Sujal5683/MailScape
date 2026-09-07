import type { LucideIcon } from 'lucide-react'
import {
  Inbox, LayoutGrid, LayoutDashboard, Sparkles, Bell, Users, Workflow,
  PenSquare, Search, Settings, CalendarClock, Archive,
  FileEdit, Send, ShieldAlert,
} from 'lucide-react'
import type { ViewKey } from '@/store/ui-store'

export interface NavItem {
  key: ViewKey
  label: string
  icon: LucideIcon
  description: string
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'inbox', label: 'Inbox', icon: Inbox, description: 'All synchronized emails' },
  { key: 'organized', label: 'Organized', icon: LayoutGrid, description: 'Institutional sections' },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Operational overview' },
  { key: 'deadlines', label: 'Deadlines', icon: CalendarClock, description: 'Tracked deadlines & action items' },
  { key: 'archived', label: 'Archive', icon: Archive, description: 'Archived & trashed emails' },
  { key: 'drafts', label: 'Drafts', icon: FileEdit, description: 'Saved drafts' },
  { key: 'sent', label: 'Sent', icon: Send, description: 'Sent emails' },
  { key: 'spam', label: 'Spam', icon: ShieldAlert, description: 'Spam & suspicious' },
  { key: 'assistant', label: 'AI Assistant', icon: Sparkles, description: 'Intelligent command center' },
  { key: 'notifications', label: 'Notifications', icon: Bell, description: 'Grouped alerts' },
  { key: 'senders', label: 'Senders', icon: Users, description: 'Sender intelligence' },
  { key: 'rules', label: 'Rules', icon: Workflow, description: 'Automation & rules' },
  { key: 'compose', label: 'Compose', icon: PenSquare, description: 'Write & send' },
  { key: 'search', label: 'Search', icon: Search, description: 'Structured & natural-language' },
  { key: 'settings', label: 'Settings', icon: Settings, description: 'Accounts, themes, privacy' },
]

// Compact set for mobile bottom navigation.
export const MOBILE_NAV: ViewKey[] = ['inbox', 'organized', 'assistant', 'notifications', 'settings']

export function navItem(key: ViewKey): NavItem {
  return NAV_ITEMS.find((n) => n.key === key) ?? NAV_ITEMS[0]
}
