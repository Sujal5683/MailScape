'use client'

/**
 * usePushNotifications — client-side hook for Web Push subscriptions.
 *
 * Manages:
 *  1. Service Worker registration (public/sw.js)
 *  2. Browser push permission request
 *  3. VAPID subscription creation and server persistence
 *  4. Unsubscribe flow
 *
 * Returns a stable object with state + actions so the Settings UI
 * can render the current push status and toggle it.
 */

import { useCallback, useEffect, useState } from 'react'

export type PushPermission = 'default' | 'granted' | 'denied'

export interface UsePushNotificationsReturn {
  /** True if Push API is available in this browser */
  supported: boolean
  /** Current browser permission state */
  permission: PushPermission
  /** True if this browser has an active push subscription */
  subscribed: boolean
  /** True while subscribe/unsubscribe is in progress */
  loading: boolean
  /** Error message if the last action failed */
  error: string | null
  /** Request permission + subscribe to push notifications */
  subscribe: () => Promise<void>
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<void>
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const buffer  = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) buffer[i] = rawData.charCodeAt(i)
  return buffer.buffer as ArrayBuffer
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [supported,  setSupported]  = useState(false)
  const [permission, setPermission] = useState<PushPermission>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [swReg,      setSwReg]      = useState<ServiceWorkerRegistration | null>(null)

  // ── Register Service Worker + check current subscription state ──────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    setSupported(true)
    setPermission(Notification.permission as PushPermission)

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(async (reg) => {
        setSwReg(reg)
        const existing = await reg.pushManager.getSubscription()
        setSubscribed(!!existing)
      })
      .catch((err) => {
        console.error('[push] SW registration failed:', err)
        setError('Service Worker registration failed')
      })
  }, [])

  // ── Subscribe ────────────────────────────────────────────────────────────
  const subscribe = useCallback(async () => {
    if (!swReg || !supported) return
    setLoading(true)
    setError(null)

    try {
      // 1. Request permission
      const result = await Notification.requestPermission()
      setPermission(result as PushPermission)
      if (result !== 'granted') {
        setError('Push notification permission denied')
        return
      }

      // 2. Create subscription
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        setError('Push notifications are not configured on this server')
        return
      }

      const subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      // 3. Save to server
      const sub = subscription.toJSON()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: sub.keys,
        }),
      })

      setSubscribed(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to enable push notifications'
      setError(msg)
      console.error('[push] Subscribe failed:', err)
    } finally {
      setLoading(false)
    }
  }, [swReg, supported])

  // ── Unsubscribe ──────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    if (!swReg) return
    setLoading(true)
    setError(null)

    try {
      const existing = await swReg.pushManager.getSubscription()
      if (existing) {
        const endpoint = existing.endpoint
        await existing.unsubscribe()

        await fetch('/api/push/unsubscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        })
      }
      setSubscribed(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to disable push notifications'
      setError(msg)
      console.error('[push] Unsubscribe failed:', err)
    } finally {
      setLoading(false)
    }
  }, [swReg])

  return { supported, permission, subscribed, loading, error, subscribe, unsubscribe }
}
