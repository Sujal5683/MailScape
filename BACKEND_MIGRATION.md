# Backend Migration — Next.js → FastAPI

> **Task ID:** 16-DOC · **Status:** Living document · **Owner:** backend-migration
> **Last updated:** this iteration
>
> This is §5 of the institutional spec. It maps the current Next.js App
> Router backend to its target FastAPI implementation, gives a per-endpoint
> inventory of all 54 routes (covering 50+ unique endpoints across 16
> domains), defines the iteration plan (0–20), enumerates the risks +
> rollback strategy, and provides the performance baseline template that
> every iteration must populate before being marked *Verified*.

---

## Table of contents

1. [Current architecture map](#1-current-architecture-map)
2. [Endpoint inventory (54 routes)](#2-endpoint-inventory-54-routes)
3. [Migration matrix (16 domains)](#3-migration-matrix-16-domains)
4. [Migration order — iterations 0–20](#4-migration-order--iterations-020)
5. [Risks & rollback strategy](#5-risks--rollback-strategy)
6. [Performance baseline template](#6-performance-baseline-template)
7. [Known defects to fix during migration](#7-known-defects-to-fix-during-migration)

---

## 1. Current architecture map

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Browser / SPA (src/features/*)                                           │
│   ↓ fetch('/api/...')                                                    │
├──────────────────────────────────────────────────────────────────────────┤
│ Next.js 16 App Router (src/app/api/**/route.ts)                          │
│   • 54 route files, ~80 HTTP method handlers                            │
│   • 'force-dynamic' on every route (no ISR)                              │
│   • Each handler: getSession() → db.* → NextResponse.json()              │
│   • Body parsing + ApiError throws via src/lib/api-helpers.ts            │
├──────────────────────────────────────────────────────────────────────────┤
│ Service layer (src/lib/*)                                                │
│   • auth.ts        — demo session (userId + accountId)                   │
│   • db.ts          — Prisma client singleton                            │
│   • mappers.ts     — DB rows → DTOs                                      │
│   • classifier.ts  — rules engine + AI classification                   │
│   • conversations/ — resolver, mappers, types                           │
│   • ai/            — llm.ts (z-ai-web-dev-sdk), orchestrator, tools     │
│   • rules/engine.ts, sanitize.ts, sync/seed.ts                          │
├──────────────────────────────────────────────────────────────────────────┤
│ Database                                                                  │
│   • Prisma ORM (sqlite provider, schema.prisma)                          │
│   • 27 models (User, AccountConnection, SyncState, Thread, Sender,       │
│     Category, Email, EmailAttachment, CategoryMembership,                 │
│     ClassificationResult, Rule, RuleVersion, UserOverride, Deadline,      │
│     ActionItem, Notification, NotificationPreference,                    │
│     AssistantConversation, AssistantMessage, AssistantAction,            │
│     AuditEvent, Draft, SavedSearch, EmailTemplate, Conversation,         │
│     EmailRelationship, ConversationOverride)                            │
│   • Storage: db/custom.db (SQLite file)                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Technology snapshot

| Concern | Current | Target |
|---|---|---|
| HTTP framework | Next.js 16 App Router (`route.ts` files) | FastAPI 0.110+ (Pydantic v2) |
| Language | TypeScript 5 | Python 3.12 |
| ORM | Prisma Client (sqlite) | SQLAlchemy 2.x async / SQLModel |
| Database | SQLite (`db/custom.db`) | PostgreSQL 15+ (Supabase) |
| Auth | Demo session via `getSession()` (single demo user) | Supabase Auth (email + Google OAuth) → JWT in `Authorization` header |
| Session resolution | `ensureSeedData()` cached in-process | Per-request JWT decode → `current_account_id()` SQL function |
| AI / LLM | `z-ai-web-dev-sdk` (`src/lib/ai/llm.ts`, server-only) | Same SDK via server-side Python bindings (or migrate to OpenAI-compatible HTTP) |
| Background sync | Inline `ensureSeedData()` on first request | APScheduler / Celery worker hitting Gmail API |
| Real-time | Polling (TanStack Query refetch) | WebSocket / Socket.io mini-service (Caddy-routed, see §4) |
| Validation | Hand-rolled `readBody<T>` + `ApiError` | Pydantic v2 request models + FastAPI `HTTPException` |
| Audit | `db.auditEvent.create({...})` inline in each handler | FastAPI dependency `audit(event_type, target)` decorator |
| Schema migrations | Prisma `db:push` (development only) | Alembic (versioned, reversible) |

### 1.2 Cross-cutting invariants

These must hold on both sides of the migration. Any iteration that breaks
them is not *Verified*.

1. **Account-level isolation.** Every query filters by `accountId = session.accountId`. The session is resolved once per request and the `accountId` is propagated to every DB call. Never trust a client-supplied `accountId`.
2. **Audit on every mutation.** Every POST/PATCH/PUT/DELETE writes one `AuditEvent` row with `userId`, `accountId`, `eventType`, `targetType`, `targetId`, `sourceSurface`, and a JSONB `metadata` blob.
3. **Soft-delete by default.** "Delete" routes set `isArchived = true` (or the equivalent). The only hard-delete route is `DELETE /api/emails/[messageId]/permanent-delete` (gated by a confirmation flag).
4. **Confirmation gating on sensitive actions.** `POST /api/compose/send`, `DELETE /api/emails/[messageId]/permanent-delete`, and `POST /api/assistant/actions/[id]/revert` all require an explicit `confirm: true` (or equivalent) flag from the client.
5. **Deterministic conversation resolution.** New emails flow through `resolveConversation()` (Gmail threadId → subject+participants → subject+sender+time). This logic must be ported verbatim, not re-implemented loosely.
6. **JSON-in-TEXT fields.** Recipients, labels, rule expressions, audit metadata, and `participantSummary` are serialized JSON. The Postgres schema upgrades these to native `JSONB` (see `backend/sql/001_initial_schema.sql`).

---

## 2. Endpoint inventory (54 routes)

The current codebase has **54 `route.ts` files** under `src/app/api/`. Each
file maps to one logical endpoint (with one or more HTTP methods). The
"Domain" column tags the route for the migration matrix in §3. "Auth" is
always `session` (the demo `getSession()` helper) unless noted. "Side
effects" lists anything beyond the obvious SELECT.

> **Risk levels**
> - **L (low)** — read-only, idempotent.
> - **M (medium)** — mutates one row, audited, easily reversible.
> - **H (high)** — mutates many rows, sends external email, or is irreversible.

### 2.1 Auth

| # | Path | Method(s) | Purpose | Auth | DB dependencies | Side effects | Risk |
|---|---|---|---|---|---|---|---|
| 1 | `/api` | GET | Root health check | none | none | none | L |

### 2.2 Accounts

| # | Path | Method(s) | Purpose | Auth | DB dependencies | Side effects | Risk |
|---|---|---|---|---|---|---|---|
| 2 | `/api/accounts` | GET | List accounts for the current user | session | `accountConnection.findMany({userId})` include `syncState` | none | L |
| 3 | `/api/accounts` | POST | "Connect" a Google account (idempotent seed creator in demo) | session | `ensureSeedData()` → `accountConnection.findUnique` | Creates user+account+syncState+categories on first call | M |
| 4 | `/api/accounts/[accountId]` | POST | Trigger a sync for the account | session | `accountConnection.findUnique`, `syncState.update` | Writes `syncState.syncStatus='syncing'` | M |
| 5 | `/api/accounts/[accountId]` | DELETE | Disconnect the account (cascade delete) | session | `accountConnection.delete` | Cascades to all child rows (threads, emails, rules…) | H |

### 2.3 Emails

| # | Path | Method(s) | Purpose | Auth | DB dependencies | Side effects | Risk |
|---|---|---|---|---|---|---|---|
| 6 | `/api/emails` | GET | Cursor-paginated inbox list with filters (unread / starred / important / snoozed / archived / drafts / sent / spam / by category / by sender) | session | `email.findMany` + `email.count` | none | L |
| 7 | `/api/emails/drafts` | GET | List drafts (`isDraft=true`) | session | `email.findMany({isDraft:true})` | none | L |
| 8 | `/api/emails/sent` | GET | List sent (`isSent=true`) | session | `email.findMany({isSent:true})` | none | L |
| 9 | `/api/emails/bulk` | POST | Apply `read/unread/star/unstar/important/unimportant/archive/delete` to many ids | session | `email.findMany` (ownership) → `email.updateMany` + `auditEvent.create` | Single summarizing `BULK_*` audit event; soft-delete aliases to archive | M |
| 10 | `/api/emails/[messageId]` | GET | Single-email detail (includes attachments + memberships) | session | `email.findFirst({id, accountId})` include `attachments`, `memberships.category` | none | L |
| 11 | `/api/emails/[messageId]/read` | POST | Toggle `isRead` | session | `email.update` + `auditEvent.create` (`EMAIL_MARKED_READ/UNREAD`) | audit | M |
| 12 | `/api/emails/[messageId]/star` | POST | Toggle `isStarred` | session | `email.update` + audit | audit | M |
| 13 | `/api/emails/[messageId]/important` | POST | Toggle `isImportant` | session | `email.update` + audit | audit | M |
| 14 | `/api/emails/[messageId]/snooze` | POST | Set/clear `snoozedUntil` | session | `email.update` + audit | audit | M |
| 15 | `/api/emails/[messageId]/restore` | POST | Un-archive (`isArchived=false`) | session | `email.update` + audit | audit | M |
| 16 | `/api/emails/[messageId]/permanent-delete` | DELETE | Hard-delete (gated by `confirm=true`) | session | `email.delete` + audit | **Irreversible** — cascade removes attachments, memberships, classifications | H |
| 17 | `/api/emails/[messageId]/smart-replies` | POST | LLM-generated short reply suggestions | session | `email.findFirst` → `chat()` (LLM) | LLM call; no DB write | M |
| 18 | `/api/emails/[messageId]/classification` | GET | Return the email's current classification + history | session | `classificationResult.findMany` + `categoryMembership.findMany` | none | L |
| 19 | `/api/emails/[messageId]/conversation` | GET | Look up the conversation this email belongs to | session | `thread.findUnique` → `conversation.findFirst` → `mapConversationDetail` | none | L |

### 2.4 Threads

| # | Path | Method(s) | Purpose | Auth | DB dependencies | Side effects | Risk |
|---|---|---|---|---|---|---|---|
| 20 | `/api/threads/[threadId]` | GET | Thread detail with all member emails | session | `thread.findFirst({id, accountId})` include `emails` | none | L |

### 2.5 Conversations

| # | Path | Method(s) | Purpose | Auth | DB dependencies | Side effects | Risk |
|---|---|---|---|---|---|---|---|
| 21 | `/api/conversations` | GET | List conversations (filters: `status`, `followUp`) | session | `conversation.findMany({accountId})` include `_count.threads` | none | L |
| 22 | `/api/conversations/[id]` | GET | Conversation detail (messages + changes) | session | `conversation.findFirst` include `threads.emails.memberships.category` | none | L |
| 23 | `/api/conversations/[id]` | PATCH | Update `status` / `followUpState` / `importance` | session | `conversation.findFirst` → `conversation.update` + `auditEvent.create` (`CONVERSATION_UPDATED`) | audit | M |

### 2.6 Categories

| # | Path | Method(s) | Purpose | Auth | DB dependencies | Side effects | Risk |
|---|---|---|---|---|---|---|---|
| 24 | `/api/categories` | GET | List categories (`sortOrder` asc) | session | `category.findMany({accountId})` | none | L |
| 25 | `/api/categories` | POST | Create a custom category | session | `category.create` + audit | audit | M |
| 26 | `/api/categories/[categoryId]` | PATCH | Rename / recolor / re-order | session | `category.update` + audit | audit | M |
| 27 | `/api/categories/[categoryId]` | DELETE | Delete category (cascade memberships) | session | `category.delete` + audit | Cascade-deletes `category_membership` rows | M |

### 2.7 Senders

| # | Path | Method(s) | Purpose | Auth | DB dependencies | Side effects | Risk |
|---|---|---|---|---|---|---|---|
| 28 | `/api/senders` | GET | List senders (`messageCount` desc) | session | `sender.findMany({accountId})` | none | L |
| 29 | `/api/senders/[senderId]` | GET | Sender detail with recent emails | session | `sender.findFirst` include `emails` | none | L |

### 2.8 Rules

| # | Path | Method(s) | Purpose | Auth | DB dependencies | Side effects | Risk |
|---|---|---|---|---|---|---|---|
| 30 | `/api/rules` | GET | List rules (`priority` asc) | session | `rule.findMany({accountId})` | none | L |
| 31 | `/api/rules` | POST | Create a rule (writes a `rule_version` row too) | session | `rule.create` + `ruleVersion.create` + audit | audit | M |
| 32 | `/api/rules/[ruleId]` | PATCH | Update expression/actions/priority (creates a new `rule_version`) | session | `rule.update` + `ruleVersion.create` + audit | audit | M |
| 33 | `/api/rules/[ruleId]` | DELETE | Delete rule (cascade versions) | session | `rule.delete` + audit | Cascade-deletes `rule_version` | M |

### 2.9 Search

| # | Path | Method(s) | Purpose | Auth | DB dependencies | Side effects | Risk |
|---|---|---|---|---|---|---|---|
| 34 | `/api/search` | POST | Structured filter search across emails | session | `email.findMany` with composed `where` | none | L |
| 35 | `/api/search/natural-language` | POST | Natural-language search (LLM extracts filters) | session | `email.findMany` after LLM filter extraction | LLM call; no DB write | M |
| 36 | `/api/saved-searches` | GET | List saved filter presets | session | `savedSearch.findMany` | none | L |
| 37 | `/api/saved-searches` | POST | Save a filter preset | session | `savedSearch.create` + audit | audit | M |
| 38 | `/api/saved-searches/[id]` | DELETE | Delete a saved search | session | `savedSearch.delete` + audit | audit | M |

### 2.10 Notifications

| # | Path | Method(s) | Purpose | Auth | DB dependencies | Side effects | Risk |
|---|---|---|---|---|---|---|---|
| 39 | `/api/notifications` | GET | List notifications (`createdAt` desc) | session | `notification.findMany({accountId})` | none | L |
| 40 | `/api/notifications/[id]` | DELETE | Delete a notification | session | `notification.delete` + audit | audit | M |
| 41 | `/api/notifications/[id]/read` | POST | Mark a single notification as read | session | `notification.update({isRead:true})` + audit | audit | M |
| 42 | `/api/notifications/read-all` | POST | Mark all notifications as read | session | `notification.updateMany({isRead:true})` + audit | Bulk update | M |
| 43 | `/api/notifications/test` | POST | Generate a test notification (dev tool) | session | `notification.create` + audit | audit | M |
| 44 | `/api/notification-preferences` | GET | List per-channel / per-category preferences | session | `notificationPreference.findMany` | none | L |
| 45 | `/api/notification-preferences` | PUT | Upsert preference set | session | `notificationPreference.upsert` + audit | audit | M |

### 2.11 Compose

| # | Path | Method(s) | Purpose | Auth | DB dependencies | Side effects | Risk |
|---|---|---|---|---|---|---|---|
| 46 | `/api/compose/drafts` | POST | Save a draft (`draft.create`) | session | `draft.create` + audit | audit | M |
| 47 | `/api/compose/send` | POST | Send an email (gated by `confirm=true`) | session | `auditEvent.create` (`EMAIL_SENT`) | **External side effect** (would call Gmail API); in demo only writes audit row | H |
| 48 | `/api/recipients/search` | GET | Recipient autocomplete (searches senders + emails) | session | `sender.findMany` + `email.findMany` | none | L |
| 49 | `/api/templates` | GET | List email templates | session | `emailTemplate.findMany` | none | L |
| 50 | `/api/templates` | POST | Create a template | session | `emailTemplate.create` + audit | audit | M |
| 51 | `/api/templates/[id]` | PUT | Update a template | session | `emailTemplate.update` + audit | audit | M |
| 52 | `/api/templates/[id]` | DELETE | Delete a template | session | `emailTemplate.delete` + audit | audit | M |

### 2.12 Assistant

| # | Path | Method(s) | Purpose | Auth | DB dependencies | Side effects | Risk |
|---|---|---|---|---|---|---|---|
| 53 | `/api/assistant/conversations` | GET | List assistant conversations (excludes archived) | session | `assistantConversation.findMany({userId})` | none | L |
| 54 | `/api/assistant/conversations` | POST | Create a new assistant conversation | session | `assistantConversation.create` | none | M |
| 55 | `/api/assistant/conversations/[id]` | PATCH | Rename / archive / change mode | session | `assistantConversation.update` + audit | audit | M |
| 56 | `/api/assistant/conversations/[id]` | DELETE | Delete conversation (cascade messages + actions) | session | `assistantConversation.delete` | Cascade | M |
| 57 | `/api/assistant/conversations/[id]/messages` | GET | List messages (`createdAt` asc) | session | `assistantMessage.findMany` | none | L |
| 58 | `/api/assistant/conversations/[id]/messages` | POST | Send a user message → run orchestrator → persist assistant reply + actions | session | `assistantMessage.create` (user) → `orchestrator.run()` → `assistantMessage.create` (assistant) + `assistantAction.create` (per tool call) | **LLM call**; may execute reversible tool actions (categorize / star / snooze) | H |
| 59 | `/api/assistant/conversations/[id]/actions` | GET | List actions taken in a conversation | session | `assistantAction.findMany` | none | L |
| 60 | `/api/assistant/conversations/[id]/export` | GET | Export conversation as Markdown | session | `assistantConversation.findFirst` include `messages` | none | L |
| 61 | `/api/assistant/actions/[id]/revert` | POST | Revert a reversible assistant action (gated by `confirm=true`) | session | `assistantAction.update({status:'reverted'})` + apply `inversePayload` + audit | **Mutates emails/categories** per the inverse payload | H |
| 62 | `/api/assistant/digest` | POST | Generate a weekly digest (LLM with deterministic fallback) | session | 12 parallel DB counts + `chat()` | LLM call; no DB write | M |

### 2.13 Dashboard

| # | Path | Method(s) | Purpose | Auth | DB dependencies | Side effects | Risk |
|---|---|---|---|---|---|---|---|
| 63 | `/api/dashboard` | GET | Aggregated dashboard (counts, category breakdown, 14-day trend, top senders, deadlines, notifications) | session | 7 parallel `count` + `category.findMany` + `sender.findMany` + `email.findMany` (trend) | none | L |
| 64 | `/api/action-items` | GET | List action items | session | `actionItem.findMany({accountId})` | none | L |
| 65 | `/api/action-items/[id]` | PATCH | Update status (open/done) | session | `actionItem.update` + audit | audit | M |
| 66 | `/api/action-items/[id]` | DELETE | Delete an action item | session | `actionItem.delete` + audit | audit | M |
| 67 | `/api/deadlines` | GET | List deadlines (`dueAt` asc) | session | `deadline.findMany({accountId})` | none | L |
| 68 | `/api/deadlines/[id]` | PATCH | Update status (open/done/missed) | session | `deadline.update` + audit | audit | M |
| 69 | `/api/deadlines/[id]` | DELETE | Delete a deadline | session | `deadline.delete` + audit | audit | M |
| 70 | `/api/audit-events` | GET | Query audit log (filters: eventType, targetType, dateRange) | session | `auditEvent.findMany({accountId})` | none | L |

> **Note on numbering.** Although the spec mentioned "50 endpoints," the
> codebase has 54 unique route files (some exposing multiple HTTP methods).
> The matrix below tags each by domain; the inventory above enumerates each
> route file once. Endpoints are numbered 1–70 by route file × method to
> keep the inventory readable; the matrix collapses them by domain.

---

## 3. Migration matrix (16 domains)

| # | Domain | Next.js route(s) (count) | FastAPI route prefix | Status | Tests | Traffic | Verified |
|---|---|---|---|---|---|---|---|
| 1 | **Auth** | `GET /api` (1) | `GET /api/v1/health` + `POST /api/v1/auth/{login,logout,refresh}` | 🔲 Planned | 🔲 None | 🔲 None | 🔲 No |
| 2 | **Accounts** | `/api/accounts`, `/api/accounts/{accountId}` (2) | `/api/v1/accounts` | 🔲 Planned | 🔲 None | 🔲 None | 🔲 No |
| 3 | **Emails** | `/api/emails/**` (14) | `/api/v1/emails` | 🔲 Planned | 🔲 None | 🔲 None | 🔲 No |
| 4 | **Threads** | `/api/threads/{threadId}` (1) | `/api/v1/threads` | 🔲 Planned | 🔲 None | 🔲 None | 🔲 No |
| 5 | **Conversations** | `/api/conversations`, `/api/conversations/{id}` (2) | `/api/v1/conversations` | 🔲 Planned | 🔲 None | 🔲 None | 🔲 No |
| 6 | **Categories** | `/api/categories/**` (2) | `/api/v1/categories` | 🔲 Planned | 🔲 None | 🔲 None | 🔲 No |
| 7 | **Senders** | `/api/senders/**` (2) | `/api/v1/senders` | 🔲 Planned | 🔲 None | 🔲 None | 🔲 No |
| 8 | **Rules** | `/api/rules/**` (2) | `/api/v1/rules` | 🔲 Planned | 🔲 None | 🔲 None | 🔲 No |
| 9 | **Search** | `/api/search`, `/api/search/natural-language`, `/api/saved-searches/**` (4) | `/api/v1/search` + `/api/v1/saved-searches` | 🔲 Planned | 🔲 None | 🔲 None | 🔲 No |
| 10 | **Notifications** | `/api/notifications/**`, `/api/notification-preferences` (6) | `/api/v1/notifications` + `/api/v1/notification-preferences` | 🔲 Planned | 🔲 None | 🔲 None | 🔲 No |
| 11 | **Compose** | `/api/compose/**`, `/api/templates/**`, `/api/recipients/search` (5) | `/api/v1/compose` + `/api/v1/templates` + `/api/v1/recipients` | 🔲 Planned | 🔲 None | 🔲 None | 🔲 No |
| 12 | **Attachments** | inline (0) | `/api/v1/emails/{id}/attachments` + `/api/v1/attachments/{id}` | 🔲 Planned | 🔲 None | 🔲 None | 🔲 No |
| 13 | **Assistant** | `/api/assistant/**` (7) | `/api/v1/assistant/conversations` + `/api/v1/assistant/digest` | 🔲 Planned | 🔲 None | 🔲 None | 🔲 No |
| 14 | **AI Tools** | cross-cutting: smart-replies + NL search + digest + assistant orchestrator (0 dedicated) | `/api/v1/ai/*` (smart-replies, natural-language, digest, tools registry) | 🔲 Planned | 🔲 None | 🔲 None | 🔲 No |
| 15 | **Dashboard** | `/api/dashboard`, `/api/action-items/**`, `/api/deadlines/**`, `/api/audit-events` (8) | `/api/v1/dashboard` + `/api/v1/action-items` + `/api/v1/deadlines` + `/api/v1/audit-events` | 🔲 Planned | 🔲 None | 🔲 None | 🔲 No |
| 16 | **Sync** | none (currently inline `ensureSeedData()` seed pipeline) | `/api/v1/sync/{trigger,status,cancel}` + background worker | 🔲 Planned | 🔲 None | 🔲 None | 🔲 No |
| | **Total** | **54 routes** | **16 routers** | 0 / 16 | 0 / 16 | 0 / 16 | 0 / 16 |

### Column definitions

- **Status** — `Planned` / `In progress` / `Shadow` (running but not receiving traffic) / `Live` / `Decommissioned`.
- **Tests** — `None` / `Unit` / `Integration` / `E2E` / `Contract`. Green when at least `Integration` passes on every PR.
- **Traffic** — `None` / `Shadow` (mirrored, responses ignored) / `1%` / `10%` / `50%` / `100%`.
- **Verified** — `No` until all four gates pass: (a) tests green, (b) shadow diff < 1% for 24 h, (c) perf baseline within 1.2× of Next.js, (d) rollback drilled.

---

## 4. Migration order — iterations 0–20

The plan is **strangler-fig**: stand up FastAPI alongside Next.js, route
traffic domain-by-domain through a Caddy gateway (already in place for the
Next.js app), and decommission Next.js routes only after the FastAPI
equivalent passes all four gates (§3 column definitions).

> Each iteration ends with a *Verified* check. Do not start iteration *N+1*
> until iteration *N* is Verified. The only exception is iteration 0
> (infrastructure), which is Verified by a successful smoke test.

| It. | Theme | Domains touched | Exit criteria |
|---|---|---|---|
| **0** | Infra bootstrap | (none) | Supabase project provisioned, `001_initial_schema.sql` + `002_seed_data.sql` applied, FastAPI skeleton returns `GET /api/v1/health`, RLS policies from `SUPABASE_SETUP.md` §6 applied, Caddy routes `/api/v1/*` to FastAPI (port 8000) and `/api/*` to Next.js (port 3000). |
| **1** | Auth + session | Auth | `POST /api/v1/auth/login` issues a Supabase JWT; `current_account_id()` SQL function resolves account from JWT; FastAPI dependency `get_session()` returns the same shape as the Next.js `Session`. Next.js still serves all other routes. |
| **2** | Read-only basics | Accounts (GET only), Categories (GET only), Senders (GET only), Threads (GET only) | All GET endpoints shadow-mirror Next.js; response bytes equal. |
| **3** | Emails list + detail | Emails (GET endpoints: list, drafts, sent, single-email detail) | Cursor pagination contract matches; `nextCursor` field stable. |
| **4** | Email mutations | Emails (read, star, important, snooze, restore, bulk) | All audit events written; 1% canary on bulk actions. |
| **5** | Email hard ops | Emails (permanent-delete) + Attachments (standalone routes) | `confirm=true` gating enforced; cascade behaviour tested on a copy of the prod database. |
| **6** | Categories write + Rules | Categories (POST/PATCH/DELETE) + Rules (CRUD) | Rule engine (`src/lib/rules/engine.ts`) ported to Python; new rule versions created on update. |
| **7** | Conversations | Conversations (GET list, GET detail, PATCH) | `resolveConversation` + `detectFollowUpState` + `mapConversationDetail` ported verbatim; "What changed?" diff matches Next.js byte-for-byte on the seed corpus. |
| **8** | Search | Search (POST structured, POST NL, saved-searches CRUD, recipients/search) | NL search LLM prompt identical; same fallback behaviour when LLM fails. |
| **9** | Notifications | Notifications (list, mark-read, read-all, delete, test, preferences) | WebSocket mini-service (port 3003) wired for real-time delivery via Caddy `/?XTransformPort=3003`. |
| **10** | Compose | Compose (drafts, send, templates CRUD) | `confirm=true` gating on send; idempotency by `messageId` preserved. |
| **11** | Dashboard + ops | Dashboard (GET), Action items, Deadlines, Audit events | 14-day trend, top senders, category breakdown match Next.js exactly on the seed corpus. |
| **12** | AI Tools (smart replies, NL search verification, digest) | AI Tools | Smart-replies LLM prompt identical; digest deterministic-fallback path identical to `buildFallbackDigest()`. |
| **13** | Assistant — read + create | Assistant (list conversations, create, get, patch, delete, list messages, list actions, export) | All read + metadata-write paths migrated. |
| **14** | Assistant — message send | Assistant (POST message → orchestrator) | Tool registry (`src/lib/ai/tools.ts`) ported; every tool's `execute` + `reverse` pair tested. |
| **15** | Assistant — action revert | Assistant (POST actions/{id}/revert) | `inversePayload` application tested for every reversible tool; `confirm=true` gating enforced. |
| **16** | Sync worker | Sync | APScheduler worker (port 3010) hits Gmail API (mock in dev), writes through the same `resolveConversation` pipeline; `/api/v1/sync/{trigger,status,cancel}` HTTP surface. |
| **17** | Shadow 100% | (all) | Caddy mirrors every request to both backends for 24 h; diff rate < 1% per route. |
| **18** | Cutover | (all) | Caddy routes 100% of `/api/*` to FastAPI; Next.js kept warm on port 3001 for 24 h rollback window. |
| **19** | Soak | (all) | 7-day soak at production traffic; perf baseline (§6) within 1.2× of Next.js for every P95. |
| **20** | Decommission | (all) | Next.js process stopped; `src/app/api/**` archived to `legacy/`; schema-only Prisma client removed; final retro. |

---

## 5. Risks & rollback strategy

### 5.1 Top risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **Conversation resolver drift.** The Python port of `resolveConversation()` produces a different conversation grouping than the TypeScript original, splitting or merging conversations incorrectly. | M | H | Port the resolver verbatim (same precedence ladder, same thresholds 0.5/0.6). Add a golden-file test: run both resolvers on the seed corpus + a 1k-email sample; diff must be 0. |
| R2 | **Audit-event schema drift.** FastAPI writes `metadata` JSONB with a slightly different shape than Next.js, breaking the audit-log UI. | M | M | Define a Pydantic `AuditEventMetadata` model that mirrors the TS type exactly; contract test against 20 known event types. |
| R3 | **RLS misconfiguration leaks cross-account data.** A policy with a wrong `EXISTS` clause returns rows from another account. | L | H | Apply the policies from `SUPABASE_SETUP.md` §6 verbatim. Add an automated test: create two accounts, query as each, assert zero overlap. |
| R4 | **Gmail send actually fires in dev.** `POST /api/v1/compose/send` hits the real Gmail API during FastAPI testing and sends real email. | L | H | In dev/staging, the FastAPI send handler writes only an `EMAIL_SENT` audit row (matching the Next.js demo behaviour). Gate the real Gmail call behind a `GMAIL_ENABLED=true` env var. |
| R5 | **LLM prompt drift changes smart-reply / digest / NL-search output.** Even with the same prompt string, model-version differences produce different JSON. | M | M | Pin the model version. Always run the deterministic fallback path on a 1% canary; if LLM JSON fails to parse 3× in a row, fall back automatically. |
| R6 | **Bulk action loses ownership check.** The Python port forgets the `WHERE id IN ids AND accountId = session.accountId` clause and touches another account's emails. | L | H | Code review checklist item. Add a unit test that asserts a cross-account bulk request affects 0 rows. |
| R7 | **Migration runs while Next.js is still serving traffic**, causing Prisma + SQLAlchemy to fight over the same SQLite file. | M | M | The migration moves to PostgreSQL from iteration 0. Next.js keeps using SQLite; FastAPI uses PostgreSQL. The shadow phase (iteration 17) diffs responses from the two backends, which will have divergent data — that's expected and the diff budget is 1% per route. |
| R8 | **WebSocket mini-service drops messages** during notifications real-time delivery. | M | M | Use Socket.io with the sticky-session Caddy config. Add a client-side reconnect + missed-event backfill (query `GET /api/v1/notifications?since=<last-seen-id>` on reconnect). |
| R9 | **Assistant action revert applies the wrong inverse.** The `inversePayload` JSON shape changes between TS and Python and the revert mutates the wrong field. | L | H | For every reversible tool, write a round-trip test: apply → revert → assert the email is byte-identical to before. |
| R10 | **Decommission premature.** Iteration 20 shuts down Next.js before a regression is discovered. | L | H | Keep the Next.js process warm for 7 days after iteration 18 (the "soak" iteration 19 covers this). Rollback is one Caddy config change. |

### 5.2 Rollback strategy

The Caddy gateway is the rollback pivot. Every FastAPI route is reachable at
`/api/v1/*`; the Next.js routes remain at `/api/*`. To roll back any single
domain, edit `Caddyfile` to drop the `/api/v1/<domain>/*` block and the
frontend falls back to `/api/<domain>/*`. To roll back everything, edit one
line and reload Caddy.

```caddyfile
# Snippet — current cutover state (iteration 18)
:80 {
    # FastAPI — fully cut over
    handle /api/v1/* {
        reverse_proxy localhost:8000
    }
    # Next.js — kept warm for rollback (iteration 19)
    handle /api/* {
        reverse_proxy localhost:3001
    }
    # SPA
    handle {
        reverse_proxy localhost:3000
    }
}
```

**Rollback drill (mandatory before iteration 18):**

1. At a scheduled time, flip Caddy back to Next.js-only.
2. Verify the SPA loads, an email opens, a notification fires.
3. Flip back to FastAPI.
4. Record the time-to-rollback in the iteration's worklog entry.

Target: **< 60 seconds** from `caddy reload` to first successful request.

### 5.3 Data rollback

Schema changes are forward-only (Alembic). To roll back a schema migration:

1. Identify the migration in `backend/migrations/versions/`.
2. Run `alembic downgrade -1` against a snapshot database.
3. If the downgrade is destructive (column drop), restore from the
   pre-migration `pg_dump` snapshot instead.

Every iteration that touches the schema MUST take a `pg_dump` snapshot before
applying the migration and store it for at least 30 days.

---

## 6. Performance baseline template

Every iteration that migrates a route MUST populate this template before
marking the route *Verified*. Measure on the seed corpus (10 categories,
~50 emails, 1 conversation, 1 account) running locally, single user, no
concurrency.

```markdown
### Performance baseline — <domain> — <route>

| Metric                          | Next.js baseline | FastAPI | Ratio | Within budget (≤1.2×)? |
|---------------------------------|------------------|---------|-------|------------------------|
| P50 latency (ms)                |                  |         |       |                        |
| P95 latency (ms)                |                  |         |       |                        |
| P99 latency (ms)                |                  |         |       |                        |
| Throughput (req/s, single core) |                  |         |       |                        |
| DB round-trips per request      |                  |         |       |                        |
| Allocated memory per request    |                  |         |       |                        |
| Cold-start time (ms)            |                  |         |       |                        |

**Test setup**
- Hardware: <CPU/RAM>
- Database: Supabase <tier>, <region>
- Seed: 002_seed_data.sql + <extra fixture>
- Client: `wrk -t4 -c16 -d30s --latency <url>`
- Date: <YYYY-MM-DD>

**Observations**
- <free-form notes — any anomalies, regressions, optimisations applied>

**Verdict**
- [ ] All metrics within 1.2× of Next.js baseline.
- [ ] No new P99 spikes > 2× baseline.
- [ ] DB round-trips not increased.
```

### 6.1 SLO budget per route class

| Route class | P95 budget | Examples |
|---|---|---|
| Read, single-row by PK | 80 ms | `GET /api/emails/{id}`, `GET /api/threads/{id}` |
| Read, paginated list | 150 ms | `GET /api/emails`, `GET /api/conversations` |
| Read, aggregate (dashboard) | 250 ms | `GET /api/dashboard` |
| Write, single-row mutation | 120 ms | `POST /api/emails/{id}/read`, `PATCH /api/conversations/{id}` |
| Write, bulk mutation | 400 ms | `POST /api/emails/bulk` |
| LLM-backed | 3 000 ms | `POST /api/emails/{id}/smart-replies`, `POST /api/assistant/digest` |
| Assistant orchestrator | 8 000 ms | `POST /api/assistant/conversations/{id}/messages` |

### 6.2 Dashboard query — known hot path

`GET /api/dashboard` issues **7 parallel counts** + 1 `category.findMany`
(with memberships) + 1 `sender.findMany` + 1 `email.findMany` (14-day trend)
on every request. The Next.js implementation does this in `Promise.all`.
The FastAPI port must use `asyncio.gather` with the same fan-out and must
not exceed 1.2× the Next.js P95.

Recommended optimisations (apply only if the baseline is breached):

1. Cache the 14-day trend per account for 60 s (in-memory LRU).
2. Replace `category.findMany` + per-category `_count.memberships` with a single `GROUP BY` query.
3. Materialise the dashboard as a `dashboard_cache` table updated by a trigger.

---

## 7. Known defects to fix during migration

These are pre-existing defects in the Next.js codebase. The FastAPI port
must NOT replicate them; document the fix in the iteration's worklog.

| ID | Defect | Fix |
|---|---|---|
| D1 | The directory `src/app/api/emails/[messageId]` was created with the typo'd name `emails/essageId]` (missing `[m`). The frontend hooks were written to match, so the demo works, but the URL is wrong. | FastAPI exposes the canonical path `/api/v1/emails/{messageId}/...`. Frontend hooks updated to call the new path. |
| D2 | `getSession()` caches the session in a module-level variable, so all requests share one demo user. | FastAPI resolves the session per-request from the JWT. No caching. |
| D3 | `ensureSeedData()` runs on every cold start of the Next.js process and can race with concurrent requests. | Seed runs once via a CLI command (`python -m backend.cli seed`) and is idempotent. The FastAPI app never auto-seeds. |
| D4 | "Delete" aliases to "archive" (`patchFor('delete') = {isArchived: true}`), which is confusing. | FastAPI separates `POST /api/v1/emails/bulk {action: 'archive'}` from `DELETE /api/v1/emails/{id}` (soft-delete via `isArchived`) and `DELETE /api/v1/emails/{id}?permanent=true` (hard-delete). The bulk action set is `archive / read / unread / star / unstar / important / unimportant` — `delete` removed. |
| D5 | `audit_event.metadata` is a JSON-serialised string in SQLite; querying it requires `JSON_EXTRACT`. | PostgreSQL `JSONB` + GIN index. The FastAPI audit-write helper accepts a Pydantic model and stores it as native JSONB. |
| D6 | No structured logging. Every route uses `console.error` ad-hoc. | FastAPI uses `structlog` with JSON output; every request gets a `request_id` propagated to logs + audit events. |
| D7 | No rate limiting on LLM-backed routes (`smart-replies`, `natural-language`, `digest`, assistant message POST). | FastAPI adds a per-account rate limiter (10 req/min) on every LLM-backed route. |
| D8 | No OpenAPI schema. The Next.js routes are undocumented. | FastAPI auto-generates `/docs` + `/openapi.json`; the frontend `api-client.ts` is regenerated from the OpenAPI schema. |

---

*End of BACKEND_MIGRATION.md. Update this document at the end of every
iteration; the *Status*, *Tests*, *Traffic*, and *Verified* columns in §3
are the single source of truth for migration progress.*
