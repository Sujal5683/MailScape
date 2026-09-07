// Permission policy — server-enforced gate for AI tool execution.
// Confirmation is enforced by the BACKEND, never only by UI (per security spec).

import { TOOL_DEFINITIONS, type ToolRisk } from '@/lib/ai/tools'
import type { AssistantMode } from '@/lib/types'

export interface PermissionDecision {
  allowed: boolean
  requiresConfirmation: boolean
  reason: string
}

export function evaluatePermission(
  toolName: string,
  mode: AssistantMode,
  userExplicitlyConfirmed = false,
): PermissionDecision {
  const def = TOOL_DEFINITIONS.find((t) => t.name === toolName)
  if (!def) {
    return { allowed: false, requiresConfirmation: false, reason: 'Unknown tool' }
  }

  // Sensitive actions always require confirmation.
  if (def.risk === 'SENSITIVE') {
    if (userExplicitlyConfirmed) {
      return { allowed: true, requiresConfirmation: false, reason: 'Confirmed by user' }
    }
    return { allowed: false, requiresConfirmation: true, reason: 'Sensitive action requires confirmation' }
  }

  // Reversible writes.
  if (def.risk === 'REVERSIBLE_WRITE') {
    // In suggest mode, ALL writes require confirmation.
    if (mode === 'suggest') {
      if (userExplicitlyConfirmed) {
        return { allowed: true, requiresConfirmation: false, reason: 'Confirmed by user' }
      }
      return { allowed: false, requiresConfirmation: true, reason: 'Suggest mode requires confirmation for writes' }
    }
    // direct + thinking: execute reversible writes immediately (user requested).
    return { allowed: true, requiresConfirmation: false, reason: 'Reversible write in direct/thinking mode' }
  }

  // READ: always allowed.
  return { allowed: true, requiresConfirmation: false, reason: 'Read-safe' }
}

export function riskOf(toolName: string): ToolRisk | undefined {
  return TOOL_DEFINITIONS.find((t) => t.name === toolName)?.risk
}
