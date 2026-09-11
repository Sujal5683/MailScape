'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  useEmail,
  useMarkRead,
  useStarEmail,
  useMarkImportant,
  useSnoozeEmail,
  useThread,
  useClassificationResults,
  useCategories,
  useSmartReplies,
  useEmailConversation,
} from '@/hooks/use-queries'
import { ConversationPanel } from '@/features/conversations/conversation-panel'
import { SnoozeDialog } from './snooze-dialog'
import { isActivelySnoozed } from './snoozed-indicator'
import { SmartRepliesPanel } from './smart-replies-panel'
import {
  EmailHeaderSkeleton,
  EmailBodySkeleton,
  AttachmentSkeleton,
} from '@/components/common/skeletons'
import { ErrorState } from '@/components/common/states'
import { colorClass } from '@/lib/category-meta'
import { CategoryIcon } from '@/components/common/category-icon'
import { cn } from '@/lib/utils'
import { formatDateTime, formatBytes, formatRelative } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PaneScroll } from '@/components/ui/pane-scroll'
import { Separator } from '@/components/ui/separator'
import { SleekSeparator } from '@/components/common/separator'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import type { LucideIcon } from 'lucide-react'
import {
  Star,
  Mail,
  MailOpen,
  Archive,
  Reply,
  ReplyAll,
  Forward,
  ExternalLink,
  Sparkles,
  Paperclip,
  Link as LinkIcon,
  ChevronRight,
  ArrowLeft,
  ShieldCheck,
  Clock,
  Download,
  Eye,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileType,
  File,
  ChevronDown,
  CalendarPlus,
  FolderInput,
  Keyboard,
  AtSign,
  ArrowUpDown,
  Wand2,
} from 'lucide-react'
import { useUIStore } from '@/store/ui-store'
import { toast } from 'sonner'
import type { EmailAttachmentMeta } from '@/lib/types'

// ---------------------------------------------------------------------------
// Exported component — signature preserved for inbox-view / search-view /
// organized/category-detail. Two new optional props added (default no-op).
// ---------------------------------------------------------------------------
export function EmailDetail({
  emailId,
  onBack,
  onSelectThreadEmail,
  onNavigate,
}: {
  emailId: string | null
  onBack?: () => void
  onSelectThreadEmail?: (id: string) => void
  onNavigate?: (direction: 'prev' | 'next') => void
}) {
  const { data: email, isLoading, error, refetch } = useEmail(emailId)

  if (!emailId) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <div className="text-center">
          <Mail className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">Select an email to read</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your messages appear here with full context.
          </p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <EmailHeaderSkeleton />
        <SleekSeparator />
        <EmailBodySkeleton />
      </div>
    )
  }
  if (error) {
    return (
      <ErrorState
        title="Couldn't load email"
        description={error.message}
        onRetry={() => refetch()}
      />
    )
  }
  if (!email) return <ErrorState title="Email not found" />

  return (
    <EmailDetailContent
      emailId={emailId}
      onBack={onBack}
      onSelectThreadEmail={onSelectThreadEmail}
      onNavigate={onNavigate}
    />
  )
}

// ---------------------------------------------------------------------------
// Content — owns the live email query + all interactive state.
// ---------------------------------------------------------------------------
function EmailDetailContent({
  emailId,
  onBack,
  onSelectThreadEmail,
  onNavigate,
}: {
  emailId: string
  onBack?: () => void
  onSelectThreadEmail?: (id: string) => void
  onNavigate?: (direction: 'prev' | 'next') => void
}) {
  const { data: email } = useEmail(emailId)
  const { data: thread } = useThread(email?.threadId ?? null)
  const { data: classification } = useClassificationResults(emailId)
  const { data: categories } = useCategories()
  // Conversation intelligence — fetches the canonical conversation this email
  // belongs to. The panel renders null while loading or when there is no
  // conversation (or only a single message), so this is safe to mount
  // unconditionally for every email.
  const conversationQuery = useEmailConversation(emailId)

  const markRead = useMarkRead()
  const star = useStarEmail()
  const important = useMarkImportant()
  const unsnooze = useSnoozeEmail()
  const navigate = useUIStore((s) => s.navigate)
  const setComposeOpen = useUIStore((s) => s.setComposeOpen)
  const smartReplies = useSmartReplies()

  const [threadOpen, setThreadOpen] = useState(true)
  const [previewAttachment, setPreviewAttachment] = useState<EmailAttachmentMeta | null>(null)
  const [snoozeOpen, setSnoozeOpen] = useState(false)
  const [smartRepliesOpen, setSmartRepliesOpen] = useState(false)

  // Reset the smart-replies panel when navigating to a different email so the
  // user explicitly opts in per email (and stale results from the previous
  // email are never shown). Uses the during-render state-adjustment pattern
  // (same as `fromAccountId` in ComposeForm) rather than an effect, per the
  // `react-hooks/set-state-in-effect` lint rule.
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevEmailId, setPrevEmailId] = useState(emailId)
  if (emailId !== prevEmailId) {
    setPrevEmailId(emailId)
    setSmartRepliesOpen(false)
  }

  // Keyboard shortcuts: j/k navigate prev/next (if wired), ? shows the help toast.
  // Guarded against input/textarea/contenteditable so it never hijacks typing.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      const tag = t?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'j') {
        onNavigate?.('next')
      } else if (e.key === 'k') {
        onNavigate?.('prev')
      } else if (e.key === '?') {
        toast.info('Keyboard shortcuts', {
          description: 'j / k — next / previous email · s — star · e — archive · r — reply',
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onNavigate])

  const wordCount = useMemo(() => {
    const text = email?.bodyText ?? email?.bodyHtmlSanitized?.replace(/<[^>]+>/g, ' ') ?? ''
    return text.trim().split(/\s+/).filter(Boolean).length
  }, [email?.bodyText, email?.bodyHtmlSanitized])

  if (!email) return null

  const cat = email.categories[0]
  const catColorClass = cat ? colorClass(cat.color) : 'cat-slate'

  const domain = email.fromEmail.split('@')[1]?.toLowerCase() ?? ''
  // Institutional = any academic / gov / official domain (not just IIT Jammu)
  const isInstitutional = /\.(edu|ac\.in|gov\.in|gov|mil|org)$/.test(domain)

  const others = (thread?.emails ?? []).filter((m) => m.id !== email.id)

  const handleGmailOpen = () => {
    window.open(email.gmailUrl, '_blank', 'noopener,noreferrer')
  }
  const handleArchive = () => toast.info('Archive is cosmetic in this build', {
    description: 'Connected to Gmail, this would remove from the inbox view.',
  })
  const handleReply = () => {
    setComposeOpen(true)
    toast.info('Reply prefill loaded in compose', {
      description: `Replying to ${email.fromName ?? email.fromEmail}`,
    })
  }
  const handleReplyAll = () => {
    setComposeOpen(true)
    toast.info('Reply-all prefill loaded in compose')
  }
  const handleForward = () => {
    setComposeOpen(true)
    toast.info('Forward prefill loaded in compose')
  }
  const handleAskAI = () => navigate('assistant', { contextEmailId: email.id })
  // Open the Smart Replies panel and immediately kick off generation. If a
  // request is already in-flight (e.g. the user double-clicked), we skip the
  // second trigger — the panel will reflect the pending state from the first.
  const handleSmartReplies = () => {
    setSmartRepliesOpen(true)
    if (!smartReplies.isPending) {
      smartReplies.mutate(email.id)
    }
  }
  const handleAddDeadline = () =>
    toast.info('Add to deadlines', { description: 'Deadline extraction is cosmetic in this build.' })
  const handleCreateRule = () => {
    navigate('rules')
    toast.info('Create rule from sender', {
      description: `Prefilled for ${email.fromEmail}`,
    })
  }
  const handleMoveToSection = (name: string) =>
    toast.info('Move to section', { description: `Moving to "${name}" is cosmetic in this build.` })

  return (
    <div className="flex h-full flex-col">
      {/* ===== Action toolbar (pinned at top of detail pane; wraps on mobile) ===== */}
      <div className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-1 px-3 py-2">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          )}
          {onBack && <Separator orientation="vertical" className="mx-1 h-6" />}

          {/* Group 1: status toggles */}
          <ToolbarButton
            icon={Star}
            label="Star"
            onClick={() => star.mutate({ id: email.id, starred: !email.flags.isStarred })}
            active={email.flags.isStarred}
            activeClass="text-warning"
          />
          <ToolbarButton
            icon={MailOpen}
            label={email.flags.isRead ? 'Mark unread' : 'Mark read'}
            onClick={() => markRead.mutate({ id: email.id, read: !email.flags.isRead })}
            alternateIcon={email.flags.isRead ? Mail : MailOpen}
          />
          <ToolbarButton
            icon={ShieldCheck}
            label={email.flags.isImportant ? 'Remove importance' : 'Mark important'}
            onClick={() => important.mutate({ id: email.id, important: !email.flags.isImportant })}
            active={email.flags.isImportant}
            activeClass="text-warning"
          />

          <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

          {/* Group 2: actions */}
          <ToolbarButton icon={Archive} label="Archive" onClick={handleArchive} />
          <ToolbarButton
            icon={Clock}
            label={isActivelySnoozed(email.snoozedUntil) ? 'Reschedule snooze' : 'Snooze'}
            onClick={() => setSnoozeOpen(true)}
            active={isActivelySnoozed(email.snoozedUntil)}
            activeClass="text-accent-foreground bg-accent"
          />
          <ToolbarButton icon={Reply} label="Reply" onClick={handleReply} />
          <ToolbarButton icon={ReplyAll} label="Reply all" onClick={handleReplyAll} />
          <ToolbarButton icon={Forward} label="Forward" onClick={handleForward} />
          <ToolbarButton
            icon={Wand2}
            label="Smart replies"
            onClick={handleSmartReplies}
            active={smartRepliesOpen}
            activeClass="text-primary bg-primary/10"
          />

          <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

          {/* Group 3: external / AI */}
          <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

          {/* Open in Gmail — prominent colored button in toolbar */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleGmailOpen}
                className="hidden sm:inline-flex h-7 items-center gap-1.5 rounded-md bg-[#EA4335] px-2.5 text-[11px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90 active:scale-95"
              >
                <ExternalLink className="h-3 w-3" />
                Gmail
              </button>
            </TooltipTrigger>
            <TooltipContent>Open in Gmail</TooltipContent>
          </Tooltip>
          {/* Mobile icon-only Gmail button */}
          <ToolbarButton icon={ExternalLink} label="Open in Gmail" onClick={handleGmailOpen} className="sm:hidden" />

          <ToolbarButton
            icon={Sparkles}
            label="Ask AI"
            onClick={handleAskAI}
            activeClass="text-primary"
          />

          {onNavigate && (
            <div className="ml-auto hidden items-center gap-1 md:flex">
              <ToolbarButton icon={ChevronRight} label="Previous" onClick={() => onNavigate('prev')} rotate />
              <ToolbarButton icon={ChevronRight} label="Next" onClick={() => onNavigate('next')} />
            </div>
          )}
        </div>
      </div>

      {/* ===== Scrollable reading column ===== */}
      <PaneScroll>
        <div className="mx-auto w-full max-w-3xl px-4 py-5 pb-20 md:px-6 md:py-6 md:pb-6">
          {/* Snooze banner — only when actively snoozed */}
          {isActivelySnoozed(email.snoozedUntil) && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-accent bg-accent/40 px-3 py-2 text-xs">
              <Clock className="h-3.5 w-3.5 text-accent-foreground" />
              <span className="font-medium text-accent-foreground">Snoozed until {formatDateTime(email.snoozedUntil ?? null)}</span>
              <span className="text-muted-foreground">
                It&apos;s hidden from your default inbox until then.
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setSnoozeOpen(true)}>
                  Reschedule
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => unsnooze.mutate({ id: email.id, until: null })}
                  disabled={unsnooze.isPending}
                >
                  Unsnooze
                </Button>
              </div>
            </div>
          )}

          {/* Subject + category */}
          <div className="mb-3">
            <h1 className="text-lg font-semibold leading-tight tracking-tight md:text-xl">
              {email.subject ?? '(no subject)'}
            </h1>
            {cat && (
              <button
                onClick={() => navigate('organized', { contextCategoryId: cat.id })}
                className={cn(
                  'mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium cat-bg-soft cat-text cat-border-soft transition-opacity hover:opacity-80',
                  catColorClass,
                )}
              >
                <CategoryIcon icon={cat.icon} color={cat.color} className="h-3.5 w-3.5" />
                {cat.name}
                <span className="text-[10px] opacity-70">· {cat.source.replace(/_/g, ' ')}</span>
              </button>
            )}
          </div>

          {/* Polished sender card */}
          <div className="mb-4 rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-semibold ring-1 ring-inset cat-bg-soft cat-text cat-border-soft',
                  catColorClass,
                )}
                aria-hidden
              >
                {(email.fromName ?? email.fromEmail).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="text-sm font-semibold leading-tight">
                    {email.fromName ?? email.fromEmail}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">&lt;{email.fromEmail}&gt;</p>
                  {isInstitutional && (
                    <Badge
                      variant="outline"
                      className="shrink-0 gap-1 border-success/30 bg-success/10 px-1.5 py-0 text-[10px] font-medium text-success"
                    >
                      <ShieldCheck className="h-3 w-3" />
                      Verified · {domain}
                    </Badge>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <AtSign className="h-3 w-3" /> to
                  </span>
                  {email.toRecipients.slice(0, 3).map((r, i) => (
                    <Badge
                      key={`${r.email}-${i}`}
                      variant="outline"
                      className="max-w-[14rem] truncate px-1.5 py-0 text-[11px] font-normal text-muted-foreground"
                    >
                      <span className="truncate">{r.name ?? r.email}</span>
                    </Badge>
                  ))}
                  {email.toRecipients.length > 3 && (
                    <Badge variant="outline" className="px-1.5 py-0 text-[11px] text-muted-foreground">
                      +{email.toRecipients.length - 3}
                    </Badge>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground/80">
                    {formatRelative(email.receivedAt)}
                  </span>
                  <span aria-hidden>·</span>
                  <span>{formatDateTime(email.receivedAt)}</span>
                </div>
              </div>
            </div>
          </div>

          <SleekSeparator className="mb-5" />

          {/* Thread context panel */}
          {email.threadId && others.length > 0 && (
            <Collapsible
              open={threadOpen}
              onOpenChange={setThreadOpen}
              className="mb-5 overflow-hidden rounded-lg border bg-muted/30"
            >
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-accent/50">
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 transition-transform',
                      threadOpen ? 'rotate-180' : 'rotate-0',
                    )}
                  />
                  In this thread ({thread?.messageCount ?? others.length + 1})
                  <span className="ml-auto text-[11px] font-normal text-muted-foreground">
                    {others.length} other message{others.length === 1 ? '' : 's'}
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="divide-y border-t">
                  {others.map((m) => {
                    const mcat = m.categories[0]
                    return (
                      <li key={m.id}>
                        <button
                          onClick={() => onSelectThreadEmail?.(m.id)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent/40"
                        >
                          <div
                            className={cn(
                              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold cat-bg-soft cat-text',
                              mcat ? colorClass(mcat.color) : 'cat-slate',
                            )}
                          >
                            {(m.fromName ?? m.fromEmail).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">
                              {m.subject ?? '(no subject)'}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {m.fromName ?? m.fromEmail}
                            </p>
                          </div>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatRelative(m.receivedAt)}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Body */}
          <div className="mb-6">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                {Math.max(1, Math.round(wordCount / 200))} min read · {wordCount.toLocaleString()} words
              </span>
            </div>
            <div className="mx-auto max-w-2xl overflow-x-auto">
              {email.bodyHtmlSanitized ? (
                <div
                  className={cn(
                    'min-w-0 text-[15px] leading-7 text-foreground/90',
                    '[&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
                    '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:opacity-80',
                    '[&_strong]:font-semibold [&_em]:italic',
                    '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5',
                    '[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5',
                    '[&_li]:my-1',
                    '[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground',
                    '[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold',
                    '[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold',
                    '[&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold',
                    '[&_table]:my-4 [&_table]:min-w-full [&_table]:border-collapse [&_table]:text-sm',
                    '[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-medium',
                    '[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5',
                    '[&_img]:my-3 [&_img]:max-w-full [&_img]:rounded',
                    '[&_hr]:my-4 [&_hr]:border-border',
                    '[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-xs',
                  )}
                  dangerouslySetInnerHTML={{ __html: email.bodyHtmlSanitized }}
                />
              ) : (
                <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-7 text-foreground/90">
                  {email.bodyText}
                </pre>
              )}
            </div>
          </div>

          {/* Attachments v2 */}
          {email.attachments.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Paperclip className="h-4 w-4" /> Attachments
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {email.attachments.length}
                </Badge>
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {email.attachments.map((att) => (
                  <AttachmentCard key={att.id} att={att} onPreview={() => setPreviewAttachment(att)} />
                ))}
              </div>
            </div>
          )}

          {/* Extracted links */}
          {email.extractedLinks.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <LinkIcon className="h-4 w-4" /> Links
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {email.extractedLinks.length}
                </Badge>
              </h3>
              <ul className="space-y-1.5">
                {email.extractedLinks.slice(0, 10).map((l, i) => {
                  const letter = linkLetter(l.url)
                  const host = safeHost(l.url)
                  return (
                    <li key={i}>
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="group flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-xs hover:border-border hover:bg-accent/40"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-semibold uppercase text-muted-foreground">
                          {letter}
                        </span>
                        <span className="min-w-0 flex-1">
                          {l.title && (
                            <span className="block truncate font-medium">{l.title}</span>
                          )}
                          <span className="block truncate text-muted-foreground">
                            {host}
                            <span className="mx-1 opacity-50">/</span>
                            <span className="truncate">{truncatePath(l.url)}</span>
                          </span>
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Smart Replies — AI-generated reply suggestions. Toggled from the
              toolbar (Wand2 button); persists until the user closes it or
              navigates to a different email. The mutation is owned by this
              component so the toolbar click can trigger generation
              immediately while the panel renders the loading/results states. */}
          {smartRepliesOpen && (
            <div className="mb-6">
              <SmartRepliesPanel
                email={email}
                data={smartReplies.data}
                isPending={smartReplies.isPending}
                onRefresh={() => smartReplies.mutate(email.id)}
                onClose={() => setSmartRepliesOpen(false)}
              />
            </div>
          )}

          {/* Conversation intelligence panel — timeline + changes + status.
              Renders null while loading or when this email isn't part of a
              multi-message conversation, so it's a no-op for solo emails. */}
          <ConversationPanel
            conversation={conversationQuery.data}
            isLoading={conversationQuery.isLoading}
            currentEmailId={emailId}
          />

          {/* Classification footer */}
          <ClassificationFooter
            source={classification?.source ?? email.classificationSource ?? null}
            confidence={classification?.confidence ?? email.classificationConfidence ?? null}
            rationale={classification?.rationaleSummary ?? null}
            categoryName={classification?.categoryName ?? cat?.name ?? null}
          />

          {/* Quick actions footer */}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleAddDeadline}>
              <CalendarPlus className="h-4 w-4" /> Add to deadlines
            </Button>
            <Button size="sm" variant="outline" onClick={handleCreateRule}>
              <ArrowUpDown className="h-4 w-4" /> Create rule from sender
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline">
                  <FolderInput className="h-4 w-4" /> Move to section
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-1">
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Choose a section
                </p>
                <div className="max-h-72 overflow-y-auto">
                  {(categories ?? []).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleMoveToSection(c.name)}
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
                    >
                      <CategoryIcon icon={c.icon} color={c.color} className="h-3.5 w-3.5" />
                      <span className="truncate">{c.name}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {c.totalCount}
                      </span>
                    </button>
                  ))}
                  {(categories ?? []).length === 0 && (
                    <p className="px-2 py-2 text-xs text-muted-foreground">No sections available.</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Keyboard hint */}
          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <Keyboard className="h-3 w-3" />
            Press <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">?</kbd> for shortcuts
            {onNavigate && (
              <>
                <span aria-hidden>·</span>
                <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">j</kbd>
                <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">k</kbd>
                to navigate
              </>
            )}
          </p>

          {/* Mobile floating "Open in Gmail" — bottom of reading pane, always visible on small screens */}
          <div className="mt-6 flex justify-center sm:hidden">
            <button
              onClick={handleGmailOpen}
              className="inline-flex items-center gap-2 rounded-full bg-[#EA4335] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform active:scale-95 hover:opacity-90"
            >
              <ExternalLink className="h-4 w-4" />
              Open in Gmail
            </button>
          </div>
        </div>
      </PaneScroll>

      {/* Attachment preview dialog (cosmetic) */}
      <Dialog
        open={!!previewAttachment}
        onOpenChange={(open) => !open && setPreviewAttachment(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{previewAttachment?.filename}</span>
            </DialogTitle>
            <DialogDescription>
              Preview is sandboxed in production. In a Gmail-connected deployment, this would render
              the attachment inline via the Drive viewer.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-6 text-center">
            <File className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-xs text-muted-foreground">
              {previewAttachment?.filename}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {previewAttachment ? formatBytes(previewAttachment.size) : ''}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Snooze dialog (presets + custom datetime) */}
      <SnoozeDialog
        open={snoozeOpen}
        onOpenChange={setSnoozeOpen}
        emailId={email.id}
        currentSnoozedUntil={email.snoozedUntil ?? null}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toolbar button — icon + optional label (label hidden on mobile), with tooltip.
// ---------------------------------------------------------------------------
function ToolbarButton({
  icon: Icon,
  alternateIcon,
  label,
  onClick,
  active,
  activeClass,
  rotate,
  className,
}: {
  icon: LucideIcon
  alternateIcon?: LucideIcon
  label: string
  onClick: () => void
  active?: boolean
  activeClass?: string
  rotate?: boolean
  className?: string
}) {
  const Rendered = alternateIcon ?? Icon
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClick}
          className={cn('h-8 gap-1.5 px-2', active && activeClass, className)}
          aria-label={label}
          aria-pressed={active}
        >
          <Rendered className={cn('h-4 w-4', rotate && 'rotate-180')} />
          <span className="hidden lg:inline">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

// ---------------------------------------------------------------------------
// Attachment card v2 — colored left accent by file type, file-type icon,
// filename + size, Preview button (opens Dialog) + download icon (cosmetic).
// ---------------------------------------------------------------------------
type FileKind = 'pdf' | 'xls' | 'doc' | 'img' | 'ppt' | 'default'

const FILE_KIND_TINT: Record<FileKind, string> = {
  pdf: 'cat-red',
  xls: 'cat-green',
  doc: 'cat-teal',
  img: 'cat-violet',
  ppt: 'cat-orange',
  default: 'cat-slate',
}

function fileKind(mimeType: string): FileKind {
  const m = mimeType.toLowerCase()
  if (m.includes('pdf')) return 'pdf'
  if (m.includes('sheet') || m.includes('excel') || m.includes('xls') || m.includes('csv')) return 'xls'
  if (m.includes('word') || m.includes('document') || m.includes('doc')) return 'doc'
  if (m.startsWith('image/')) return 'img'
  if (m.includes('presentation') || m.includes('powerpoint') || m.includes('ppt')) return 'ppt'
  return 'default'
}

function AttachmentCard({
  att,
  onPreview,
}: {
  att: EmailAttachmentMeta
  onPreview: () => void
}) {
  const kind = fileKind(att.mimeType)
  const tint = FILE_KIND_TINT[kind]
  const label = kind === 'default' ? 'FILE' : kind.toUpperCase()

  return (
    <div className="relative flex items-center gap-3 overflow-hidden rounded-lg border bg-card p-2.5 pl-3">
      {/* Colored left accent by file type */}
      <span className={cn('absolute inset-y-0 left-0 w-1 cat-dot', tint)} aria-hidden />
      <FileKindIcon kind={kind} className={cn('h-9 w-9 shrink-0', 'cat-text', tint)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{att.filename}</p>
        <p className="text-[11px] text-muted-foreground">
          <span className={cn('font-semibold', 'cat-text', tint)}>{label}</span>
          {' · '}
          {formatBytes(att.size)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onPreview}
          aria-label={`Preview ${att.filename}`}
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() =>
            toast.info('Download is sandboxed', { description: att.filename })
          }
          aria-label={`Download ${att.filename}`}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function FileKindIcon({ kind, className }: { kind: FileKind; className?: string }) {
  switch (kind) {
    case 'pdf':
      return <FileText className={className} />
    case 'xls':
      return <FileSpreadsheet className={className} />
    case 'img':
      return <FileImage className={className} />
    case 'doc':
    case 'ppt':
      return <FileType className={className} />
    default:
      return <File className={className} />
  }
}

// ---------------------------------------------------------------------------
// Classification footer — source pill (color by source), confidence bar, rationale.
// ---------------------------------------------------------------------------
function classificationCatClass(source: string | null): string {
  switch (source) {
    case 'manual_rule':
      return 'cat-green'
    case 'user_override':
      return 'cat-amber'
    case 'sender_rule':
      return 'cat-teal'
    case 'ai':
      return 'cat-violet'
    case 'system_default':
      return 'cat-slate'
    default:
      return 'cat-slate'
  }
}

function classificationLabel(source: string | null): string {
  switch (source) {
    case 'manual_rule':
      return 'Manual rule'
    case 'user_override':
      return 'User override'
    case 'sender_rule':
      return 'Sender rule'
    case 'ai':
      return 'AI classified'
    case 'system_default':
      return 'System default'
    default:
      return 'Unclassified'
  }
}

function ClassificationFooter({
  source,
  confidence,
  rationale,
  categoryName,
}: {
  source: string | null
  confidence: number | null
  rationale: string | null
  categoryName: string | null
}) {
  const catClass = classificationCatClass(source)
  const pct = confidence != null ? Math.round(confidence * 100) : null

  return (
    <div className="mt-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Classification
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium cat-bg-soft cat-text cat-border-soft',
            catClass,
          )}
        >
          {classificationLabel(source)}
        </span>
        {categoryName && (
          <Badge variant="outline" className="px-1.5 py-0 text-[11px] text-muted-foreground">
            {categoryName}
          </Badge>
        )}
        {pct != null && (
          <div className="ml-auto flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full cat-dot', catClass)}
                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
              />
            </div>
            <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">
              {pct}%
            </span>
          </div>
        )}
      </div>
      {rationale && (
        <p className="mt-2 line-clamp-2 text-xs italic text-muted-foreground">{rationale}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Link helpers
// ---------------------------------------------------------------------------
function linkLetter(url: string): string {
  const host = safeHost(url)
  return host ? host.charAt(0).toUpperCase() : '#'
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function truncatePath(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/^\//, '')
    return path.length > 42 ? path.slice(0, 42) + '…' : path || '(root)'
  } catch {
    const truncated = url.length > 42 ? url.slice(0, 42) + '…' : url
    return truncated
  }
}
