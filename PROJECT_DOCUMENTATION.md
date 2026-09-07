# Institutional Email Intelligence — Complete Project Documentation

> **Mail Intelligence** — a production-grade, institutional Gmail command center.
> Built as ONE integrated system: real database, real API contracts, real rules engine,
> real AI orchestrator, real action logging, real revert.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture & Pipeline](#3-architecture--pipeline)
4. [Features That Need Attention](#4-features-that-need-attention)
5. [Dummy Data & Mock Implementations](#5-dummy-data--mock-implementations)
6. [Visual-Only / Cosmetic Features](#6-visual-only--cosmetic-features)
7. [How to Connect the Dummy Features](#7-how-to-connect-the-dummy-features)
8. [API Reference (All Endpoints)](#8-api-reference-all-endpoints)
9. [Frontend Views (All 15)](#9-frontend-views-all-15)
10. [Core Systems & Functions](#10-core-systems--functions)
11. [Database Schema](#11-database-schema)
12. [Security Model](#12-security-model)
13. [Performance Architecture](#13-performance-architecture)
14. [Setup & Running](#14-setup--running)

---

## 1. Project Overview

**Mail Intelligence** is an institutional email command center that sits on top of Gmail and turns a high-volume institute mailbox into an organized, searchable, actionable workspace.

### Core Capabilities
- **Inbox** with master-detail resizable layout, bulk actions, snooze, keyboard shortcuts
- **Organized** institutional sections (Placement, Academic, Professors, Research, etc.)
- **Dashboard** with KPIs, charts, deadline timeline, AI weekly digest
- **AI Assistant** with controlled tools, permission layer, real revert, streaming responses
- **Notifications** with grouped center, per-category preferences
- **Senders** intelligence with detail drawer, quick-add-rule
- **Rules** builder with AND/OR conditions, deterministic priority over AI
- **Compose** with recipient autocomplete, templates, Gmail handoff
- **Search** with structured filters, natural-language, saved searches
- **Deadlines** timeline with action items
- **Archive/Trash** with restore + permanent delete
- **Drafts/Sent/Spam** mailbox views
- **Settings** with 5 theme families, AI prefs, notification prefs, audit log
- **Command Palette** (Cmd+K) with fuzzy search across everything
- **PWA** installable with manifest + icons

### Adaptation Note
The spec proposes Vite/MUI/FastAPI/Supabase/React-Native/Gemini. This environment is **Next.js 16 + Prisma/SQLite + shadcn/ui + z-ai-web-dev-sdk**. We adapt the stack while preserving every user-facing product requirement. The full pipeline (sync → normalize → rules → classify → DB → API → UI) is REAL. The Gmail OAuth source is substituted with a realistic institutional seed corpus that flows through the real normalization/classification pipeline.

---

## 2. Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) |
| Database | Prisma ORM + SQLite |
| State (server) | TanStack Query v5 |
| State (UI) | Zustand (persisted) |
| AI | z-ai-web-dev-sdk (LLM chat + vision) |
| Charts | Recharts |
| Animation | Framer Motion |
| Icons | Lucide React |
| Resizable panels | react-resizable-panels |
| Auth | NextAuth.js v4 (available, demo session used) |
| PWA | Next.js manifest route + sharp-generated icons |

### Key Packages
- `@tanstack/react-query` — server state, caching, optimistic mutations
- `zustand` — UI state (sidebar, compose drawer, command palette, onboarding)
- `framer-motion` — animations (respects prefers-reduced-motion)
- `recharts` — dashboard charts
- `react-resizable-panels` — draggable panel dividers
- `z-ai-web-dev-sdk` — LLM (chat completions + JSON extraction + vision)
- `sonner` — toast notifications
- `cmdk` — command palette
- `date-fns` — date formatting
- `react-hook-form` — form state (compose, rule builder)

---

## 3. Architecture & Pipeline

### High-Level Data Flow

```
Google Gmail (seed corpus in demo)
        ↓
Sync Orchestrator (src/lib/sync/seed.ts)
        ↓
Normalize (sanitize HTML, extract links/deadlines/action items)
        ↓
Deterministic Rules (src/lib/rules/engine.ts)
        ↓
Classification (src/lib/classifier.ts — sender heuristics + keywords)
        ↓
Prisma/SQLite Database
        ↓
API Routes (50 endpoints in src/app/api/)
        ↓
TanStack Query Cache (src/hooks/use-queries.ts)
        ↓
React UI (15 views in src/features/)
```

### AI Pipeline

```
User message
  ↓
Context retrieval (search_emails by extracted keywords) [READ]
  ↓
LLM plan (z-ai-web-dev-sdk chat → structured JSON)
  ↓
Permission layer (src/lib/ai/permissions.ts — server-enforced)
  ↓
Tool execution (src/lib/ai/tools.ts — 15 controlled tools)
  ↓
Action logging (AssistantAction with inverse payload)
  ↓
Structured content + sources → UI
```

### Frontend Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # 50 API route handlers
│   ├── layout.tsx         # Root layout (providers, fonts, metadata)
│   ├── page.tsx           # Main page (view registry + error boundaries + lazy loading)
│   ├── manifest.ts        # PWA manifest
│   └── globals.css        # Theme tokens (5 families × light/dark)
├── components/
│   ├── common/            # ErrorBoundary, SleekSeparator, CategoryIcon, skeletons, states
│   ├── layout/            # AppShell, Sidebar, TopBar, BottomNav, MasterDetailLayout, CommandPalette, OnboardingTour
│   ├── providers.tsx      # QueryClient + Theme + Toaster providers
│   ├── theme/             # ThemeProvider (5 families × light/dark)
│   └── ui/                # shadcn/ui primitives (button, card, dialog, etc.)
├── features/              # 14 feature directories (one per domain)
│   ├── inbox/             # EmailList, EmailDetail, BulkActions, Snooze, SmartReplies
│   ├── organized/         # CategoryCard, CategoryDetail, CreateCategoryDialog
│   ├── dashboard/         # DashboardView, WeeklyDigestCard, DigestViewerDialog
│   ├── deadlines/         # DeadlinesView (timeline + action items)
│   ├── assistant/         # AssistantView, MessageRenderer, ActionLog, ContextMenu, RenameDialog
│   ├── notifications/     # NotificationsView, NotificationGroup, NotificationItem
│   ├── senders/           # SendersView, SenderDetailDrawer
│   ├── rules/             # RulesView, RuleBuilder
│   ├── compose/           # ComposeView, ComposeForm, ComposeDrawer, TemplatesPanel
│   ├── search/            # SearchView, FilterPanel, NaturalLanguagePanel, SavedSearchesPanel
│   ├── settings/          # SettingsView + 8 section components + AuditLog
│   ├── archived/          # ArchivedView, ArchivedList, ArchivedDetail
│   ├── mailbox/           # MailboxFilterView (shared Drafts/Sent/Spam)
│   └── deadlines/         # DeadlinesView
├── hooks/                 # use-queries (37 hooks), use-keyboard-shortcuts, use-prefetch, use-command-data, use-mobile, use-toast
├── lib/
│   ├── ai/                # llm.ts, orchestrator.ts, tools.ts, permissions.ts
│   ├── mutations/         # optimistic.ts (factory), email-mutations.ts
│   ├── rules/             # engine.ts (condition evaluation)
│   ├── sync/              # seed-data.ts (corpus), seed.ts (pipeline)
│   ├── types.ts           # Canonical domain types
│   ├── api-client.ts      # Typed HTTP client
│   ├── query-keys.ts      # TanStack Query key factory
│   ├── mappers.ts         # Prisma → DTO mappers
│   ├── classifier.ts      # Deterministic classification + deadline/action extraction
│   ├── sanitize.ts        # HTML email sanitizer (XSS defense)
│   ├── category-meta.ts   # Color/icon mappings
│   ├── format.ts          # Date/byte/file formatting
│   ├── auth.ts            # Session helper (demo)
│   ├── db.ts              # Prisma client
│   ├── nav.ts             # Navigation config (15 items)
│   ├── shortcuts.ts       # Keyboard shortcut registry
│   └── api-helpers.ts     # Route handler wrappers
├── store/
│   └── ui-store.ts        # Zustand UI state (view, sidebar, command palette, onboarding, compose)
└── prisma/
    └── schema.prisma      # 20+ models
```

---

## 4. Features That Need Attention

### Critical (should be connected for production)

| Feature | Current State | What's Needed |
|---------|--------------|---------------|
| **Gmail OAuth** | Demo seed corpus instead of real Gmail | Implement Google OAuth flow in `src/lib/auth.ts` + real Gmail API sync in `src/lib/sync/`. Replace `ensureSeedData()` with real OAuth callback + `gmail.users.messages.list()` + incremental history sync. |
| **Gmail API send** | `POST /api/compose/send` creates audit event but doesn't actually send | Connect to Gmail API `users.messages.send()` with the connected account's OAuth token. Currently returns a synthetic `messageId`. |
| **Web push notifications** | Permission request UI + in-app notifications only | Add a service worker (`public/sw.js`) + VAPID keys + `web-push` library. The `POST /api/notifications/test` route creates in-app notifications; extend it to also send web push. |
| **Real Gmail sync** | `POST /api/accounts/[id]/sync` just updates `lastSyncedAt` | Implement real incremental sync using Gmail history API (`gmail.users.history.list()` with stored `historyId`). |
| **Semantic search (FE-047)** | Not implemented | Add vector embeddings (e.g. via the LLM) + a similarity index. Currently search is keyword/structured only. |

### Moderate (functional but could be improved)

| Feature | Current State | What's Needed |
|---------|--------------|---------------|
| **Email attachment preview** | "Preview is sandboxed in production" toast | Implement real PDF/image preview in a sandboxed iframe. Attachments are metadata-only (filename, mimeType, size) — no binary download. |
| **Reply/Reply-all/Forward prefill** | Opens compose drawer + toast "prefill loaded" | Actually prefill the ComposeForm with To/CC/Subject/Body from the source email. The `composePrefill` UI store field exists but isn't wired to reply/forward actions. |
| **Web Worker background processing** | All work on main thread | Move AI enrichment, bulk classification, attachment parsing to Web Workers (§26/§35 of directive). |
| **Virtualization for large lists** | Renders all items (30 per page) | Add `@tanstack/react-virtual` for email lists when count > 100. Currently cursor-paginated at 30. |
| **Request cancellation** | No AbortController on search | Add cancellation to search/NL-search/autocomplete so stale responses don't overwrite newer ones (§13). |
| **Mobile apps (React Native)** | Web only | Build React Native apps sharing the TypeScript domain contracts. |

---

## 5. Dummy Data & Mock Implementations

### Seed Email Corpus (Dummy Data)
**Location**: `src/lib/sync/seed-data.ts`

All emails in the app are **dummy seed data** — 31 institutional emails covering Placement, Academic, Professors, Research, Student Welfare, Medical, Hostel, Events, Finance, and Others. They flow through the REAL normalization → rules → classification → persistence pipeline, but they are NOT from a real Gmail account.

The seed account:
- Email: `btech2023.cs@iitjammu.ac.in`
- Name: Aarav Sharma
- Provider account ID: `demo-1043287562398`

### What's Dummy vs Real

| Component | Dummy (demo-only) | Real (production-ready) |
|-----------|-------------------|------------------------|
| Email data source | Seed corpus (31 emails) | — |
| Gmail OAuth | Demo session in `src/lib/auth.ts` | — |
| Gmail API sync | `ensureSeedData()` creates seed | — |
| Gmail API send | Audit event only, no real send | — |
| Database | SQLite (file-based) | Prisma schema works with PostgreSQL by changing the datasource |
| AI | — | Real z-ai-web-dev-sdk LLM calls |
| Rules engine | — | Real deterministic condition evaluation |
| Classification | — | Real sender + keyword heuristics |
| HTML sanitization | — | Real XSS-defense sanitizer |
| Action logging | — | Real audit events in DB |
| Revert | — | Real inverse operations |
| Notifications | — | Real in-app notification creation |
| Deadlines extraction | — | Real regex-based extraction from email text |
| Action items extraction | — | Real verb-based extraction |
| Command palette | — | Real fuzzy search + navigation |
| Keyboard shortcuts | — | Real global shortcut system |
| Resizable panels | — | Real react-resizable-panels |
| PWA | — | Real manifest + icons |
| Themes | — | Real 5 families × light/dark CSS tokens |

---

## 6. Visual-Only / Cosmetic Features

These features have UI but don't perform a real backend operation (or the operation is a no-op/demo):

| Feature | Location | What's Visual-Only |
|---------|----------|-------------------|
| **Archive button in email detail toolbar** | `src/features/inbox/email-detail.tsx` | Shows toast "Archive is cosmetic in this build" — doesn't actually archive. Use the bulk archive or keyboard `e` shortcut for real archive. |
| **Attachment preview button** | `src/features/inbox/email-detail.tsx` | Opens a Dialog showing "Preview is sandboxed in production" — no real preview. |
| **Attachment download button** | `src/features/inbox/email-detail.tsx` | Shows toast — no real download (attachments are metadata-only). |
| **Reply / Reply-all / Forward buttons** | `src/features/inbox/email-detail.tsx` | Opens compose drawer + toast "prefill loaded" — doesn't actually prefill To/Subject/Body. |
| **"Add to deadlines" quick action** | `src/features/inbox/email-detail.tsx` | Shows toast — doesn't create a deadline. |
| **"Create rule from sender" quick action** | `src/features/inbox/email-detail.tsx` | Navigates to Rules + toast — doesn't prefill the sender condition. |
| **"Move to section" quick action** | `src/features/inbox/email-detail.tsx` | Shows toast — doesn't change the email's category. |
| **Test notification button (web/push)** | `src/features/settings/notification-preferences-section.tsx` | Creates an in-app notification only. Web push requires service worker. |
| **"Request permission" for notifications** | `src/features/settings/notification-preferences-section.tsx` | Calls `Notification.requestPermission()` but no service worker to deliver pushes. |
| **Sign out button** | `src/features/settings/security-section.tsx` | Clears localStorage prefs + toast — no real session to sign out of. |
| **Onboarding tour spotlight** | `src/components/layout/onboarding-tour.tsx` | Visual spotlight only — doesn't block interactions. |
| **Importance threshold select** | `src/features/settings/notification-preferences-section.tsx` | Stored in localStorage only — backend doesn't filter by threshold yet. |
| **Quiet hours** | Not implemented | — |

---

## 7. How to Connect the Dummy Features

### 7.1 Connect Real Gmail OAuth

**Replace** `src/lib/auth.ts`:

```typescript
// Current (demo):
import { ensureSeedData } from '@/lib/sync/seed'
export async function getSession() {
  const { accountId, userId } = await ensureSeedData()
  // ...returns demo session
}

// Production:
// 1. Install @auth/core + google provider
// 2. Configure NextAuth with Google OAuth in src/app/api/auth/[...nextauth]/route.ts
// 3. Store OAuth tokens (access + refresh) in a new OAuthCredential model
// 4. getSession() reads the session cookie → resolves userId + active accountId
```

### 7.2 Connect Real Gmail Sync

**Replace** `src/lib/sync/seed.ts` → create `src/lib/sync/gmail.ts`:

```typescript
import { google } from 'googleapis'

export async function syncAccount(accountId: string, userId: string) {
  const account = await db.accountConnection.findUnique({ where: { id: accountId } })
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  oauth2Client.setCredentials({
    access_token: account.accessToken,  // from OAuthCredential model
    refresh_token: account.refreshToken,
  })
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  // Incremental sync using historyId
  const syncState = await db.syncState.findUnique({ where: { accountId } })
  const history = await gmail.users.history.list({
    userId: 'me',
    startHistoryId: syncState.gmailHistoryId,
  })

  for (const change of history.data.history ?? []) {
    for (const msg of change.messagesAdded ?? []) {
      const full = await gmail.users.messages.get({ userId: 'me', id: msg.message.id })
      await ingestEmail(full.data, accountId)  // reuse existing normalize + classify pipeline
    }
  }

  // Advance cursor
  await db.syncState.update({ where: { accountId }, data: { gmailHistoryId: history.data.historyId } })
}
```

### 7.3 Connect Real Gmail Send

**Replace** `src/app/api/compose/send/route.ts`:

```typescript
// Current: creates audit event, returns synthetic messageId
// Production:
import { google } from 'googleapis'

export async function POST(req: Request) {
  // ... existing validation + confirmation check ...
  const raw = createMimeMessage(body)  // build RFC 2822 message
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw: Buffer.from(raw).toString('base64url') } })
  // ... audit event ...
}
```

### 7.4 Connect Reply/Forward Prefill

**In** `src/features/inbox/email-detail.tsx`, wire the reply button:

```typescript
const handleReply = () => {
  const prefill = {
    to: [{ email: email.fromEmail, name: email.fromName }],
    subject: `Re: ${email.subject}`,
    body: `\n\n---\nOn ${formatDateTime(email.receivedAt)}, ${email.fromName} wrote:\n${email.bodyText?.slice(0, 500)}`,
  }
  setComposePrefill(prefill)  // already in ui-store
  setComposeOpen(true)
}
```

Then in `ComposeForm`, read `composePrefill` on mount:

```typescript
const prefill = useUIStore(s => s.composePrefill)
const [to, setTo] = useState(prefill?.to ?? [])
const [subject, setSubject] = useState(prefill?.subject ?? '')
const [body, setBody] = useState(prefill?.body ?? '')
```

### 7.5 Connect Web Push Notifications

1. **Generate VAPID keys**: `npx web-push generate-vapid-keys`
2. **Add to `.env`**:
   ```
   VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   ```
3. **Create service worker** (`public/sw.js`):
   ```javascript
   self.addEventListener('push', (event) => {
     const data = event.data.json()
     self.registration.showNotification(data.title, { body: data.body })
   })
   ```
4. **Register SW** in `src/app/layout.tsx`
5. **Create subscribe endpoint** `POST /api/notifications/subscribe` that stores push subscriptions
6. **Update** `POST /api/notifications/test` to also call `webpush.sendNotification()`

### 7.6 Connect Attachment Preview

1. **Store attachment binaries**: Add an `AttachmentBlob` model or use file storage
2. **Create download endpoint**: `GET /api/emails/[id]/attachments/[attachmentId]` → streams binary
3. **PDF preview**: Use `<iframe src={url}>` in a sandboxed Dialog
4. **Image preview**: Use `<img src={url}>` in a Dialog

---

## 8. API Reference (All Endpoints)

### Authentication & Accounts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/accounts` | List connected accounts |
| POST | `/api/accounts` | Connect a Google account (demo: creates seed) |
| POST | `/api/accounts/[accountId]/sync` | Request sync/reconciliation |
| DELETE | `/api/accounts/[accountId]` | Disconnect account (confirmation required) |

### Emails
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/emails` | List emails (cursor-paginated, filters: categoryId, senderId, unreadOnly, importantOnly, starredOnly, snoozedOnly, archivedOnly, filter=drafts\|sent\|spam) |
| GET | `/api/emails/[messageId]` | Full email detail |
| POST | `/api/emails/[messageId]/read` | Mark read/unread |
| POST | `/api/emails/[messageId]/star` | Star/unstar |
| POST | `/api/emails/[messageId]/important` | Mark important/unimportant |
| POST | `/api/emails/[messageId]/snooze` | Snooze until date (or unsnooze) |
| POST | `/api/emails/[messageId]/restore` | Un-archive |
| DELETE | `/api/emails/[messageId]/permanent-delete` | Hard delete (confirmation required) |
| GET | `/api/emails/[messageId]/classification` | Latest classification result |
| POST | `/api/emails/[messageId]/smart-replies` | AI-generated reply suggestions |
| POST | `/api/emails/bulk` | Bulk action (read/unread/star/unstar/important/unimportant/archive/delete) |
| GET | `/api/emails/drafts` | List drafts (alias for ?filter=drafts) |
| GET | `/api/emails/sent` | List sent (alias for ?filter=sent) |
| GET | `/api/threads/[threadId]` | Thread context |

### Categories
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/categories` | List with counts |
| POST | `/api/categories` | Create custom section |
| PATCH | `/api/categories/[categoryId]` | Update |
| DELETE | `/api/categories/[categoryId]` | Delete (moves emails to Others) |

### Senders
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/senders` | List sender intelligence |
| GET | `/api/senders/[senderId]` | Sender detail |

### Rules
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/rules` | List rules |
| POST | `/api/rules` | Create rule (with version snapshot) |
| PATCH | `/api/rules/[ruleId]` | Update rule (new version) |
| DELETE | `/api/rules/[ruleId]` | Delete rule |

### Search
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/search` | Structured search (filters → results) |
| POST | `/api/search/natural-language` | NL → structured filters (via LLM) |

### Saved Searches
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/saved-searches` | List saved searches |
| POST | `/api/saved-searches` | Create saved search |
| DELETE | `/api/saved-searches/[id]` | Delete saved search |

### Dashboard
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard` | Aggregated KPIs, charts, deadlines, recent activity |

### Deadlines & Action Items
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/deadlines` | List deadlines (?status=open\|done\|missed\|all) |
| PATCH | `/api/deadlines/[id]` | Update deadline status |
| DELETE | `/api/deadlines/[id]` | Delete deadline |
| GET | `/api/action-items` | List action items |
| PATCH | `/api/action-items/[id]` | Update action item status |
| DELETE | `/api/action-items/[id]` | Delete action item |

### Notifications
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | Grouped notifications (?filter=all\|unread\|important) |
| POST | `/api/notifications/[id]/read` | Mark read |
| POST | `/api/notifications/read-all` | Mark all read |
| DELETE | `/api/notifications/[id]` | Delete notification |
| POST | `/api/notifications/test` | Create test notification |
| GET | `/api/notification-preferences` | List per-category preferences |
| PUT | `/api/notification-preferences` | Update preference |

### AI Assistant
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/assistant/conversations` | List conversations (?includeArchived=true) |
| POST | `/api/assistant/conversations` | Create conversation |
| PATCH | `/api/assistant/conversations/[id]` | Rename / archive / unarchive |
| DELETE | `/api/assistant/conversations/[id]` | Delete conversation |
| GET | `/api/assistant/conversations/[id]/messages` | List messages |
| POST | `/api/assistant/conversations/[id]/messages` | Send message → AI response |
| GET | `/api/assistant/conversations/[id]/actions` | Action log |
| GET | `/api/assistant/conversations/[id]/export` | Printable HTML export |
| POST | `/api/assistant/actions/[id]/revert` | Execute recorded inverse operation |
| POST | `/api/assistant/digest` | Generate weekly digest (via LLM) |

### Compose
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/compose/drafts` | Save draft |
| POST | `/api/compose/send` | Send email (confirmation required) |
| GET | `/api/recipients/search` | Recipient autocomplete |

### Templates
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/templates` | List email templates |
| POST | `/api/templates` | Create template |
| PUT | `/api/templates/[id]` | Update template |
| DELETE | `/api/templates/[id]` | Delete template |

### Audit
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/audit-events` | List audit events (?type=&surface=&cursor=) |

---

## 9. Frontend Views (All 15)

| View | Nav Key | Icon | Description |
|------|---------|------|-------------|
| Inbox | `inbox` | Inbox | Master-detail email list with filters, bulk actions, snooze |
| Organized | `organized` | LayoutGrid | Category grid + per-category email list |
| Dashboard | `dashboard` | LayoutDashboard | KPIs, charts, deadlines, AI digest |
| Deadlines | `deadlines` | CalendarClock | Deadline timeline + action items |
| AI Assistant | `assistant` | Sparkles | 3-panel chat workspace with tools |
| Notifications | `notifications` | Bell | Grouped notification center |
| Senders | `senders` | Users | Sender intelligence + detail drawer |
| Rules | `rules` | Workflow | Rule list + visual builder |
| Compose | `compose` | PenSquare | Email compose form |
| Search | `search` | Search | Structured + NL search + saved searches |
| Settings | `settings` | Settings | 8 sections (accounts, appearance, AI, notifications, privacy, security, audit log) |
| Archive | `archived` | Archive | Archived emails with restore/delete |
| Drafts | `drafts` | FileEdit | Draft emails (shared MailboxFilterView) |
| Sent | `sent` | Send | Sent emails (shared MailboxFilterView) |
| Spam | `spam` | ShieldAlert | Spam emails (shared MailboxFilterView) |

### Mobile Navigation
Bottom nav (mobile only): Home (Inbox), Organized, AI, Alerts (Notifications), Stats (Dashboard). All other views accessible via sidebar (desktop) or command palette.

---

## 10. Core Systems & Functions

### 10.1 Classification Pipeline (`src/lib/classifier.ts`)

```
classifyByEmail(input) → { categoryName, source, confidence, rationale }
```

**Priority**: manual_rules → user_overrides → sender_rules → ai → system_default (Others)

**Functions**:
- `classifyByEmail()` — deterministic sender + keyword heuristics
- `extractDeadlines()` — regex-based deadline extraction from email text
- `extractActionItems()` — verb-based action item extraction

### 10.2 Rule Engine (`src/lib/rules/engine.ts`)

```
evaluateExpression(expression, context) → boolean
summarizeExpression(group) → string
```

Supports AND/OR condition groups with 18 field types (sender, sender_email, subject, contains_text, has_attachment, date, time, labels, etc.) and 11 operators (equals, contains, starts_with, before, is_true, etc.).

### 10.3 AI Orchestrator (`src/lib/ai/orchestrator.ts`)

```
runAssistant(input) → { content, sources, actions }
```

**Flow**: extract keywords → retrieve context → LLM plan → permission-gated tool execution → action logging → structured content + sources.

### 10.4 AI Tools (`src/lib/ai/tools.ts`)

15 controlled tools with risk classes:
- **READ**: search_emails, get_email, list_categories, list_senders, list_notifications, generate_summary
- **REVERSIBLE_WRITE**: create_category, create_rule, mark_read, mark_unread, star_email, create_deadline, create_draft
- **SENSITIVE**: send_email, delete_rule

Each tool has: inputSchema, risk, requiresConfirmation, execute(), inverse (for revert).

### 10.5 Permission System (`src/lib/ai/permissions.ts`)

```
evaluatePermission(toolName, mode, confirmed) → { allowed, requiresConfirmation, reason }
```

Server-enforced. Sensitive actions always require confirmation. Suggest mode requires confirmation for all writes.

### 10.6 HTML Sanitizer (`src/lib/sanitize.ts`)

- `sanitizeHtml()` — strips scripts, event handlers, dangerous URLs, unsafe tags
- `extractUrls()` — extracts URLs from plain text
- `htmlToText()` — strips HTML to plain text
- `makeSnippet()` — creates truncated preview

### 10.7 Optimistic Mutation System (`src/lib/mutations/optimistic.ts`)

```
createOptimisticMutation(config) → useMutation hook
```

Generic factory implementing: snapshot cache → optimistic apply → rollback on error. Used by `useOptimisticMarkRead`, `useOptimisticStar`, `useOptimisticImportant`.

### 10.8 Sync Pipeline (`src/lib/sync/seed.ts`)

```
ensureSeedData() → { accountId, userId }
```

Idempotent: creates user + account + sync state + 10 default categories + 3 default rules + ingests 31 seed emails through the real pipeline (normalize → classify → persist → extract deadlines/action items → create notifications).

### 10.9 Error Boundaries (`src/components/common/error-boundary.tsx`)

`ViewErrorBoundary` wraps each view — a crash in one view doesn't break others. Fallback UI with Retry + Reload buttons.

### 10.10 Resizable Layouts (`src/components/layout/master-detail-layout.tsx`)

- `MasterDetailLayout` — 2-panel resizable (inbox, organized, archived, mailbox)
- `ThreePanelLayout` — 3-panel resizable (AI assistant)

Min/max limits enforced. Panel sizes persisted to localStorage.

### 10.11 Keyboard Shortcuts (`src/hooks/use-keyboard-shortcuts.ts`)

- `?` — help dialog
- `g` then `i/o/d/l/a/n/s/r/c/f/,` — Gmail-style navigation
- `j/k` — next/prev email (inbox)
- `e/s/i/r/f/#` — archive/star/important/reply/forward/delete (inbox)
- `Cmd+K` — command palette
- `/` — focus search

### 10.12 Command Palette (`src/components/layout/command-palette.tsx`)

Fuzzy search across emails, senders, categories, and actions. Recent searches persisted. Lazy data loading.

### 10.13 Prefetching (`src/hooks/use-prefetch.ts`)

- `usePrefetchEmail()` — prefetch email detail on row hover
- `usePrefetchThread()` — prefetch thread context
- Inbox prefetches next/prev email on selection

---

## 11. Database Schema

**Location**: `prisma/schema.prisma`

### Models (20+)

| Model | Purpose |
|-------|---------|
| User | Application user |
| AccountConnection | Connected Google account |
| SyncState | Gmail sync cursor (historyId, lastSyncedAt) |
| Thread | Email thread |
| Sender | Sender intelligence (frequency, domain, ruleStatus) |
| Category | Institutional section (Placement, Academic, etc.) |
| Email | Normalized email (subject, body, flags, classification) |
| EmailAttachment | Attachment metadata |
| CategoryMembership | Email ↔ Category with source + confidence |
| ClassificationResult | Classification audit (source, category, confidence, rationale) |
| Rule | Deterministic rule (expression + actions + priority) |
| RuleVersion | Version snapshot for audit |
| UserOverride | Manual override (highest priority) |
| Deadline | Tracked deadline (title, dueAt, status) |
| ActionItem | Tracked action item |
| Notification | In-app notification |
| NotificationPreference | Per-category notification prefs |
| AssistantConversation | AI conversation (mode, archived, expiresAt) |
| AssistantMessage | Chat message (role, structured content, sources) |
| AssistantAction | Tool action with inverse payload (for revert) |
| AuditEvent | Audit log (eventType, targetType, sourceSurface) |
| Draft | Compose draft |
| SavedSearch | Saved filter preset |
| EmailTemplate | Reusable email template |

---

## 12. Security Model

### Secrets (server-only, never exposed to client)
- Google OAuth client secret (not configured in demo)
- Gmail refresh tokens (not configured in demo)
- Gemini/z-ai API keys (handled by z-ai-web-dev-sdk)

### Account Isolation
Every query is scoped by `accountId` derived from the authenticated session. The backend NEVER trusts client-supplied account IDs.

### HTML Email Security
- All email HTML is sanitized via `src/lib/sanitize.ts` before rendering
- Scripts, event handlers, dangerous URLs stripped
- External links forced to `target="_blank" rel="noopener noreferrer nofollow"`

### AI Prompt Injection Defense
- Retrieved email content is inserted as QUOTED UNTRUSTED DATA
- System policy, tool permissions, and user request are strictly separated
- Tool permissions evaluated server-side, never by model output
- Confirmation gates enforced by backend

### Sensitive Action Confirmation
- Send email, delete, disconnect account, destructive rule changes → require `{ confirm: true }` in request body
- Server returns 409 if confirmation missing

### Audit Logging
Every significant action creates an `AuditEvent` with: actor, account, event type, target, source surface (UI/AI/API), timestamp.

---

## 13. Performance Architecture

### Optimistic UI
- `createOptimisticMutation` factory (§9 of directive)
- Mark read/star/important update instantly with rollback on error
- Applies across all cached email lists simultaneously

### Code Splitting
- 5 heavy views lazy-loaded: Assistant, Dashboard, Settings, Search, Compose
- `ViewSuspense` wrapper with loading spinner
- Inbox + lighter views load statically for instant default

### Prefetching
- Email detail prefetched on row hover
- Next/prev email prefetched on selection (for instant j/k navigation)
- Thread context prefetched

### Caching (TanStack Query)
- Stable query keys via `src/lib/query-keys.ts`
- 30s stale time default
- Targeted invalidation (not full refetch)
- `placeholderData: (prev) => prev` for smooth refetches

### Error Boundaries
- Per-view isolation — a crash in AI doesn't break Inbox
- Retry + Reload fallback UI

### Responsive
- No horizontal overflow at 320–2560px
- Resizable panels with min/max limits
- Mobile bottom nav + desktop sidebar
- `prefers-reduced-motion` respected

---

## 14. Setup & Running

### Prerequisites
- Node.js 20+ or Bun 1.3+
- SQLite (bundled with Prisma)

### Install
```bash
bun install
```

### Database
```bash
bun run db:push    # Create schema + seed
```

### Dev
```bash
bun run dev        # http://localhost:3000
```

### Lint + Typecheck
```bash
bun run lint
npx tsc --noEmit
```

### Environment Variables
```
DATABASE_URL=file:/home/z/my-project/db/custom.db
```

For production Gmail integration, add:
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

### PWA Icons
```bash
bun run src/scripts/generate-icons.ts
```

---

## File Count Summary

| Category | Count |
|----------|-------|
| Source files (.ts/.tsx) | 209 |
| API routes | 50 |
| Feature directories | 14 |
| shadcn/ui components | 65 |
| Prisma models | 20+ |
| Frontend views | 15 |
| Custom hooks | 37+ (in use-queries.ts) |
| Theme families | 5 (× light/dark = 10 variants) |

---

*This documentation is the single source of truth for the Mail Intelligence application.*
*Last updated: Round 7 (Task 14) — professional architecture improvements.*
