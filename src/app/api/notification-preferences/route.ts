import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { readBody, ApiError } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// Channels supported by the per-category notification preferences feature.
// `in_app`  = bell badge + toasts while the app is open.
// `web`     = browser-level alerts (Notification API) for background tabs.
// `push`    = native OS notifications (PWA / install scenarios).
type Channel = 'in_app' | 'web' | 'push'

const VALID_CHANNELS: Channel[] = ['in_app', 'web', 'push']

// Implicit default enabled state when no NotificationPreference row exists
// for a (channel, categoryId) combination. In-app and web channels default
// to enabled; push defaults to disabled (user must opt in + grant permission).
const CHANNEL_DEFAULTS: Record<Channel, boolean> = {
  in_app: true,
  web: true,
  push: false,
}

export interface NotificationPrefDTO {
  channel: Channel
  preferences: { categoryId: string | '__global__'; enabled: boolean }[]
}

// GET /api/notification-preferences
// Returns the effective per-channel preference state for the active account.
// For every channel × (global + every category) combination, a preference
// row is returned. Missing rows are filled with the channel's implicit
// default (in_app/web → enabled, push → disabled), so the frontend can
// render every row without an extra lookup. The global row (categoryId
// === '__global__') is always emitted first per channel and represents
// the channel-wide default. Per-category rows inherit the global default
// unless an explicit override row exists.
export async function GET() {
  const session = await getSession()
  const accountId = session.accountId

  const [rows, categories] = await Promise.all([
    db.notificationPreference.findMany({ where: { accountId } }),
    db.category.findMany({
      where: { accountId },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  // Index existing rows by `${channel}:${categoryIdOrGlobal}` for O(1) lookup.
  const byKey = new Map<string, boolean>()
  for (const r of rows) {
    byKey.set(`${r.channel}:${r.categoryId ?? '__global__'}`, r.enabled)
  }

  const channels: NotificationPrefDTO[] = []
  for (const channel of VALID_CHANNELS) {
    // Effective global default = explicit global row, else the channel default.
    const channelDefault = byKey.get(`${channel}:__global__`) ?? CHANNEL_DEFAULTS[channel]
    const prefs: NotificationPrefDTO['preferences'] = []
    // Global row always first — represents the channel-wide default.
    prefs.push({ categoryId: '__global__', enabled: channelDefault })
    // Per-category rows. Categories without an explicit override inherit
    // the channel default so the UI reflects the effective delivery state.
    for (const c of categories) {
      const explicit = byKey.get(`${channel}:${c.id}`)
      prefs.push({ categoryId: c.id, enabled: explicit ?? channelDefault })
    }
    channels.push({ channel, preferences: prefs })
  }

  return NextResponse.json({ channels })
}

// PUT /api/notification-preferences
// Body: { channel: 'in_app'|'web'|'push', categoryId: string|null, enabled: boolean }
// Upserts the (accountId, channel, categoryId) row. categoryId === null
// represents the channel-wide global default; a string categoryId represents
// a per-category override. Validates channel enum + (if provided) that the
// categoryId belongs to the active account. Emits a NOTIFICATION_PREF_UPDATED
// audit event.
export async function PUT(req: Request) {
  const session = await getSession()
  const body = await readBody<{
    channel: string
    categoryId: string | null
    enabled: boolean
  }>(req)

  if (!VALID_CHANNELS.includes(body.channel as Channel)) {
    throw new ApiError('Invalid channel — must be one of in_app, web, push', 400)
  }
  if (typeof body.enabled !== 'boolean') {
    throw new ApiError('enabled must be a boolean', 400)
  }

  const channel = body.channel as Channel
  const categoryId = body.categoryId ?? null

  // If a specific categoryId is provided, validate it belongs to this account.
  if (categoryId) {
    const cat = await db.category.findFirst({
      where: { id: categoryId, accountId: session.accountId },
    })
    if (!cat) throw new ApiError('Category not found', 404)
  }

  // Use findFirst because the compound unique key includes a nullable
  // categoryId column. SQLite allows NULL values in the unique index, but
  // Prisma's findUnique does not accept null for nullable unique fields.
  const existing = await db.notificationPreference.findFirst({
    where: { accountId: session.accountId, channel, categoryId },
  })

  let row
  if (existing) {
    row = await db.notificationPreference.update({
      where: { id: existing.id },
      data: { enabled: body.enabled },
    })
  } else {
    row = await db.notificationPreference.create({
      data: {
        accountId: session.accountId,
        channel,
        categoryId,
        enabled: body.enabled,
      },
    })
  }

  await db.auditEvent.create({
    data: {
      userId: session.userId,
      accountId: session.accountId,
      eventType: 'NOTIFICATION_PREF_UPDATED',
      targetType: 'notification_preference',
      targetId: row.id,
      sourceSurface: 'ui',
      metadata: JSON.stringify({ channel, categoryId, enabled: body.enabled }),
    },
  })

  return NextResponse.json({ ok: true })
}
