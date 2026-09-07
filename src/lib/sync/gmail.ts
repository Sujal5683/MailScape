// Real Gmail sync engine — fetches messages from the Gmail API and ingests
// them through the same normalize → classify → persist pipeline used by the
// scan service, so everything stays consistent.
//
// Prerequisites: the AccountConnection must have accessToken + refreshToken
// populated (set by the NextAuth Google OAuth flow).

import { google } from 'googleapis'
import { db } from '@/lib/db'
import { ingestEmail, type RawEmail } from '@/lib/sync/seed'

const DEFAULT_CATEGORIES = [
  { name: 'Placement', description: 'Internships, placements, career development', icon: 'briefcase', color: 'amber', sortOrder: 1 },
  { name: 'Academic', description: 'Exams, registration, grades, curriculum', icon: 'graduation-cap', color: 'blue', sortOrder: 2 },
  { name: 'Professors', description: 'Faculty communications, projects, assignments', icon: 'user', color: 'violet', sortOrder: 3 },
  { name: 'Research', description: 'Research programs, library, publications', icon: 'flask-conical', color: 'teal', sortOrder: 4 },
  { name: 'Student Welfare', description: 'Counseling, scholarships, sports', icon: 'heart', color: 'rose', sortOrder: 5 },
  { name: 'Medical', description: 'Health check-ups, vaccinations, medical center', icon: 'stethoscope', color: 'red', sortOrder: 6 },
  { name: 'Hostel', description: 'Room allotment, mess, maintenance', icon: 'home', color: 'orange', sortOrder: 7 },
  { name: 'Events', description: 'Cultural fests, hackathons, talks, alumni', icon: 'calendar', color: 'fuchsia', sortOrder: 8 },
  { name: 'Finance', description: 'Fees, receipts, payments', icon: 'wallet', color: 'green', sortOrder: 9 },
  { name: 'Others', description: 'Unmatched and external messages', icon: 'inbox', color: 'slate', sortOrder: 99 },
]

/**
 * Ensure all default categories exist for an account.
 * Called before ingestion so the "Others" fallback is always present.
 */
async function ensureCategories(accountId: string): Promise<Map<string, string>> {
  const existing = await db.category.findMany({ where: { accountId }, select: { id: true, name: true } })
  const categoryMap = new Map<string, string>(existing.map((c) => [c.name, c.id]))

  for (const cat of DEFAULT_CATEGORIES) {
    if (!categoryMap.has(cat.name)) {
      const created = await db.category.create({
        data: {
          accountId,
          name: cat.name,
          description: cat.description,
          icon: cat.icon,
          color: cat.color,
          sortOrder: cat.sortOrder,
          systemDefault: true,
        },
      })
      categoryMap.set(cat.name, created.id)
    }
  }

  return categoryMap
}

/**
 * Build an OAuth2 client for the given AccountConnection.
 * Handles token refresh automatically via the googleapis library.
 */
function buildOAuth2Client(account: { accessToken: string | null; refreshToken: string | null; tokenExpiresAt: Date | null }) {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`,
  )

  oauth2.setCredentials({
    access_token: account.accessToken ?? undefined,
    refresh_token: account.refreshToken ?? undefined,
    expiry_date: account.tokenExpiresAt?.getTime() ?? undefined,
  })

  return oauth2
}

/**
 * Parse a raw Gmail message payload into a RawEmail shape suitable for ingestEmail().
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseGmailMessage(msg: any, accountEmail: string): RawEmail | null {
  try {
    const headers = msg.payload?.headers ?? []
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''

    const subject = getHeader('Subject') || '(no subject)'
    const from = getHeader('From')
    const to = getHeader('To')
    const date = getHeader('Date')
    const messageId = msg.id ?? ''
    const threadId = msg.threadId ?? messageId

    // Parse From: "Name <email>" or just "email"
    const fromMatch = from.match(/^(.*?)\s*<(.+)>$/)
    const fromEmail = fromMatch ? fromMatch[2].trim() : from.trim()
    const fromName = fromMatch ? fromMatch[1].trim().replace(/^["']|["']$/g, '') : fromEmail

    // Parse To: extract first recipient.
    const toRecipients: { email: string; name: string }[] = to
      .split(',')
      .slice(0, 5)
      .map((t) => {
        const m = t.trim().match(/^(.*?)\s*<(.+)>$/)
        return m
          ? { email: m[2].trim(), name: m[1].trim() }
          : { email: t.trim(), name: t.trim() }
      })
      .filter((r) => r.email)

    // Extract body text from the payload.
    let bodyText = ''
    let bodyHtml = ''

    function extractBody(part: NonNullable<typeof msg.payload>) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8')
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8')
      }
      if (part.parts) {
        for (const p of part.parts) extractBody(p)
      }
    }

    if (msg.payload) extractBody(msg.payload)

    // Fallback: use snippet if no body found.
    if (!bodyText && !bodyHtml) {
      bodyText = msg.snippet ?? ''
    }

    // Extract attachments.
    const attachments: { filename: string; mimeType: string; size: number }[] = []
    function extractAttachments(part: NonNullable<typeof msg.payload>) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType ?? 'application/octet-stream',
          size: part.body.size ?? 0,
        })
      }
      if (part.parts) {
        for (const p of part.parts) extractAttachments(p)
      }
    }
    if (msg.payload) extractAttachments(msg.payload)

    // Gmail label flags.
    const labels = msg.labelIds ?? []
    const isRead = !labels.includes('UNREAD')
    const isStarred = labels.includes('STARRED')
    const isImportant = labels.includes('IMPORTANT')
    const isSpam = labels.includes('SPAM')
    const isDraft = labels.includes('DRAFT')
    const isSent = labels.includes('SENT')

    const receivedAt = date
      ? new Date(date).toISOString()
      : new Date().toISOString()

    return {
      providerMessageId: messageId,
      providerThreadId: threadId,
      fromEmail,
      fromName,
      toRecipients: toRecipients.length > 0 ? toRecipients : [{ email: accountEmail, name: accountEmail }],
      ccRecipients: [],
      subject,
      bodyText,
      bodyHtml,
      receivedAt,
      isRead,
      isStarred,
      isImportant,
      isSpam,
      isDraft,
      isSent,
      attachments,
      labels: labels.filter((l) => l !== 'UNREAD'),
    }
  } catch (err) {
    console.error('[gmail] Failed to parse message:', err)
    return null
  }
}

/**
 * Main entry point: sync a single Google account.
 * Called from the POST /api/accounts/[accountId] (sync) endpoint.
 */
export async function syncGmailAccount(accountId: string): Promise<void> {
  // 1. Load account with tokens.
  const account = await db.accountConnection.findUnique({
    where: { id: accountId },
    include: { syncState: true },
    // We need these fields for OAuth — Prisma findUnique already returns all
    // scalar fields by default when not using `select`, so include is enough.
  })

  if (!account) throw new Error(`Account ${accountId} not found`)

  if (!account.accessToken && !account.refreshToken) {
    throw new Error(
      `Account ${accountId} has no OAuth tokens. ` +
      'The user must re-authorize Google access from Settings → Connected Accounts.',
    )
  }

  // 2. Ensure all default categories exist (including "Others" failsafe).
  const categoryMap = await ensureCategories(accountId)

  // 3. Build Gmail client.
  const auth = buildOAuth2Client(account)
  const gmail = google.gmail({ version: 'v1', auth })

  // 4. Determine how far back to sync.
  // If we have a Gmail historyId, use incremental sync; otherwise do a full
  // initial pull of the last 100 messages.
  const syncState = account.syncState
  const sendersMap = new Map<string, string>()
  const threadsMap = new Map<string, string>()
  let syncedCount = 0

  if (syncState?.gmailHistoryId && syncState.gmailHistoryId !== 'seed-0001') {
    // --- Incremental sync via History API ---
    try {
      const historyRes = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: syncState.gmailHistoryId,
        historyTypes: ['messageAdded'],
        maxResults: 200,
      })

      const history = historyRes.data.history ?? []
      for (const record of history) {
        for (const added of record.messagesAdded ?? []) {
          const msgId = added.message?.id
          if (!msgId) continue

          // Skip already-ingested messages.
          const exists = await db.email.findFirst({ where: { accountId, providerMessageId: msgId } })
          if (exists) continue

          const msgRes = await gmail.users.messages.get({ userId: 'me', id: msgId, format: 'full' })
          const raw = parseGmailMessage(msgRes.data, account.emailAddress)
          if (raw) {
            await ingestEmail(raw, accountId, categoryMap, sendersMap, threadsMap)
            syncedCount++
          }
        }
      }

      // Update historyId for next incremental sync.
      if (historyRes.data.historyId) {
        await db.syncState.update({
          where: { accountId },
          data: { gmailHistoryId: historyRes.data.historyId },
        })
      }
    } catch (err: unknown) {
      // historyId too old — fall back to full re-sync.
      const isGone = err instanceof Error && err.message.includes('404')
      if (isGone) {
        console.warn(`[gmail] historyId expired for account ${accountId}, falling back to full sync`)
        await fullSync(gmail, account.emailAddress, accountId, categoryMap, sendersMap, threadsMap)
      } else {
        throw err
      }
    }
  } else {
    // --- Full initial sync ---
    syncedCount = await fullSync(gmail, account.emailAddress, accountId, categoryMap, sendersMap, threadsMap)
  }

  console.info(`[gmail] Synced ${syncedCount} new messages for account ${accountId}`)
}

/**
 * Perform a full sync: fetch the last N messages from the inbox.
 */
async function fullSync(
  gmail: ReturnType<typeof google.gmail>,
  accountEmail: string,
  accountId: string,
  categoryMap: Map<string, string>,
  sendersMap: Map<string, string>,
  threadsMap: Map<string, string>,
): Promise<number> {
  let syncedCount = 0

  // Get historyId first so future incremental syncs can start here.
  const profileRes = await gmail.users.getProfile({ userId: 'me' })
  const newHistoryId = profileRes.data.historyId ?? null

  // Fetch the last 100 messages from the inbox.
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 100,
    labelIds: ['INBOX'],
  })

  const messages = listRes.data.messages ?? []

  for (const msgRef of messages) {
    if (!msgRef.id) continue

    // Skip already-ingested messages.
    const exists = await db.email.findFirst({ where: { accountId, providerMessageId: msgRef.id } })
    if (exists) continue

    const msgRes = await gmail.users.messages.get({ userId: 'me', id: msgRef.id, format: 'full' })
    const raw = parseGmailMessage(msgRes.data, accountEmail)
    if (raw) {
      await ingestEmail(raw, accountId, categoryMap, sendersMap, threadsMap)
      syncedCount++
    }
  }

  // Persist the historyId for future incremental syncs.
  if (newHistoryId) {
    await db.syncState.upsert({
      where: { accountId },
      update: { gmailHistoryId: newHistoryId },
      create: { accountId, gmailHistoryId: newHistoryId, syncStatus: 'success' },
    })
  }

  return syncedCount
}
