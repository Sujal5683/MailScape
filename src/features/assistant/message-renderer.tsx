'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Bot,
  Copy,
  Check,
  AlertTriangle,
  Info,
  CalendarClock,
  ListChecks,
  FileText,
  Table2,
  LayoutGrid,
  Wrench,
  CheckCircle2,
  XCircle,
  ExternalLink,
  BarChart3,
  Sparkles,
  Mail,
  CornerDownRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { formatDate, formatRelative, daysUntil } from '@/lib/format'
import { useUIStore } from '@/store/ui-store'
import { useToast } from '@/hooks/use-toast'
import type {
  AssistantMessageDTO,
  AssistantContentBlock,
  SourceRef,
} from '@/lib/types'
import { TypingText } from './typing-text'
import { generateFollowUps } from './follow-ups'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function blocksToText(blocks: AssistantContentBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'text':
        case 'summary':
        case 'warning':
        case 'tool_result':
        case 'confirmation':
          return b.text ?? b.title ?? ''
        case 'table': {
          if (!b.columns || !b.rows) return ''
          const header = b.columns.map((c) => c.label).join(' | ')
          const rows = b.rows.map((r) =>
            b.columns!.map((c) => String(r[c.key] ?? '')).join(' | '),
          )
          return [header, ...rows].join('\n')
        }
        case 'cards':
          return (b.cards ?? [])
            .map((c) => [c.title, c.subtitle, c.value, c.meta].filter(Boolean).join(' — '))
            .join('\n')
        case 'deadlines':
          return (b.deadlines ?? [])
            .map((d) => `${d.title}${d.date ? ' — ' + formatDate(d.date) : ''}`)
            .join('\n')
        case 'action_items':
          return (b.actionItems ?? []).map((a) => a.title).join('\n')
        case 'sources':
          return (b.sources ?? []).map((s) => s.subject ?? s.fromEmail).join('\n')
        case 'chart':
          return (b.data ?? []).map((d) => `${d.date}: ${d.count}`).join('\n')
        default:
          return ''
      }
    })
    .filter(Boolean)
    .join('\n\n')
}

function toneBorderClass(tone?: 'default' | 'success' | 'warning' | 'danger') {
  switch (tone) {
    case 'success':
      return 'border-l-success'
    case 'warning':
      return 'border-l-warning'
    case 'danger':
      return 'border-l-destructive'
    default:
      return 'border-l-border'
  }
}

function toneTextClass(tone?: 'default' | 'success' | 'warning' | 'danger') {
  switch (tone) {
    case 'success':
      return 'text-success'
    case 'warning':
      return 'text-warning'
    case 'danger':
      return 'text-destructive'
    default:
      return 'text-foreground'
  }
}

function isNumericLike(v: unknown): boolean {
  if (typeof v === 'number') return true
  if (typeof v === 'string') return /^-?\d+(\.\d+)?$/.test(v.trim())
  return false
}

// ---------------------------------------------------------------------------
// Sources chips — used both as a per-message footer and inside a sources block
// ---------------------------------------------------------------------------

function SourceChip({ s, index }: { s: SourceRef; index: number }) {
  const navigate = useUIStore((s) => s.navigate)
  return (
    <button
      key={`${s.messageId}-${index}`}
      type="button"
      onClick={() => navigate('inbox', { contextEmailId: s.messageId })}
      className="inline-flex max-w-[260px] items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-accent-foreground"
      title={s.fromEmail}
    >
      <Mail className="h-3 w-3 shrink-0 text-primary" />
      <span className="truncate">{s.subject ?? s.fromEmail}</span>
      {s.receivedAt && (
        <span className="ml-1 shrink-0 text-[10px] text-muted-foreground">
          {formatRelative(s.receivedAt)}
        </span>
      )}
    </button>
  )
}

export function SourcesChips({ sources }: { sources: SourceRef[] }) {
  if (!sources || sources.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {sources.map((s, i) => (
        <SourceChip key={`${s.messageId}-${i}`} s={s} index={i} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Follow-up suggestion chips
// ---------------------------------------------------------------------------

function FollowUpChips({
  prompts,
  onPick,
}: {
  prompts: string[]
  onPick: (prompt: string) => void
}) {
  if (prompts.length === 0) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: 0.1 }}
      className="mt-1 flex flex-wrap gap-1.5 pl-9"
    >
      {prompts.map((p, i) => (
        <button
          key={`${p}-${i}`}
          type="button"
          onClick={() => onPick(p)}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
          title={p}
        >
          <CornerDownRight className="h-3 w-3 shrink-0 text-primary/70" />
          <span className="truncate">{p}</span>
        </button>
      ))}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Individual block renderers
// ---------------------------------------------------------------------------

interface BlockProps {
  block: AssistantContentBlock
  streaming?: boolean
}

function TextBlock({ block, streaming }: BlockProps) {
  const text = block.text ?? ''
  if (streaming && text) {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        <TypingText text={text} />
      </p>
    )
  }
  return <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
}

function SummaryBlock({ block, streaming }: BlockProps) {
  const text = block.text ?? ''
  return (
    <Card className="border-border/60 bg-muted/40 p-3">
      {block.title && (
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          {block.title}
        </div>
      )}
      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {streaming && text ? <TypingText text={text} /> : text}
      </p>
    </Card>
  )
}

function WarningBlock({ block, streaming }: BlockProps) {
  const text = block.text ?? ''
  return (
    <Card className="border border-warning/40 border-l-warning bg-warning/5 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-warning">
        <AlertTriangle className="h-3.5 w-3.5" />
        {block.title ?? 'Warning'}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {streaming && text ? <TypingText text={text} /> : text}
      </p>
    </Card>
  )
}

function ToolResultBlock({ block, streaming }: BlockProps) {
  const text = block.text ?? ''
  return (
    <Card className="border-border/60 bg-muted/30 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Wrench className="h-3.5 w-3.5" />
        {block.title ?? 'Tool result'}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
        {streaming && text ? <TypingText text={text} /> : text}
      </p>
    </Card>
  )
}

function TableBlock({ block }: BlockProps) {
  if (!block.columns || !block.rows) return null
  return (
    <Card className="overflow-hidden border-border/60 p-0">
      {block.title && (
        <div className="flex items-center gap-1.5 border-b border-border/60 bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
          <Table2 className="h-3.5 w-3.5" />
          {block.title}
        </div>
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="sticky top-0 z-10 border-b border-border bg-muted/60 hover:bg-muted/60">
              {block.columns.map((c) => (
                <TableHead key={c.key} className="text-xs">
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {block.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={block.columns.length}
                  className="py-4 text-center text-xs text-muted-foreground"
                >
                  No rows
                </TableCell>
              </TableRow>
            ) : (
              block.rows.map((row, i) => (
                <TableRow
                  key={i}
                  className={cn(
                    'transition-colors',
                    i % 2 === 1 && 'bg-muted/30',
                  )}
                >
                  {block.columns!.map((c) => {
                    const v = row[c.key]
                    return (
                      <TableCell
                        key={c.key}
                        className={cn(
                          'py-2 text-xs',
                          isNumericLike(v) && 'tabular-nums',
                        )}
                      >
                        {String(v ?? '')}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}

function CardsBlock({ block }: BlockProps) {
  if (!block.cards) return null
  return (
    <div>
      {block.title && (
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <LayoutGrid className="h-3.5 w-3.5" />
          {block.title}
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {block.cards.map((c, i) => (
          <Card
            key={i}
            className={cn(
              'border border-l-2 p-3 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-sm',
              toneBorderClass(c.tone),
            )}
          >
            <div className="text-xs font-medium text-muted-foreground">{c.title}</div>
            {c.value && (
              <div
                className={cn(
                  'mt-0.5 text-lg font-semibold tabular-nums',
                  toneTextClass(c.tone),
                )}
              >
                {c.value}
              </div>
            )}
            {c.subtitle && (
              <div className="mt-0.5 text-xs text-muted-foreground">{c.subtitle}</div>
            )}
            {c.meta && (
              <div className="mt-1 text-[10px] text-muted-foreground">{c.meta}</div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

function DeadlinesBlock({ block }: BlockProps) {
  if (!block.deadlines) return null
  return (
    <Card className="border-border/60 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" />
        {block.title ?? 'Deadlines'}
      </div>
      <ul className="space-y-2">
        {block.deadlines.map((d, i) => {
          const days = daysUntil(d.date ?? null)
          const overdue = days !== null && days < 0
          const soon = days !== null && days >= 0 && days <= 3
          return (
            <li key={i} className="flex items-start gap-2 text-sm">
              <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1">{d.title}</span>
              {d.date && (
                <Badge
                  variant="outline"
                  className={cn(
                    'shrink-0 font-normal text-xs tabular-nums',
                    overdue
                      ? 'border-destructive/40 text-destructive'
                      : soon
                        ? 'border-warning/40 text-warning'
                        : 'text-muted-foreground',
                  )}
                >
                  {formatDate(d.date)}
                  {days !== null && (
                    <span className="ml-1 opacity-70">
                      {overdue
                        ? `· ${Math.abs(days)}d overdue`
                        : days === 0
                          ? '· today'
                          : `· ${days}d`}
                    </span>
                  )}
                </Badge>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function ActionItemsBlock({ block }: BlockProps) {
  if (!block.actionItems) return null
  return (
    <Card className="border-border/60 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <ListChecks className="h-3.5 w-3.5" />
        {block.title ?? 'Action items'}
      </div>
      <ul className="space-y-1.5">
        {block.actionItems.map((a, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span
              className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border border-border bg-background"
              aria-hidden="true"
            >
              <Check className="h-2.5 w-2.5 text-transparent" />
            </span>
            <span className="flex-1">{a.title}</span>
            {a.dueAt && (
              <Badge
                variant="outline"
                className="shrink-0 font-normal text-xs tabular-nums text-muted-foreground"
              >
                {formatDate(a.dueAt)}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function SourcesBlock({ block }: BlockProps) {
  if (!block.sources || block.sources.length === 0) return null
  return (
    <Card className="border-border/60 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <ExternalLink className="h-3.5 w-3.5" />
        {block.title ?? 'Sources'}
      </div>
      <SourcesChips sources={block.sources} />
    </Card>
  )
}

function ChartBlock({ block }: BlockProps) {
  if (!block.data || block.data.length === 0) return null
  const max = Math.max(...block.data.map((d) => d.count), 1)
  return (
    <Card className="border-border/60 p-3">
      {block.title && (
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <BarChart3 className="h-3.5 w-3.5" />
          {block.title}
        </div>
      )}
      <div className="flex h-24 items-end gap-1">
        {block.data.map((d, i) => (
          <div
            key={i}
            className="flex flex-1 flex-col items-center justify-end gap-1"
            title={`${d.date}: ${d.count}`}
          >
            <span className="text-[9px] text-muted-foreground tabular-nums">{d.count}</span>
            <div
              className="min-h-[2px] w-full rounded-t-sm bg-primary/70"
              style={{ height: `${(d.count / max) * 100}%` }}
            />
            <span className="w-full truncate text-center text-[9px] text-muted-foreground">
              {d.date}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

interface ConfirmationBlockProps {
  block: AssistantContentBlock
  lastUserContent: string
  onConfirm: (actionId: string, content: string) => void
  streaming?: boolean
}

function ConfirmationBlock({
  block,
  lastUserContent,
  onConfirm,
  streaming,
}: ConfirmationBlockProps) {
  const [dismissed, setDismissed] = React.useState(false)
  if (dismissed) return null

  const actionId =
    (block.meta && typeof block.meta.actionId === 'string' && block.meta.actionId) || null
  const text = block.text ?? block.title ?? 'Confirm this action?'

  return (
    <Card className="border border-warning/40 border-l-warning bg-warning/5 p-3">
      <div className="mb-2 flex items-start gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
          <Info className="h-3.5 w-3.5" />
        </div>
        <p className="flex-1 text-sm leading-relaxed">
          {streaming && text ? <TypingText text={text} /> : text}
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => setDismissed(true)}
        >
          <XCircle className="mr-1 h-3.5 w-3.5" />
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs"
          disabled={!actionId}
          onClick={() => {
            if (actionId) {
              onConfirm(actionId, lastUserContent || 'Confirm')
              setDismissed(true)
            }
          }}
        >
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
          Confirm
        </Button>
      </div>
    </Card>
  )
}

// Summary block: a Card with a Sparkles header + the text.
function SummaryHeaderBlock({ block, streaming }: BlockProps) {
  const text = block.text ?? ''
  return (
    <Card className="border-border/60 bg-card p-3">
      <div className="mb-2 flex items-center gap-1.5 border-b border-border/60 pb-2 text-xs font-medium text-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        {block.title ?? 'Summary'}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {streaming && text ? <TypingText text={text} /> : text}
      </p>
    </Card>
  )
}

function renderBlock(
  block: AssistantContentBlock,
  lastUserContent: string,
  onConfirm: (actionId: string, content: string) => void,
  key: number,
  streaming?: boolean,
) {
  const props: BlockProps = { block, streaming }
  switch (block.type) {
    case 'text':
      return <TextBlock key={key} {...props} />
    case 'summary':
      return <SummaryHeaderBlock key={key} {...props} />
    case 'warning':
      return <WarningBlock key={key} {...props} />
    case 'tool_result':
      return <ToolResultBlock key={key} {...props} />
    case 'table':
      return <TableBlock key={key} {...props} />
    case 'cards':
      return <CardsBlock key={key} {...props} />
    case 'deadlines':
      return <DeadlinesBlock key={key} {...props} />
    case 'action_items':
      return <ActionItemsBlock key={key} {...props} />
    case 'sources':
      return <SourcesBlock key={key} {...props} />
    case 'confirmation':
      return (
        <ConfirmationBlock
          key={key}
          block={block}
          lastUserContent={lastUserContent}
          onConfirm={onConfirm}
          streaming={streaming}
        />
      )
    case 'chart':
      return <ChartBlock key={key} {...props} />
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Main message renderer
// ---------------------------------------------------------------------------

export interface MessageRendererProps {
  message: AssistantMessageDTO
  lastUserContent: string
  onConfirm: (actionId: string, content: string) => void
  streaming?: boolean
  onStreamComplete?: (id: string) => void
  onPickFollowUp?: (prompt: string) => void
}

export function MessageRenderer({
  message,
  lastUserContent,
  onConfirm,
  streaming = false,
  onStreamComplete,
  onPickFollowUp,
}: MessageRendererProps) {
  const { toast } = useToast()
  const [copied, setCopied] = React.useState(false)
  const isUser = message.role === 'user'

  // Identify the indices of blocks that will be "typed out" while streaming.
  // We only type text-bearing blocks; structured blocks (tables/cards/etc.)
  // render immediately even while streaming=true.
  const textBlockIndices = React.useMemo(() => {
    const idxs: number[] = []
    message.content.forEach((b, i) => {
      if (
        b.type === 'text' ||
        b.type === 'summary' ||
        b.type === 'warning' ||
        b.type === 'tool_result' ||
        b.type === 'confirmation'
      ) {
        if (b.text) idxs.push(i)
      }
    })
    return idxs
  }, [message.content])

  // Streaming lifecycle: when streaming starts, schedule stream-completion
  // after the typing window (capped at 1.5s per TypingText). If the message
  // has no text blocks at all, signal completion immediately so the
  // streaming state clears promptly.
  React.useEffect(() => {
    if (!streaming) return
    if (textBlockIndices.length === 0) {
      onStreamComplete?.(message.id)
      return
    }
    const t = window.setTimeout(() => {
      onStreamComplete?.(message.id)
    }, 1600)
    return () => window.clearTimeout(t)
  }, [streaming, textBlockIndices.length, onStreamComplete, message.id])

  function handleCopy() {
    const text = blocksToText(message.content)
    if (!text) {
      toast({ title: 'Nothing to copy' })
      return
    }
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      toast({ title: 'Clipboard unavailable' })
      return
    }
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true)
        toast({ title: 'Copied to clipboard' })
        window.setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => toast({ title: 'Copy failed' }))
  }

  if (isUser) {
    const text =
      message.content.map((b) => b.text).filter(Boolean).join('\n') || '(empty)'
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
          {text}
        </div>
      </div>
    )
  }

  const followUps =
    onPickFollowUp && !streaming
      ? generateFollowUps(message.content, message.sources)
      : []

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Bot className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-2 rounded-2xl rounded-tl-md border border-border bg-card p-3">
            {message.content.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">(no content)</p>
            ) : (
              message.content.map((b, i) =>
                renderBlock(
                  b,
                  lastUserContent,
                  onConfirm,
                  i,
                  streaming,
                ),
              )
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="mr-1 h-3 w-3" />
              ) : (
                <Copy className="mr-1 h-3 w-3" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            {message.sources && message.sources.length > 0 && (
              <SourcesChips sources={message.sources} />
            )}
          </div>
        </div>
      </div>
      {followUps.length > 0 && onPickFollowUp && (
        <FollowUpChips prompts={followUps} onPick={onPickFollowUp} />
      )}
    </div>
  )
}

// Subtle motion wrapper for message entrance
export function MessageMotion({
  children,
  delay = 0,
}: {
  children: React.ReactNode
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay }}
    >
      {children}
    </motion.div>
  )
}

// Collapsible code-like summary (used by action-log v2)
export function CollapsibleCode({
  label,
  text,
  emptyLabel = '—',
}: {
  label: string
  text: string
  emptyLabel?: string
}) {
  const [open, setOpen] = React.useState(false)
  if (!text) {
    return (
      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">{label}:</span>{' '}
        {emptyLabel}
      </div>
    )
  }
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="font-medium text-foreground/80">{label}:</span>
          <span className="ml-1 truncate font-mono text-[11px]">{text}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1">
        <pre className="max-h-48 overflow-auto rounded bg-muted/60 p-2 font-mono text-[11px] text-foreground/80">
          {text}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  )
}
