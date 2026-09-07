// =============================================================================
// ScanDialog static metadata — scope + time-preset + processing option tables.
// Kept in a non-component module so the dialog component stays compact.
// Preset values match `ScanConfig['dateRangePreset']` in @/lib/scan/types.
// =============================================================================

import type { ScanScope, ScanProcessing } from '@/lib/scan/types'

export const SCOPE_OPTIONS: { value: ScanScope; label: string; description: string }[] = [
  { value: 'new_only', label: 'New only', description: 'Messages that arrived since the last scan.' },
  { value: 'existing_only', label: 'Existing only', description: 'Backfill already-received messages only.' },
  { value: 'existing_and_future', label: 'Existing & future', description: 'Backfill and continue watching for new mail.' },
  { value: 'rescan', label: 'Rescan', description: 'Re-discover imported messages to reconcile state.' },
  { value: 'full_mailbox', label: 'Full mailbox', description: 'Every message in the mailbox, regardless of state.' },
]

export type ScanPreset = ScanConfigDatePreset
type ScanConfigDatePreset = 'last_7_days' | 'last_30_days' | 'last_90_days' | 'this_year' | 'all_time' | 'custom'

export const TIME_PRESETS: { value: ScanPreset; label: string }[] = [
  { value: 'last_7_days', label: '7d' },
  { value: 'last_30_days', label: '30d' },
  { value: 'last_90_days', label: '90d' },
  { value: 'this_year', label: 'This year' },
  { value: 'all_time', label: 'All' },
  { value: 'custom', label: 'Custom' },
]

export const PROCESSING_OPTIONS: { key: keyof ScanProcessing; label: string; description: string }[] = [
  { key: 'classify', label: 'Classify', description: 'Route each message to a category.' },
  { key: 'conversations', label: 'Conversations', description: 'Build conversation threads.' },
  { key: 'deadlines', label: 'Deadlines', description: 'Extract deadline mentions.' },
  { key: 'actionItems', label: 'Action items', description: 'Detect explicit asks.' },
  { key: 'notifications', label: 'Notifications', description: 'Emit alerts for new mail.' },
  { key: 'aiSummaries', label: 'AI summaries', description: 'Generate AI brief per thread.' },
]
