'use client'

import * as React from 'react'
import { useReducedMotion } from 'framer-motion'

// ---------------------------------------------------------------------------
// TypingText — animates the appearance of `text` word-by-word.
//
// Respects prefers-reduced-motion (shows the full text immediately when the
// user has reduced-motion preference). Caps total animation time at ~1.5s by
// increasing the per-tick word count for long text. Calls `onComplete` once
// the text has been fully revealed.
// ---------------------------------------------------------------------------

const TICK_MS = 30
const MAX_DURATION_MS = 1500

export interface TypingTextProps {
  text: string
  onComplete?: () => void
  className?: string
}

export function TypingText({ text, onComplete, className }: TypingTextProps) {
  const reduceMotion = useReducedMotion()
  const [shown, setShown] = React.useState<string>(
    reduceMotion || !text ? text : '',
  )

  // Keep `onComplete` ref-stable so the typing effect doesn't restart on
  // every parent re-render. Updated in an effect (not during render) to
  // satisfy react-hooks/refs.
  const onCompleteRef = React.useRef(onComplete)
  React.useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  React.useEffect(() => {
    if (reduceMotion) {
      setShown(text)
      onCompleteRef.current?.()
      return
    }
    if (!text) {
      setShown('')
      onCompleteRef.current?.()
      return
    }

    // Split into tokens preserving whitespace so re-joining is exact.
    const tokens = text.split(/(\s+)/).filter((t) => t.length > 0)
    const totalTicks = Math.max(1, tokens.length)
    const cappedTicks = Math.min(
      totalTicks,
      Math.floor(MAX_DURATION_MS / TICK_MS),
    )
    const wordsPerTick = Math.max(1, Math.ceil(tokens.length / cappedTicks))

    setShown('')
    let i = 0
    const interval = window.setInterval(() => {
      i += wordsPerTick
      if (i >= tokens.length) {
        setShown(text)
        window.clearInterval(interval)
        onCompleteRef.current?.()
      } else {
        setShown(tokens.slice(0, i).join(''))
      }
    }, TICK_MS)
    return () => window.clearInterval(interval)
  }, [text, reduceMotion])

  return <span className={className}>{shown}</span>
}

// ---------------------------------------------------------------------------
// useStreamingMessage — tracks which assistant message id is currently
// "streaming" (typing out). A message starts streaming when it becomes the
// most recent assistant message AND has not yet finished streaming.
//
// Returns:
//   - streamingId: id of the message currently streaming (or null)
//   - isStreaming(id): predicate
//   - markComplete(id): TypingText calls this when its text finishes
//
// The hook watches the messages array. When a new assistant message id
// appears at the tail, it becomes the streaming message until either
// markComplete(id) is called or a 1.7s safety timer elapses.
// ---------------------------------------------------------------------------

export interface UseStreamingMessageResult {
  streamingId: string | null
  isStreaming: (id: string) => boolean
  markComplete: (id: string) => void
}

export function useStreamingMessage(
  messages: { id: string; role: string }[] | undefined,
  isPending: boolean,
): UseStreamingMessageResult {
  const [streamingId, setStreamingId] = React.useState<string | null>(null)
  const completedRef = React.useRef<Set<string>>(new Set())
  const safetyTimerRef = React.useRef<number | null>(null)

  // Find the most recent assistant message id.
  const lastAssistantId = React.useMemo(() => {
    if (!messages || messages.length === 0) return null
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id
    }
    return null
  }, [messages])

  React.useEffect(() => {
    if (!lastAssistantId) {
      setStreamingId(null)
      return
    }
    // If the latest assistant message has already completed streaming,
    // leave streaming as null.
    if (completedRef.current.has(lastAssistantId)) {
      setStreamingId(null)
      return
    }
    setStreamingId(lastAssistantId)

    // Safety timer: ensure streaming clears even if TypingText never fires
    // onComplete (e.g., message with no text blocks).
    if (safetyTimerRef.current) window.clearTimeout(safetyTimerRef.current)
    safetyTimerRef.current = window.setTimeout(() => {
      completedRef.current.add(lastAssistantId)
      setStreamingId((cur) => (cur === lastAssistantId ? null : cur))
    }, 1700)

    return () => {
      if (safetyTimerRef.current) {
        window.clearTimeout(safetyTimerRef.current)
        safetyTimerRef.current = null
      }
    }
  }, [lastAssistantId])

  // While a request is pending (thinking), there is no streaming text yet.
  React.useEffect(() => {
    if (isPending) {
      setStreamingId(null)
    }
  }, [isPending])

  const markComplete = React.useCallback((id: string) => {
    completedRef.current.add(id)
    setStreamingId((cur) => (cur === id ? null : cur))
  }, [])

  const isStreaming = React.useCallback(
    (id: string) => streamingId === id,
    [streamingId],
  )

  return { streamingId, isStreaming, markComplete }
}
