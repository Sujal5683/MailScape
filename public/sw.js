/**
 * MailScape Service Worker — Web Push + Offline Shell
 *
 * Handles:
 *   - Push events  → OS-level notifications with actions
 *   - notificationclick → open/focus the app at the relevant URL
 */

const APP_NAME = 'MailScape'

// ── Push handler ────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: APP_NAME, body: event.data.text() }
  }

  const { title = APP_NAME, body = '', url = '/', tag, important = false } = payload

  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: tag ?? `mailscape-${Date.now()}`,
    data: { url },
    // Keep notification on screen until user acts (for important emails)
    requireInteraction: !!important,
    actions: [
      { action: 'open',    title: 'Open email' },
      { action: 'dismiss', title: 'Dismiss'    },
    ],
    vibrate: important ? [200, 100, 200] : [100],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click handler ───────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'dismiss') return

  const targetUrl = event.notification.data?.url ?? '/'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus an existing window on the same origin if one exists
        for (const client of windowClients) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl)
            return client.focus()
          }
        }
        // Otherwise open a new window
        return clients.openWindow(targetUrl)
      }),
  )
})

// ── Activate: claim clients immediately so new SW takes effect ───────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})
