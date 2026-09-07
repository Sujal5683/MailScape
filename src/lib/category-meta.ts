// Maps category color/icon names to render-friendly values.
// Centralized so all views render categories consistently.

import {
  Briefcase, GraduationCap, User, FlaskConical, Heart, Stethoscope,
  Home, Calendar, Wallet, Inbox, Folder, type LucideIcon,
} from 'lucide-react'

export const CATEGORY_COLOR_CLASS: Record<string, string> = {
  amber: 'cat-amber',
  blue: 'cat-blue',
  violet: 'cat-violet',
  teal: 'cat-teal',
  rose: 'cat-rose',
  red: 'cat-red',
  orange: 'cat-orange',
  fuchsia: 'cat-fuchsia',
  green: 'cat-green',
  slate: 'cat-slate',
}

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  'graduation-cap': GraduationCap,
  user: User,
  'flask-conical': FlaskConical,
  heart: Heart,
  stethoscope: Stethoscope,
  home: Home,
  calendar: Calendar,
  wallet: Wallet,
  inbox: Inbox,
  folder: Folder,
}

export function colorClass(color: string): string {
  return CATEGORY_COLOR_CLASS[color] ?? 'cat-slate'
}

export function iconFor(icon: string): LucideIcon {
  return CATEGORY_ICONS[icon] ?? Folder
}

export const CATEGORY_COLORS = ['amber', 'blue', 'violet', 'teal', 'rose', 'red', 'orange', 'fuchsia', 'green', 'slate']
export const CATEGORY_ICONS_LIST = Object.keys(CATEGORY_ICONS)
