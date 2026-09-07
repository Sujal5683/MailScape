'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Menu,
  PanelRight,
  Sparkles,
  Send,
  Mic,
  MicOff,
  Paperclip,
  Volume2,
  VolumeX,
  X,
  FileText,
  MessageSquare,
  Zap,
  Brain,
  Lightbulb,
  ListTodo,
  AlertCircle,
  Download,
  Trash2,
  MoreVertical,
  Archive,
  CalendarClock,
  Inbox as InboxIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui-store'
import { useToast } from '@/hooks/use-toast'
import {
  useConversations,
  useConversationMessages,
  useSendMessage,
  useCreateConversation,
  useExportConversation,
} from '@/hooks/use-queries'
import { formatRelative, formatBytes } from '@/lib/format'
import type {
  AssistantMode,
  AssistantConversationDTO,
} from '@/lib/types'
import { MessageRenderer, MessageMotion } from './message-renderer'
import { ActionLog } from './action-log'
import { useStreamingMessage } from './typing-text'
import { ConversationContextMenu } from './conversation-context-menu'
import { RenameDialog } from './rename-dialog'
import { ThreePanelLayout } from '@/components/layout/master-detail-layout'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type Attachment = { filename: string; mimeType: string; size: number }
type Mode = AssistantMode

interface SuggestedPrompt {
  icon: typeof FileText
  label: string
  description: string
}

const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  {
    icon: FileText,
    label: 'Summarize my placement emails',
    description: 'Get a concise brief of recent placement-related threads',
  },
  {
    icon: CalendarClock,
    label: 'Find deadlines this week',
    description: 'Surface upcoming deadlines extracted from your inbox',
  },
  {
    icon: Zap,
    label: 'Create a rule for finance emails',
    description: 'Auto-organize finance communications into a section',
  },
  {
    icon: Lightbulb,
    label: 'What needs my attention?',
    description: 'A prioritized snapshot of important unread emails',
  },
]

const MODE_OPTIONS: {
  value: Mode
  label: string
  icon: typeof Zap
}[] = [
  { value: 'direct', label: 'Direct', icon: Zap },
  { value: 'thinking', label: 'Thinking', icon: Brain },
  { value: 'suggest', label: 'Suggest', icon: Lightbulb },
]

const CHAR_COUNT_THRESHOLD = 500

// Minimal type for the Web Speech API (feature-detected at runtime)
type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: (e: { results: { 0: { transcript: string } }[] }) => void
  onerror: () => void
  onend: () => void
  start: () => void
  stop: () => void
}

// ---------------------------------------------------------------------------
// Conversation rail
// ---------------------------------------------------------------------------

interface ConversationRailProps {
  conversations: AssistantConversationDTO[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onRename: (c: AssistantConversationDTO) => void
  onDeleted: (id: string) => void
  isLoading: boolean
  isCreating: boolean
  showArchived: boolean
  onToggleArchived: (next: boolean) => void
  archivedCount: number
}

function ConversationRail({
  conversations,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDeleted,
  isLoading,
  isCreating,
  showArchived,
  onToggleArchived,
  archivedCount,
}: ConversationRailProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-border p-3">
        <Button
          type="button"
          onClick={onNew}
          className="w-full"
          size="sm"
          disabled={isCreating}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {isCreating ? 'Creating…' : 'New conversation'}
        </Button>
        <button
          type="button"
          onClick={() => onToggleArchived(!showArchived)}
          aria-pressed={showArchived}
          className={cn(
            'flex w-full items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] transition-colors',
            showArchived
              ? 'border-border bg-accent text-foreground'
              : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <Archive className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">
            {showArchived ? 'Showing archived' : 'Show archived'}
          </span>
          {archivedCount > 0 && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {archivedCount}
            </Badge>
          )}
        </button>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-md bg-muted"
              />
            ))}
          {!isLoading && conversations.length === 0 && (
            <div className="p-4 text-center text-xs text-muted-foreground">
              {showArchived ? 'No archived conversations.' : 'No conversations yet.'}
            </div>
          )}
          {conversations.map((c) => {
            const isActive = c.id === activeId
            const isArchived = !!c.archived
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(c.id)
                  }
                }}
                className={cn(
                  'group relative w-full cursor-pointer rounded-md border border-transparent p-2.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive && 'border-border bg-accent',
                  isArchived && 'opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium">
                    {isArchived && (
                      <Archive className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Archived" />
                    )}
                    <span className="truncate">
                      {c.title || 'New conversation'}
                    </span>
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelative(c.createdAt)}
                    </span>
                    {/* ⋯ trigger: always visible on touch (mobile has no hover),
                        opacity-driven on lg+ so it appears on row hover/focus. */}
                    <div className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                      <ConversationContextMenu
                        conversation={c}
                        onRename={onRename}
                        onDeleted={onDeleted}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <MessageSquare className="h-3 w-3" />
                  <span>
                    {c.messageCount} {c.messageCount === 1 ? 'message' : 'messages'}
                  </span>
                  <Badge
                    variant="outline"
                    className="px-1 py-0 text-[9px] capitalize"
                  >
                    {c.mode}
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mode selector (segmented control)
// ---------------------------------------------------------------------------

function ModeSelector({
  mode,
  onChange,
}: {
  mode: Mode
  onChange: (m: Mode) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Assistant mode"
      className="inline-flex items-center rounded-md border border-border bg-muted/40 p-0.5"
    >
      {MODE_OPTIONS.map((m) => {
        const Icon = m.icon
        const active = mode === m.value
        return (
          <button
            key={m.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(m.value)}
            className={cn(
              'inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3 w-3" />
            <span className="hidden sm:inline">{m.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Thinking indicator — 3 animated dots in a primary-tinted bubble
// ---------------------------------------------------------------------------

function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2.5"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="rounded-2xl rounded-tl-md border border-primary/20 bg-primary/5 px-3.5 py-2.5">
        <div className="flex items-center gap-1.5" aria-label="Assistant is thinking">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70 [animation-delay:-0.2s] [animation-duration:0.9s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70 [animation-delay:-0.1s] [animation-duration:0.9s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70 [animation-duration:0.9s]" />
        </div>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Welcome / empty state (v2)
// ---------------------------------------------------------------------------

function WelcomeCard({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl"
      >
        <div className="mb-4 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-7 w-7" />
          </div>
        </div>
        <h2 className="text-center text-xl font-semibold">AI Assistant</h2>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Your Gmail command center. Ask anything, take actions, and let the
          assistant keep your inbox organized.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SUGGESTED_PROMPTS.map((p) => {
            const Icon = p.icon
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onPick(p.label)}
                className="group flex items-start gap-3 rounded-lg border border-border bg-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {p.description}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}

// Empty-conversation placeholder — shown when a conversation exists but has
// no messages yet.
function EmptyConversationPlaceholder() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full flex-col items-center justify-center p-6 text-center"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Sparkles className="h-6 w-6" />
      </div>
      <p className="text-sm text-muted-foreground">Ask anything…</p>
      <p className="mt-1 text-xs text-muted-foreground/70">
        Your conversation is ready. Type a question below to begin.
      </p>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Auto-grow textarea hook
// ---------------------------------------------------------------------------

function useAutoGrowTextarea(
  value: string,
  maxHeightPx = 128,
): React.RefObject<HTMLTextAreaElement | null> {
  const ref = React.useRef<HTMLTextAreaElement | null>(null)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, maxHeightPx)}px`
  }, [value, maxHeightPx])
  return ref
}

// ---------------------------------------------------------------------------
// Floating quick-action buttons (desktop only)
// ---------------------------------------------------------------------------

interface FabGroupProps {
  onNew: () => void
  onExport: () => void
  onClear: () => void
  isExporting: boolean
}

function FabGroup({ onNew, onExport, onClear, isExporting }: FabGroupProps) {
  const actions: {
    icon: typeof Plus
    label: string
    onClick: () => void
    disabled?: boolean
    busy?: boolean
    tone?: 'default' | 'danger'
  }[] = [
    { icon: Plus, label: 'New chat', onClick: onNew },
    {
      icon: Download,
      label: 'Export',
      onClick: onExport,
      disabled: isExporting,
      busy: isExporting,
    },
    { icon: Trash2, label: 'Clear', onClick: onClear, tone: 'danger' },
  ]
  return (
    <div className="pointer-events-none absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-2 lg:flex">
      {actions.map((a) => {
        const Icon = a.icon
        return (
          <Tooltip key={a.label} delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={a.disabled}
                onClick={a.onClick}
                aria-label={a.label}
                className={cn(
                  'pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border bg-card/95 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50',
                  a.tone === 'danger'
                    ? 'border-destructive/30 text-destructive hover:bg-destructive/5'
                    : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className={cn('h-4 w-4', a.busy && 'animate-pulse')} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">{a.label}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mobile overflow menu (replaces FABs on mobile)
// ---------------------------------------------------------------------------

interface MobileOverflowProps {
  onNew: () => void
  onExport: () => void
  onClear: () => void
  isExporting: boolean
}

function MobileOverflow({
  onNew,
  onExport,
  onClear,
  isExporting,
}: MobileOverflowProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 lg:hidden"
          aria-label="More actions"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={onNew}>
          <Plus className="mr-2 h-4 w-4" /> New chat
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onExport} disabled={isExporting}>
          <Download className="mr-2 h-4 w-4" /> Export PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onClear} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" /> Clear conversation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ---------------------------------------------------------------------------
// Clear-conversation confirmation dialog
// ---------------------------------------------------------------------------

function ClearConversationDialog({
  open,
  onOpenChange,
  onConfirm,
  isClearing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isClearing: boolean
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear this conversation?</AlertDialogTitle>
          <AlertDialogDescription>
            This will clear the visible messages from this view. The
            conversation history remains stored on the server. This action
            cannot be undone from the UI.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isClearing}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isClearing ? 'Clearing…' : 'Clear'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function AssistantView() {
  const { toast } = useToast()
  const navigate = useUIStore((s) => s.navigate)
  const setContext = useUIStore((s) => s.setContext)
  const contextEmailId = useUIStore((s) => s.contextEmailId)

  // Conversation state
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [railOpen, setRailOpen] = React.useState(false)
  const [actionsOpen, setActionsOpen] = React.useState(false)
  const [clearOpen, setClearOpen] = React.useState(false)
  const [isClearing, setIsClearing] = React.useState(false)
  // Per-conversation management state — rename dialog target + archived filter.
  const [renamingId, setRenamingId] = React.useState<string | null>(null)
  const [showArchived, setShowArchived] = React.useState(false)

  // Conversation queries
  const { data: conversations, isLoading: convsLoading } = useConversations({
    includeArchived: showArchived,
  })
  const { data: messages, isLoading: msgsLoading } =
    useConversationMessages(activeId)
  const sendMessage = useSendMessage()
  const createConversation = useCreateConversation()
  const exportConv = useExportConversation()

  // Streaming state — which assistant message is currently being typed out.
  const { streamingId, isStreaming, markComplete } = useStreamingMessage(
    messages,
    sendMessage.isPending,
  )

  // Mode + speaker
  const [mode, setMode] = React.useState<Mode>('direct')
  const [syncedFor, setSyncedFor] = React.useState<string | null>(null)
  const [speakerMode, setSpeakerMode] = React.useState(false)

  // Input state
  const [input, setInput] = React.useState('')
  const [attachments, setAttachments] = React.useState<Attachment[]>([])
  const [listening, setListening] = React.useState(false)
  const textareaRef = useAutoGrowTextarea(input)

  // Email context prefill — during-render adjustment (lint-safe alternative
  // to setState-in-effect). Tracks the contextEmailId we've already consumed.
  const [prefilledFor, setPrefilledFor] = React.useState<string | null>(
    contextEmailId,
  )
  const [emailContext, setEmailContext] = React.useState<string | null>(
    contextEmailId,
  )
  if (contextEmailId !== prefilledFor) {
    setPrefilledFor(contextEmailId)
    setEmailContext(contextEmailId)
    if (contextEmailId) {
      setInput('Summarize this email')
    }
  }

  // Sync local mode to the active conversation's persisted mode whenever the
  // active conversation changes.
  const activeConversation =
    conversations?.find((c) => c.id === activeId) ?? null
  if (activeConversation && activeConversation.id !== syncedFor) {
    setSyncedFor(activeConversation.id)
    setMode(activeConversation.mode)
  }

  // Refs
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null)
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const lastSpokenIdRef = React.useRef<string | null>(null)

  // Track the most recent user-message content (used by confirmation
  // re-send). Pure derivation from the messages array — no memo needed.
  let lastUserContent = ''
  if (messages && messages.length > 0) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.role === 'user') {
        lastUserContent = m.content
          .map((b) => b.text)
          .filter(Boolean)
          .join(' ')
        break
      }
    }
  }

  // Auto-scroll to bottom when new messages arrive or streaming progresses.
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingId])

  // Speaker mode: speak new assistant text responses (cancel previous).
  React.useEffect(() => {
    if (!messages || messages.length === 0) return
    const last = messages[messages.length - 1]
    if (last.role !== 'assistant') return
    if (last.id === lastSpokenIdRef.current) return
    lastSpokenIdRef.current = last.id
    if (!speakerMode) return
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    try {
      window.speechSynthesis.cancel()
      const text = last.content
        .map((b) => b.text ?? '')
        .filter(Boolean)
        .join(' ')
      if (text) {
        const utter = new SpeechSynthesisUtterance(text)
        window.speechSynthesis.speak(utter)
      }
    } catch {
      // ignore speech errors
    }
  }, [messages, speakerMode])

  // Cancel any ongoing speech when speaker mode is turned off
  React.useEffect(() => {
    if (!speakerMode && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
      } catch {
        // ignore
      }
    }
  }, [speakerMode])

  // Cleanup speech + recognition on unmount
  React.useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel()
        } catch {
          // ignore
        }
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // ignore
        }
      }
    }
  }, [])

  // --- actions ---

  async function handleNewConversation() {
    try {
      const conv = await createConversation.mutateAsync({ mode: 'direct' })
      setActiveId(conv.id)
      setRailOpen(false)
    } catch {
      toast({
        title: 'Failed to create conversation',
        description: 'Please try again.',
      })
    }
  }

  async function handlePickPrompt(prompt: string) {
    try {
      const conv = await createConversation.mutateAsync({ mode: 'direct' })
      setActiveId(conv.id)
      await sendMessage.mutateAsync({
        conversationId: conv.id,
        content: prompt,
        mode: 'direct',
      })
    } catch {
      toast({
        title: 'Failed to start conversation',
        description: 'Please try again.',
      })
    }
  }

  async function handleSend(
    contentOverride?: string,
    confirmedActionId?: string,
  ) {
    const content = (contentOverride ?? input).trim()
    if (!content || !activeId) return
    setInput('')
    setAttachments([])
    try {
      await sendMessage.mutateAsync({
        conversationId: activeId,
        content,
        mode,
        ...(confirmedActionId ? { confirmedActionId } : {}),
      })
    } catch {
      toast({
        title: 'Failed to send message',
        description: 'Please try again.',
      })
      // Restore input on failure so the user can retry.
      setInput(content)
    }
  }

  function handleConfirm(actionId: string, content: string) {
    if (!activeId) return
    void handleSend(content, actionId)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  function handleExport() {
    if (!activeId) return
    exportConv.mutate(activeId, {
      onSuccess: () =>
        toast({
          title: 'Opening printable view',
          description: 'Use Ctrl+P (or ⌘+P) to save as PDF.',
        }),
      onError: () =>
        toast({
          title: 'Export failed',
          description: 'Could not open the printable view.',
        }),
    })
  }

  function handleClear() {
    if (!activeId) return
    setIsClearing(true)
    // Cosmetic clear: just deselect the conversation. The history remains
    // stored on the server. This matches the spec's "cosmetic" requirement.
    setActiveId(null)
    setRailOpen(false)
    setIsClearing(false)
    setClearOpen(false)
    toast({
      title: 'Conversation cleared from view',
      description: 'Your conversation history is still saved.',
    })
  }

  function toggleMic() {
    if (typeof window === 'undefined') return
    const SR =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition
    if (!SR) {
      toast({
        title: 'Voice input not supported',
        description: 'Your browser does not support the Web Speech API.',
      })
      return
    }
    if (listening) {
      try {
        recognitionRef.current?.stop()
      } catch {
        // ignore
      }
      return
    }
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.onresult = (e) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript
      }
      setInput(text)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    try {
      rec.start()
    } catch {
      toast({ title: 'Could not start voice input' })
      return
    }
    recognitionRef.current = rec
    setListening(true)
  }

  function handleAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const newAttachments: Attachment[] = files.map((f) => ({
      filename: f.name,
      mimeType: f.type || 'application/octet-stream',
      size: f.size,
    }))
    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments])
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeAttachment(i: number) {
    setAttachments((prev) => prev.filter((_, idx) => idx !== i))
  }

  function clearEmailContext() {
    setEmailContext(null)
    setContext({ contextEmailId: null })
  }

  const charCount = input.length
  const showCharCount = charCount > CHAR_COUNT_THRESHOLD
  const canSend = input.trim().length > 0 && !sendMessage.isPending
  const isEmptyConversation =
    !!activeConversation && !msgsLoading && (!messages || messages.length === 0)

  // When the rail is in "show archived" mode, count the archived entries for
  // the badge. When not in that mode we don't have the data, so we render 0
  // (the badge is hidden by the rail when count === 0).
  const archivedCount = (conversations ?? []).filter((c) => c.archived).length

  // The conversation currently targeted by the rename dialog (resolved from
  // the latest conversations snapshot so the dialog shows fresh data even
  // after a refetch).
  const renamingConversation =
    conversations?.find((c) => c.id === renamingId) ?? null

  // --- render ---

  const rail = (
    <ConversationRail
      conversations={conversations ?? []}
      activeId={activeId}
      onSelect={(id) => {
        setActiveId(id)
        setRailOpen(false)
      }}
      onNew={handleNewConversation}
      onRename={(c) => setRenamingId(c.id)}
      onDeleted={(id) => {
        if (activeId === id) setActiveId(null)
      }}
      isLoading={convsLoading}
      isCreating={createConversation.isPending}
      showArchived={showArchived}
      onToggleArchived={setShowArchived}
      archivedCount={showArchived ? archivedCount : 0}
    />
  )

  return (
    <div className="flex h-full bg-background">
      <ThreePanelLayout
        storageKey="assistant-layout"
        left={
          <>
            <div className="border-b border-border px-3 py-3">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" /> Assistant
              </h2>
            </div>
            {rail}
          </>
        }
        center={
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {activeConversation ? (
          <>
            {/* Header */}
            <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 lg:hidden"
                onClick={() => setRailOpen(true)}
                aria-label="Open conversations"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-medium">
                  {activeConversation.title || 'New conversation'}
                </h2>
                <p className="text-[10px] text-muted-foreground">
                  {activeConversation.messageCount}{' '}
                  {activeConversation.messageCount === 1 ? 'message' : 'messages'}
                </p>
              </div>
              <ModeSelector mode={mode} onChange={setMode} />
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn('h-8 w-8', speakerMode && 'text-primary')}
                    onClick={() => setSpeakerMode((s) => !s)}
                    aria-pressed={speakerMode}
                    aria-label={`Toggle speaker mode, currently ${speakerMode ? 'on' : 'off'}`}
                  >
                    {speakerMode ? (
                      <Volume2 className="h-4 w-4" />
                    ) : (
                      <VolumeX className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Speaker mode {speakerMode ? 'on' : 'off'}
                </TooltipContent>
              </Tooltip>
              {/* Export button (desktop only on header; mobile uses overflow) */}
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hidden h-8 w-8 lg:inline-flex"
                    onClick={handleExport}
                    disabled={exportConv.isPending}
                    aria-label="Export conversation as PDF"
                  >
                    <Download
                      className={cn(
                        'h-4 w-4',
                        exportConv.isPending && 'animate-pulse',
                      )}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export as PDF</TooltipContent>
              </Tooltip>
              <Button
                variant="outline"
                size="sm"
                className="h-8 lg:hidden"
                onClick={() => setActionsOpen(true)}
              >
                <PanelRight className="mr-1 h-4 w-4" /> Actions
              </Button>
              <MobileOverflow
                onNew={handleNewConversation}
                onExport={handleExport}
                onClear={() => setClearOpen(true)}
                isExporting={exportConv.isPending}
              />
            </header>

            {/* Floating quick-action group (desktop) */}
            <FabGroup
              onNew={handleNewConversation}
              onExport={handleExport}
              onClear={() => setClearOpen(true)}
              isExporting={exportConv.isPending}
            />

            {/* Email context banner */}
            {emailContext && (
              <div className="flex items-center gap-2 border-b border-warning/30 bg-warning/5 px-3 py-1.5 text-xs">
                <FileText className="h-3.5 w-3.5 text-warning" />
                <span className="text-foreground">
                  Email referenced — your prompt will summarize it.
                </span>
                <button
                  type="button"
                  className="ml-auto text-muted-foreground hover:text-foreground"
                  onClick={clearEmailContext}
                  aria-label="Clear email reference"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="mx-auto max-w-3xl space-y-4 p-4 pb-20 md:pb-6">
                  {msgsLoading && (
                    <div className="space-y-3">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-24 animate-pulse rounded-lg bg-muted"
                        />
                      ))}
                    </div>
                  )}
                  {!msgsLoading && isEmptyConversation && (
                    <EmptyConversationPlaceholder />
                  )}
                  {!msgsLoading &&
                    messages &&
                    messages.map((m, i) => (
                      <MessageMotion key={m.id} delay={Math.min(i * 0.02, 0.1)}>
                        <MessageRenderer
                          message={m}
                          lastUserContent={lastUserContent}
                          onConfirm={handleConfirm}
                          streaming={isStreaming(m.id)}
                          onStreamComplete={markComplete}
                          onPickFollowUp={(prompt) => void handleSend(prompt)}
                        />
                      </MessageMotion>
                    ))}
                  <AnimatePresence>
                    {sendMessage.isPending && <ThinkingIndicator />}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </div>

            {/* Input bar */}
            <div className="border-t border-border p-3">
              {attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {attachments.map((a, i) => (
                    <span
                      key={`${a.filename}-${i}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
                    >
                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                      <span className="max-w-[120px] truncate">{a.filename}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatBytes(a.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Remove attachment ${a.filename}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleAttach}
                  aria-label="Attach files"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'relative h-9 w-9 shrink-0',
                    listening && 'text-destructive',
                  )}
                  onClick={toggleMic}
                  aria-label={listening ? 'Stop voice input' : 'Start voice input'}
                  aria-pressed={listening}
                >
                  {listening ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                  {listening && (
                    <span
                      className="absolute inset-0 animate-ping rounded-full bg-destructive/30"
                      aria-hidden="true"
                    />
                  )}
                </Button>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      listening
                        ? 'Listening…'
                        : 'Message the assistant…  (Enter to send, Shift+Enter for newline)'
                    }
                    rows={1}
                    className="min-h-[40px] max-h-32 resize-none"
                    aria-label="Message input"
                  />
                  <div className="mt-1 flex h-4 items-center justify-between text-[10px] text-muted-foreground">
                    <span>Enter to send · Shift+Enter for newline</span>
                    {showCharCount && (
                      <span
                        className={cn(
                          'tabular-nums',
                          charCount > 2000 && 'text-destructive',
                        )}
                      >
                        {charCount} chars
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => handleSend()}
                  disabled={!canSend}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {listening && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-destructive">
                  <span className="flex h-2 w-2 animate-pulse rounded-full bg-destructive" />
                  Listening… speak now.
                </div>
              )}
            </div>

            <ClearConversationDialog
              open={clearOpen}
              onOpenChange={setClearOpen}
              onConfirm={handleClear}
              isClearing={isClearing}
            />
          </>
        ) : (
          <WelcomeCard onPick={handlePickPrompt} />
        )}
      </main>
        }
        right={
          <>
            <div className="flex items-center justify-between border-b border-border px-3 py-3">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <ListTodo className="h-4 w-4" /> Actions
              </h2>
            </div>
            <div className="flex-1 overflow-hidden">
              <ActionLog conversationId={activeId} />
            </div>
          </>
        }
      />

      {/* Mobile rail sheet */}
      <Sheet open={railOpen} onOpenChange={setRailOpen}>
        <SheetContent side="left" className="w-72 p-0 sm:max-w-sm">
          <SheetHeader className="border-b border-border px-3 py-3">
            <SheetTitle className="flex items-center gap-1.5 text-sm">
              <Sparkles className="h-4 w-4 text-primary" /> Assistant
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">{rail}</div>
        </SheetContent>
      </Sheet>

      {/* Mobile actions sheet */}
      <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
        <SheetContent side="right" className="w-80 p-0 sm:max-w-sm">
          <SheetHeader className="border-b border-border px-3 py-3">
            <SheetTitle className="flex items-center gap-1.5 text-sm">
              <ListTodo className="h-4 w-4" /> Actions
            </SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100%-3.5rem)] flex-1 overflow-hidden">
            <ActionLog conversationId={activeId} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Rename dialog — controlled by the rail's per-row ⋯ menu. */}
      <RenameDialog
        conversation={renamingConversation}
        onOpenChange={(open) => {
          if (!open) setRenamingId(null)
        }}
      />
    </div>
  )
}
