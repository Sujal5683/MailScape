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

export interface NavSection {
  label: string
  items: NavItem[]
}

// ── Three-section navigation ──────────────────────────────────────────────────
// Section 1: Priority — primary daily-use views (inbox, organized, deadlines)
// Section 2: Intelligence — AI and analytics surfaces
// Section 3: Mailbox — secondary mail folders + settings
export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Priority',
    items: [
      { key: 'inbox',         label: 'Inbox',        icon: Inbox,           description: 'All synchronized emails'          },
      { key: 'organized',     label: 'Organized',    icon: LayoutGrid,      description: 'Categories & sections'            },
      { key: 'deadlines',     label: 'Deadlines',    icon: CalendarClock,   description: 'Tracked deadlines & action items' },
      { key: 'compose',       label: 'Compose',      icon: PenSquare,       description: 'Write & send'                     },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { key: 'dashboard',     label: 'Dashboard',    icon: LayoutDashboard, description: 'Operational overview'             },
      { key: 'assistant',     label: 'AI Assistant', icon: Sparkles,        description: 'Intelligent command center'       },
      { key: 'notifications', label: 'Notifications',icon: Bell,            description: 'Grouped alerts & digests'         },
      { key: 'senders',       label: 'Senders',      icon: Users,           description: 'Sender intelligence'             },
      { key: 'rules',         label: 'Rules',        icon: Workflow,        description: 'Automation & filters'             },
    ],
  },
  {
    label: 'Mailbox',
    items: [
      { key: 'search',        label: 'Search',       icon: Search,          description: 'Structured & semantic search'    },
      { key: 'archived',      label: 'Archive',      icon: Archive,         description: 'Archived emails'                 },
      { key: 'drafts',        label: 'Drafts',       icon: FileEdit,        description: 'Saved drafts'                    },
      { key: 'sent',          label: 'Sent',         icon: Send,            description: 'Sent emails'                     },
      { key: 'spam',          label: 'Spam',         icon: ShieldAlert,     description: 'Spam & suspicious'               },
      { key: 'settings',      label: 'Settings',     icon: Settings,        description: 'Accounts, themes, privacy'       },
    ],
  },
]

// Flat list for backwards-compat (all existing callers use NAV_ITEMS)
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items)

// Compact set for mobile bottom navigation
export const MOBILE_NAV: ViewKey[] = ['inbox', 'organized', 'assistant', 'notifications', 'settings']

export function navItem(key: ViewKey): NavItem {
  return NAV_ITEMS.find((n) => n.key === key) ?? NAV_ITEMS[0]
}
