'use client'

import { useEffect, useRef, useState } from 'react'
import { useAccounts, useRecipients, useSendEmail, useSaveDraft } from '@/hooks/use-queries'
import { useToast } from '@/hooks/use-toast'
import { useUIStore } from '@/store/ui-store'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Recipient } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  Send,
  Save,
  ExternalLink,
  Trash2,
  Paperclip,
  X,
  Plus,
  AtSign,
  FileText,
  BookmarkPlus,
} from 'lucide-react'
import { TemplatesPanel } from './templates-panel'
import { TemplateEditorDialog } from './template-editor-dialog'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * RecipientField — multi-recipient chip input with debounced autocomplete.
 *
 * Used for both the To and CC fields. Chips wrap (`flex-wrap`); the
 * suggestions dropdown is absolutely positioned, full width, bounded to
 * `max-h-48 overflow-y-auto` so it NEVER overflows its container.
 *
 * Keyboard:
 *  - Enter / ","  → add the highlighted suggestion (if any) or the typed email
 *                   if it matches the email regex.
 *  - Tab           → add (same rule) and let focus move to the next field.
 *  - ArrowUp/Down  → navigate suggestions.
 *  - Backspace     → remove the last chip when the input is empty.
 *  - Escape        → close the dropdown.
 */
function RecipientField({
  recipients,
  onChange,
  placeholder,
  ariaLabel,
}: {
  recipients: Recipient[]
  onChange: (next: Recipient[]) => void
  placeholder: string
  ariaLabel: string
}) {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 200ms debounce on the autocomplete query.
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 200)
    return () => clearTimeout(t)
  }, [input])

  const { data: results, isFetching } = useRecipients(query)
  const trimmed = input.trim()

  // Filter out already-selected recipients.
  const suggestions = (results ?? []).filter(
    (r) => !recipients.some((x) => x.email === r.email),
  )

  // Open / close the dropdown based on input + available suggestions.
  if (trimmed.length > 0 && suggestions.length > 0 && !open) {
    setOpen(true)
  } else if ((trimmed.length === 0 || suggestions.length === 0) && open) {
    setOpen(false)
  }
  if (activeIdx >= suggestions.length && activeIdx !== -1) {
    setActiveIdx(-1)
  }

  const addRecipient = (r: Recipient) => {
    if (!r.email || recipients.some((x) => x.email === r.email)) {
      setInput('')
      setActiveIdx(-1)
      return
    }
    onChange([...recipients, r])
    setInput('')
    setActiveIdx(-1)
  }

  const removeRecipient = (email: string) => {
    onChange(recipients.filter((r) => r.email !== email))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        e.preventDefault()
        addRecipient(suggestions[activeIdx])
        return
      }
      if (trimmed && EMAIL_REGEX.test(trimmed)) {
        e.preventDefault()
        addRecipient({ email: trimmed })
      }
    } else if (e.key === 'Tab') {
      // Add the typed/highlighted recipient and let the default Tab move focus.
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        addRecipient(suggestions[activeIdx])
      } else if (trimmed && EMAIL_REGEX.test(trimmed)) {
        addRecipient({ email: trimmed })
      }
    } else if (e.key === 'Backspace' && !input && recipients.length > 0) {
      e.preventDefault()
      removeRecipient(recipients[recipients.length - 1].email)
    } else if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault()
      setOpen(true)
      setActiveIdx((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault()
      setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIdx(-1)
    }
  }

  return (
    <div className="relative">
      <div
        className={cn(
          'flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-xs transition-[color,box-shadow]',
          'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
        )}
      >
        {recipients.map((r) => (
          <Badge
            key={r.email}
            variant="secondary"
            className="max-w-full gap-1 pr-1"
          >
            <span className="max-w-[18rem] truncate">
              {r.name ? `${r.name} ` : ''}
              {r.email}
            </span>
            <button
              type="button"
              onClick={() => removeRecipient(r.email)}
              aria-label={`Remove ${r.email}`}
              className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current)
            if (trimmed.length > 0 && suggestions.length > 0) setOpen(true)
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => {
              setOpen(false)
              setActiveIdx(-1)
            }, 150)
          }}
          placeholder={recipients.length === 0 ? placeholder : ''}
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={`${ariaLabel}-listbox`}
          role="combobox"
          className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {isFetching && trimmed.length > 0 && (
          <span className="px-1 text-xs text-muted-foreground" aria-hidden>
            …
          </span>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul
          id={`${ariaLabel}-listbox`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {suggestions.map((r, idx) => (
            <li
              key={`${r.email}-${idx}`}
              role="option"
              aria-selected={idx === activeIdx}
            >
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  addRecipient(r)
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent',
                  idx === activeIdx && 'bg-accent',
                )}
              >
                <AtSign className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {r.name ?? r.email}
                  </span>
                  {r.name && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.email}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * ComposeForm — full email compose form.
 *
 * Consumed by both {@link ComposeView} (full page) and the ComposeDrawer
 * (Sheet). The `onSent` callback fires after a successful send, allowing the
 * host to close the drawer / navigate.
 */
export function ComposeForm({ onSent }: { onSent?: () => void }) {
  const { toast } = useToast()
  const { data: accounts, isLoading: accountsLoading } = useAccounts()
  const sendMutation = useSendEmail()
  const draftMutation = useSaveDraft()

  // One-shot prefill: smart replies / reply / forward flows store a prefill
  // payload in the UI store. The lazy initializers below consume it exactly
  // once when ComposeForm mounts (which happens each time the Sheet opens),
  // and the effect below clears the store field so the prefill is never
  // re-applied on a subsequent open. The full-page ComposeView never sets a
  // prefill, so its form starts empty as before.
  const prefill = useUIStore((s) => s.composePrefill)
  const setComposePrefill = useUIStore((s) => s.setComposePrefill)

  const [fromAccountId, setFromAccountId] = useState<string>('')
  const [to, setTo] = useState<Recipient[]>(() => prefill?.to ?? [])
  const [cc, setCc] = useState<Recipient[]>(() => prefill?.cc ?? [])
  const [showCC, setShowCC] = useState(() => (prefill?.cc?.length ?? 0) > 0)
  const [subject, setSubject] = useState(() => prefill?.subject ?? '')
  const [body, setBody] = useState(() => prefill?.body ?? '')
  const [attachments, setAttachments] = useState<File[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  // Templates panel (right Sheet listing saved templates).
  const [templatesPanelOpen, setTemplatesPanelOpen] = useState(false)
  // Template editor dialog — used for "Save as template" (pre-filled with the
  // current subject + body) when `editingTemplate` is null. The dialog itself
  // handles the create-vs-edit branch.
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Consume the prefill exactly once after mount so the store field does not
  // bleed into the next open. Local state already captured the values via the
  // lazy initializers above.
  useEffect(() => {
    if (prefill) setComposePrefill(null)
  }, [prefill, setComposePrefill])

  // Default the From account to the first connected account once loaded.
  // (During-render state adjustment — the canonical React pattern that
  // satisfies `react-hooks/set-state-in-effect`.)
  if (accounts && accounts.length > 0 && !fromAccountId) {
    setFromAccountId(accounts[0].id)
  }

  const resetForm = () => {
    setTo([])
    setCc([])
    setShowCC(false)
    setSubject('')
    setBody('')
    setAttachments([])
  }

  const handleConfirmSend = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Keep the confirmation dialog open while sending so the user sees the
    // "Sending…" state on the action button itself.
    e.preventDefault()
    sendMutation.mutate(
      { to, cc: showCC ? cc : undefined, subject, body, confirm: true },
      {
        onSuccess: (data) => {
          setConfirmOpen(false)
          if (data?.ok) {
            onSent?.()
            resetForm()
          } else {
            toast({
              title: 'Send failed',
              description: 'The server did not confirm the send.',
              variant: 'destructive',
            })
          }
        },
        onError: (err) => {
          setConfirmOpen(false)
          toast({
            title: 'Send failed',
            description: err instanceof Error ? err.message : 'Unknown error',
            variant: 'destructive',
          })
        },
      },
    )
  }

  const handleSaveDraft = () => {
    draftMutation.mutate(
      { to, cc: showCC ? cc : undefined, subject, body },
      {
        onError: (err) => {
          toast({
            title: 'Draft not saved',
            description: err instanceof Error ? err.message : 'Unknown error',
            variant: 'destructive',
          })
        },
      },
    )
  }

  const handleOpenInGmail = () => {
    const params = new URLSearchParams()
    params.set('view', 'cm')
    params.set('fs', '1')
    if (to.length > 0) params.set('to', to.map((r) => r.email).join(','))
    if (showCC && cc.length > 0) params.set('cc', cc.map((r) => r.email).join(','))
    if (subject) params.set('su', subject)
    if (body) params.set('body', body)
    const url = `https://mail.google.com/mail/?${params.toString()}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) setAttachments((prev) => [...prev, ...files])
    e.target.value = ''
  }

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx))
  }

  const canSend = to.length > 0 && !sendMutation.isPending
  const recipientPreview = to.map((r) => r.email).join(', ')

  return (
    <div className="flex flex-col gap-4">
      {/* From */}
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="compose-from" className="w-10 shrink-0 text-sm font-medium">
          From
        </Label>
        <Select value={fromAccountId || undefined} onValueChange={setFromAccountId}>
          <SelectTrigger
            id="compose-from"
            className="h-9 min-w-[14rem] flex-1 sm:flex-none"
          >
            <SelectValue
              placeholder={accountsLoading ? 'Loading accounts…' : 'Select an account'}
            />
          </SelectTrigger>
          <SelectContent>
            {(accounts ?? []).map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <span className="flex flex-col">
                  <span className="truncate">{a.emailAddress}</span>
                  {a.displayName && (
                    <span className="text-xs text-muted-foreground">
                      {a.displayName}
                    </span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* To */}
      <div className="flex flex-wrap items-start gap-2">
        <Label
          htmlFor="compose-to"
          className="w-10 shrink-0 pt-2 text-sm font-medium"
        >
          To
        </Label>
        <div className="min-w-[12rem] flex-1">
          <RecipientField
            recipients={to}
            onChange={setTo}
            placeholder="Type a name or email…"
            ariaLabel="compose-to"
          />
        </div>
        {!showCC && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-0.5"
            onClick={() => setShowCC(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            CC
          </Button>
        )}
      </div>

      {/* CC */}
      {showCC && (
        <div className="flex flex-wrap items-start gap-2">
          <Label
            htmlFor="compose-cc"
            className="w-10 shrink-0 pt-2 text-sm font-medium"
          >
            Cc
          </Label>
          <div className="min-w-[12rem] flex-1">
            <RecipientField
              recipients={cc}
              onChange={setCc}
              placeholder="Type a name or email…"
              ariaLabel="compose-cc"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-0.5"
            onClick={() => {
              setShowCC(false)
              setCc([])
            }}
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </Button>
        </div>
      )}

      <Separator />

      {/* Subject */}
      <div className="flex flex-wrap items-center gap-2">
        <Label
          htmlFor="compose-subject"
          className="w-10 shrink-0 text-sm font-medium"
        >
          Subject
        </Label>
        <Input
          id="compose-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="h-9 min-w-[12rem] flex-1"
        />
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="compose-body" className="text-sm font-medium">
          Message
        </Label>
        <Textarea
          id="compose-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message…"
          className="min-h-48 resize-y"
        />
      </div>

      {/* Attachments */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-medium">Attachments</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-3.5 w-3.5" />
            Add files
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            onChange={handleFileSelect}
            aria-label="Add attachments"
          />
        </div>
        {attachments.length > 0 && (
          <ul className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
            {attachments.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                <Badge variant="secondary" className="gap-1.5 pr-1">
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="max-w-[14rem] truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(f.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    aria-label={`Remove ${f.name}`}
                    className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger asChild>
            <Button type="button" disabled={!canSend}>
              <Send className="h-4 w-4" />
              {sendMutation.isPending ? 'Sending…' : 'Send'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send this email?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <span>
                  Send this email to{' '}
                  <span className="font-medium text-foreground">
                    {recipientPreview}
                  </span>
                  ?
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={sendMutation.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                onClick={handleConfirmSend}
                disabled={sendMutation.isPending}
              >
                {sendMutation.isPending ? 'Sending…' : 'Send'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          type="button"
          variant="outline"
          onClick={handleSaveDraft}
          disabled={draftMutation.isPending}
        >
          <Save className="h-4 w-4" />
          {draftMutation.isPending ? 'Saving…' : 'Save draft'}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => setTemplatesPanelOpen(true)}
        >
          <FileText className="h-4 w-4" />
          Templates
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => setTemplateEditorOpen(true)}
          disabled={!subject.trim() && !body.trim()}
          title={
            subject.trim() || body.trim()
              ? 'Save the current subject + body as a reusable template'
              : 'Add a subject or body first'
          }
        >
          <BookmarkPlus className="h-4 w-4" />
          Save as template
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={handleOpenInGmail}
        >
          <ExternalLink className="h-4 w-4" />
          Open in Gmail
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={resetForm}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Discard
        </Button>
      </div>

      {/* Templates panel + editor dialog — owned by the form so the
          "Save as template" action can pre-fill the dialog with the live
          subject + body. Inserting a template fills the form fields. */}
      <TemplatesPanel
        open={templatesPanelOpen}
        onOpenChange={setTemplatesPanelOpen}
        onInsert={(t) => {
          setSubject(t.subject)
          setBody(t.body)
          toast({
            title: 'Template inserted',
            description: t.name,
          })
        }}
      />
      <TemplateEditorDialog
        open={templateEditorOpen}
        onOpenChange={setTemplateEditorOpen}
        defaults={{
          subject,
          body,
          category: 'general',
        }}
      />
    </div>
  )
}
