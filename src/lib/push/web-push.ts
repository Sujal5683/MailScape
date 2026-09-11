/**
 * Server-side Web Push sender (Node.js / Next.js API routes).
 *
 * Architecture: FastAPI handles Gmail sync → ingestEmail() calls this module
 * indirectly via the Next.js internal API, OR Next.js routes call this
 * directly. Using the `web-push` npm package (Node.js only).
 *
 * One PushSubscription = one browser/device.
 * Expired subscriptions (HTTP 410) are auto-deleted from DB.
 */
import webpush from 'web-push'
import { db } from '@/lib/db'

// Configure VAPID once at module load time
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT ?? 'mailto:support@mailscape.app',
  process.env.VAPID_PUBLIC_KEY ?? '',
  process.env.VAPID_PRIVATE_KEY ?? '',
)

export interface PushPayload {
  title: string
  body: string
  url?: string    // Deep-link inside the app (e.g. /?emailId=xxx)
  tag?: string    // Collapses duplicate notifications in the OS notification center
  important?: boolean  // requireInteraction + stronger vibration
}

/**
 * Send a push notification to every registered device for the given userId.
 * Uses Promise.allSettled so one expired subscription doesn't block others.
 * Stale subscriptions (410 Gone) are deleted automatically.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  // Skip silently if VAPID keys aren't configured
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return

  const subs = await db.pushSubscription.findMany({ where: { userId } })
  if (subs.length === 0) return

  const serialized = JSON.stringify(payload)

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          serialized,
        )
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        // 410 = subscription expired/revoked by browser — remove it
        if (status === 410 || status === 404) {
          await db.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } })
        } else {
          console.error('[push] sendNotification failed:', err)
        }
      }
    }),
  )
}

/**
 * Save (upsert) a new browser push subscription for a user.
 * Called from POST /api/push/subscribe.
 */
export async function savePushSubscription(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string,
): Promise<void> {
  await db.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent ?? null,
    },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent ?? null,
    },
  })
}

/**
 * Delete a push subscription (used when user unsubscribes).
 */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  await db.pushSubscription.deleteMany({ where: { endpoint } })
}
