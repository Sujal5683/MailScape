// Message-type metadata shared across conversation UI components (§10).
// Kept here so the timeline and any future message rendering stay in sync.
// Original=neutral, Reply=muted, Follow-up/Reminder=warning,
// Update=primary, Clarification=muted, Final=success.
import type { ConversationMessage } from '@/lib/conversations/types'

export type MessageTypeMeta = { label: string; dot: string; text: string }

export const MESSAGE_TYPE_META: Record<ConversationMessage['messageType'], MessageTypeMeta> = {
  original: { label: 'Original', dot: 'bg-muted-foreground/70', text: 'text-muted-foreground' },
  reply: { label: 'Reply', dot: 'bg-muted-foreground/70', text: 'text-muted-foreground' },
  follow_up: { label: 'Follow-up', dot: 'bg-warning', text: 'text-warning' },
  reminder: { label: 'Reminder', dot: 'bg-warning', text: 'text-warning' },
  update: { label: 'Update', dot: 'bg-primary', text: 'text-primary' },
  clarification: { label: 'Clarification', dot: 'bg-muted-foreground/70', text: 'text-muted-foreground' },
  final: { label: 'Final', dot: 'bg-success', text: 'text-success' },
}
