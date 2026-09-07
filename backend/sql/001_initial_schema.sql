-- =============================================================================
-- 001_initial_schema.sql
-- Institutional Email Intelligence — PostgreSQL (Supabase-ready) initial schema.
--
-- Mirrors prisma/schema.prisma exactly (27 models).
--   • UUID primary keys via gen_random_uuid() (requires pgcrypto).
--   • TIMESTAMPTZ for all timestamps.
--   • JSONB for every field stored as a JSON-serialized String in Prisma
--     (toRecipients / labels / expression / actions / metadata / payload /
--      participantSummary / contentJson / attachments / sources / inputSummary /
--      resultSummary / inversePayload / filters).
--   • CHECK constraints emulate the Prisma enum-string fields.
--   • Indexes mirror the Prisma @@index directives.
--   • UNIQUE constraints mirror @@unique directives.
--   • Foreign keys use ON DELETE CASCADE / SET NULL per the Prisma relations.
-- =============================================================================

-- pgcrypto provides gen_random_uuid() (Supabase preinstalls it; this is a no-op).
-- On PostgreSQL 13+ gen_random_uuid() is also built-in, but declaring the
-- extension keeps the script portable to older versions.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Shared enum value documentation (enforced inline via CHECK constraints):
--   account.status               active | syncing | error | disconnected
--   sync_state.sync_status       idle | syncing | error | success
--   sender.rule_status           none | has_rule | ignored
--   email.classification_source  manual_rule | user_override | sender_rule | ai | system_default
--   category_membership.source   manual_rule | user_override | sender_rule | ai | system_default
--   rule.created_by              user | ai | system
--   deadline.status              open | done | missed
--   action_item.status           open | done
--   notification.importance      normal | important | urgent
--   notification_pref.channel    in_app | web | push
--   assistant_conversation.mode  direct | thinking | suggest
--   assistant_message.role       user | assistant | system | tool
--   assistant_action.status      pending | executed | failed | reverted
--   audit_event.source_surface   ui | ai | api | system
--   email_template.category      general | followup | request | announcement | custom
--   conversation.status          active | awaiting_user | awaiting_other | follow_up_due | updated | resolved | archived
--   conversation.follow_up_state none | recommended | due | awaiting_response | resolved
--   conversation.importance      normal | important
--   email_relationship.type      reply_to | follow_up_to | reminder_of | clarification_of | update_to | forward_of | related_to | supersedes | references
--   conversation_override.type   split | merge | exclude | include
-- -----------------------------------------------------------------------------

-- =============================================================================
-- 1. Users & Accounts
-- =============================================================================

CREATE TABLE "user" (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT NOT NULL UNIQUE,
    name        TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "account_connection" (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId"            UUID NOT NULL UNIQUE,
    provider            TEXT NOT NULL DEFAULT 'google',
    "providerAccountId" TEXT NOT NULL,
    "emailAddress"      TEXT NOT NULL,
    "displayName"       TEXT,
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','syncing','error','disconnected')),
    "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "account_connection_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE,
    CONSTRAINT "account_connection_provider_providerAccountId_key"
        UNIQUE (provider, "providerAccountId")
);

CREATE TABLE "sync_state" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "accountId"     UUID NOT NULL UNIQUE,
    "gmailHistoryId" TEXT,
    "lastSyncedAt"  TIMESTAMPTZ,
    "syncStatus"    TEXT NOT NULL DEFAULT 'idle'
                    CHECK ("syncStatus" IN ('idle','syncing','error','success')),
    "errorCode"     TEXT,
    "errorMessage"  TEXT,
    "retryCount"    INTEGER NOT NULL DEFAULT 0,
    "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "sync_state_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "account_connection"(id) ON DELETE CASCADE
);

-- =============================================================================
-- 2. Categories, Senders, Conversations, Threads
-- =============================================================================

CREATE TABLE "category" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "accountId"     UUID NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    "systemDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder"     INTEGER NOT NULL DEFAULT 0,
    color           TEXT NOT NULL DEFAULT 'slate',
    icon            TEXT NOT NULL DEFAULT 'folder',
    "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "category_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "account_connection"(id) ON DELETE CASCADE,
    CONSTRAINT "category_accountId_name_key" UNIQUE ("accountId", name)
);

CREATE TABLE "sender" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "accountId"     UUID NOT NULL,
    "senderEmail"   TEXT NOT NULL,
    "senderName"    TEXT,
    domain          TEXT,
    "firstSeenAt"   TIMESTAMPTZ,
    "lastSeenAt"    TIMESTAMPTZ,
    "messageCount"  INTEGER NOT NULL DEFAULT 0,
    discovered      BOOLEAN NOT NULL DEFAULT true,
    "ruleStatus"    TEXT NOT NULL DEFAULT 'none'
                    CHECK ("ruleStatus" IN ('none','has_rule','ignored')),
    "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "sender_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "account_connection"(id) ON DELETE CASCADE,
    CONSTRAINT "sender_accountId_senderEmail_key" UNIQUE ("accountId", "senderEmail")
);
CREATE INDEX "sender_accountId_lastSeenAt_idx" ON "sender" ("accountId", "lastSeenAt");

CREATE TABLE "conversation" (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "accountId"          UUID NOT NULL,
    "canonicalSubject"   TEXT NOT NULL,
    status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','awaiting_user','awaiting_other','follow_up_due','updated','resolved','archived')),
    "followUpState"      TEXT NOT NULL DEFAULT 'none'
                         CHECK ("followUpState" IN ('none','recommended','due','awaiting_response','resolved')),
    importance           TEXT NOT NULL DEFAULT 'normal'
                         CHECK (importance IN ('normal','important')),
    "messageCount"       INTEGER NOT NULL DEFAULT 0,
    "participantSummary" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "latestMessageAt"    TIMESTAMPTZ,
    "firstMessageAt"     TIMESTAMPTZ,
    "aiSummary"          TEXT,
    "aiSummaryAt"        TIMESTAMPTZ,
    "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "conversation_accountId_latestMessageAt_idx"
    ON "conversation" ("accountId", "latestMessageAt");
CREATE INDEX "conversation_accountId_status_idx"
    ON "conversation" ("accountId", status);

CREATE TABLE "thread" (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "accountId"       UUID NOT NULL,
    "providerThreadId" TEXT NOT NULL,
    subject           TEXT,
    "lastMessageAt"   TIMESTAMPTZ,
    "conversationId"  UUID,
    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "thread_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "account_connection"(id) ON DELETE CASCADE,
    CONSTRAINT "thread_conversationId_fkey"
        FOREIGN KEY ("conversationId") REFERENCES "conversation"(id) ON DELETE SET NULL,
    CONSTRAINT "thread_accountId_providerThreadId_key"
        UNIQUE ("accountId", "providerThreadId")
);
CREATE INDEX "thread_accountId_lastMessageAt_idx" ON "thread" ("accountId", "lastMessageAt");
CREATE INDEX "thread_conversationId_idx" ON "thread" ("conversationId");

-- =============================================================================
-- 3. Emails, Attachments, Memberships, Classifications
-- =============================================================================

CREATE TABLE "email" (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "accountId"              UUID NOT NULL,
    "threadId"               UUID,
    "providerMessageId"      TEXT NOT NULL,
    "providerThreadId"       TEXT,
    "senderId"               UUID,
    "fromName"               TEXT,
    "fromEmail"              TEXT NOT NULL,
    "toRecipients"           JSONB NOT NULL DEFAULT '[]'::jsonb,
    "ccRecipients"           JSONB NOT NULL DEFAULT '[]'::jsonb,
    "bccRecipients"          JSONB NOT NULL DEFAULT '[]'::jsonb,
    subject                  TEXT,
    snippet                  TEXT,
    "bodyText"               TEXT,
    "bodyHtmlSanitized"      TEXT,
    "receivedAt"             TIMESTAMPTZ,
    "isRead"                 BOOLEAN NOT NULL DEFAULT false,
    "isStarred"              BOOLEAN NOT NULL DEFAULT false,
    "isImportant"            BOOLEAN NOT NULL DEFAULT false,
    "isSpam"                 BOOLEAN NOT NULL DEFAULT false,
    "isDraft"                BOOLEAN NOT NULL DEFAULT false,
    "isSent"                 BOOLEAN NOT NULL DEFAULT false,
    "isArchived"             BOOLEAN NOT NULL DEFAULT false,
    "hasAttachment"          BOOLEAN NOT NULL DEFAULT false,
    "snoozedUntil"           TIMESTAMPTZ,
    labels                   JSONB NOT NULL DEFAULT '[]'::jsonb,
    "extractedLinks"         JSONB NOT NULL DEFAULT '[]'::jsonb,
    "classificationSource"   TEXT
                             CHECK ("classificationSource" IS NULL OR "classificationSource" IN
                                    ('manual_rule','user_override','sender_rule','ai','system_default')),
    "classificationConfidence" DOUBLE PRECISION,
    "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "email_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "account_connection"(id) ON DELETE CASCADE,
    CONSTRAINT "email_threadId_fkey"
        FOREIGN KEY ("threadId") REFERENCES "thread"(id) ON DELETE SET NULL,
    CONSTRAINT "email_senderId_fkey"
        FOREIGN KEY ("senderId") REFERENCES "sender"(id) ON DELETE SET NULL,
    CONSTRAINT "email_accountId_providerMessageId_key"
        UNIQUE ("accountId", "providerMessageId")
);
CREATE INDEX "email_accountId_receivedAt_idx"   ON "email" ("accountId", "receivedAt");
CREATE INDEX "email_accountId_isRead_idx"       ON "email" ("accountId", "isRead");
CREATE INDEX "email_accountId_senderId_idx"     ON "email" ("accountId", "senderId");
CREATE INDEX "email_accountId_snoozedUntil_idx" ON "email" ("accountId", "snoozedUntil");

CREATE TABLE "email_attachment" (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "emailId"                UUID NOT NULL,
    "providerAttachmentId"   TEXT NOT NULL,
    filename                 TEXT NOT NULL,
    "mimeType"               TEXT NOT NULL,
    size                     INTEGER NOT NULL,
    previewable              BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "email_attachment_emailId_fkey"
        FOREIGN KEY ("emailId") REFERENCES "email"(id) ON DELETE CASCADE
);
CREATE INDEX "email_attachment_emailId_idx" ON "email_attachment" ("emailId");

CREATE TABLE "category_membership" (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "emailId"   UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    source      TEXT NOT NULL
                CHECK (source IN ('manual_rule','user_override','sender_rule','ai','system_default')),
    confidence  DOUBLE PRECISION,
    "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "category_membership_emailId_fkey"
        FOREIGN KEY ("emailId") REFERENCES "email"(id) ON DELETE CASCADE,
    CONSTRAINT "category_membership_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "category"(id) ON DELETE CASCADE
);
CREATE INDEX "category_membership_categoryId_idx" ON "category_membership" ("categoryId");
CREATE INDEX "category_membership_emailId_idx"    ON "category_membership" ("emailId");

CREATE TABLE "classification_result" (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "emailId"         UUID NOT NULL,
    source            TEXT NOT NULL,
    "categoryId"      UUID,
    confidence        DOUBLE PRECISION,
    "rationaleSummary" TEXT,
    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "classification_result_emailId_fkey"
        FOREIGN KEY ("emailId") REFERENCES "email"(id) ON DELETE CASCADE
);
CREATE INDEX "classification_result_emailId_idx" ON "classification_result" ("emailId");

-- =============================================================================
-- 4. Rules & Overrides
-- =============================================================================

CREATE TABLE "rule" (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "accountId" UUID NOT NULL,
    name        TEXT NOT NULL,
    expression  JSONB NOT NULL,        -- JSON: condition tree
    actions     JSONB NOT NULL,        -- JSON: action list
    priority    INTEGER NOT NULL DEFAULT 100,
    enabled     BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL DEFAULT 'user'
                CHECK ("createdBy" IN ('user','ai','system')),
    "hitCount"  INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "rule_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "account_connection"(id) ON DELETE CASCADE
);
CREATE INDEX "rule_accountId_priority_idx" ON "rule" ("accountId", priority);

CREATE TABLE "rule_version" (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ruleId"    UUID NOT NULL,
    version     INTEGER NOT NULL,
    expression  JSONB NOT NULL,
    actions     JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "rule_version_ruleId_fkey"
        FOREIGN KEY ("ruleId") REFERENCES "rule"(id) ON DELETE CASCADE,
    CONSTRAINT "rule_version_ruleId_version_key" UNIQUE ("ruleId", version)
);

CREATE TABLE "user_override" (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "accountId"   UUID NOT NULL,
    "emailId"     UUID,
    "senderId"    UUID,
    "categoryId"  UUID,
    "overrideType" TEXT NOT NULL,
    payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "user_override_accountId_idx" ON "user_override" ("accountId");

-- =============================================================================
-- 5. Deadlines, Action Items, Notifications
-- =============================================================================

CREATE TABLE "deadline" (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "accountId" UUID NOT NULL,
    "emailId"   UUID,
    "categoryId" UUID,
    title       TEXT NOT NULL,
    "dueAt"     TIMESTAMPTZ,
    confidence  DOUBLE PRECISION,
    status      TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','done','missed')),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "deadline_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "account_connection"(id) ON DELETE CASCADE,
    CONSTRAINT "deadline_emailId_fkey"
        FOREIGN KEY ("emailId") REFERENCES "email"(id) ON DELETE SET NULL,
    CONSTRAINT "deadline_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "category"(id) ON DELETE SET NULL
);
CREATE INDEX "deadline_accountId_dueAt_idx" ON "deadline" ("accountId", "dueAt");

CREATE TABLE "action_item" (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "accountId" UUID NOT NULL,
    "emailId"   UUID,
    title       TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','done')),
    "dueAt"     TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "action_item_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "account_connection"(id) ON DELETE CASCADE,
    CONSTRAINT "action_item_emailId_fkey"
        FOREIGN KEY ("emailId") REFERENCES "email"(id) ON DELETE SET NULL
);
CREATE INDEX "action_item_accountId_status_idx" ON "action_item" ("accountId", status);

CREATE TABLE "notification" (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "accountId" UUID NOT NULL,
    "emailId"   UUID,
    "categoryId" UUID,
    title       TEXT NOT NULL,
    body        TEXT,
    importance  TEXT NOT NULL DEFAULT 'normal'
                CHECK (importance IN ('normal','important','urgent')),
    "isRead"    BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "notification_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "account_connection"(id) ON DELETE CASCADE,
    CONSTRAINT "notification_emailId_fkey"
        FOREIGN KEY ("emailId") REFERENCES "email"(id) ON DELETE SET NULL,
    CONSTRAINT "notification_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "category"(id) ON DELETE SET NULL
);
CREATE INDEX "notification_accountId_createdAt_idx" ON "notification" ("accountId", "createdAt");
CREATE INDEX "notification_accountId_isRead_idx"    ON "notification" ("accountId", "isRead");

CREATE TABLE "notification_preference" (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "accountId" UUID NOT NULL,
    channel     TEXT NOT NULL
                CHECK (channel IN ('in_app','web','push')),
    "categoryId" UUID,
    enabled     BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "notification_preference_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "account_connection"(id) ON DELETE CASCADE,
    CONSTRAINT "notification_preference_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "category"(id) ON DELETE CASCADE,
    CONSTRAINT "notification_preference_accountId_channel_categoryId_key"
        UNIQUE ("accountId", channel, "categoryId")
);

-- =============================================================================
-- 6. AI Assistant
-- =============================================================================

CREATE TABLE "assistant_conversation" (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId"    UUID NOT NULL,
    "accountId" UUID,
    title       TEXT,
    mode        TEXT NOT NULL DEFAULT 'direct'
                CHECK (mode IN ('direct','thinking','suggest')),
    archived    BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "expiresAt" TIMESTAMPTZ,
    CONSTRAINT "assistant_conversation_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE,
    CONSTRAINT "assistant_conversation_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "account_connection"(id) ON DELETE SET NULL
);
CREATE INDEX "assistant_conversation_userId_createdAt_idx" ON "assistant_conversation" ("userId", "createdAt");
CREATE INDEX "assistant_conversation_userId_archived_idx"  ON "assistant_conversation" ("userId", archived);

CREATE TABLE "assistant_message" (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "conversationId" UUID NOT NULL,
    role             TEXT NOT NULL
                     CHECK (role IN ('user','assistant','system','tool')),
    "contentJson"    JSONB NOT NULL,
    attachments      JSONB NOT NULL DEFAULT '[]'::jsonb,
    sources          JSONB NOT NULL DEFAULT '[]'::jsonb,
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "assistant_message_conversationId_fkey"
        FOREIGN KEY ("conversationId") REFERENCES "assistant_conversation"(id) ON DELETE CASCADE
);
CREATE INDEX "assistant_message_conversationId_createdAt_idx"
    ON "assistant_message" ("conversationId", "createdAt");

CREATE TABLE "assistant_action" (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "conversationId" UUID NOT NULL,
    "userId"         UUID NOT NULL,
    "accountId"      UUID,
    "toolName"       TEXT NOT NULL,
    "inputSummary"   JSONB NOT NULL,
    "resultSummary"  JSONB,
    reversible       BOOLEAN NOT NULL DEFAULT false,
    "inversePayload" JSONB,
    status           TEXT NOT NULL
                     CHECK (status IN ('pending','executed','failed','reverted')),
    "errorMessage"   TEXT,
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
    "revertedAt"     TIMESTAMPTZ,
    CONSTRAINT "assistant_action_conversationId_fkey"
        FOREIGN KEY ("conversationId") REFERENCES "assistant_conversation"(id) ON DELETE CASCADE,
    CONSTRAINT "assistant_action_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "account_connection"(id) ON DELETE SET NULL
);
CREATE INDEX "assistant_action_conversationId_createdAt_idx"
    ON "assistant_action" ("conversationId", "createdAt");

-- =============================================================================
-- 7. Audit
-- =============================================================================

CREATE TABLE "audit_event" (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId"      UUID,
    "accountId"   UUID,
    "eventType"   TEXT NOT NULL,
    "targetType"  TEXT,
    "targetId"    TEXT,
    "sourceSurface" TEXT
                  CHECK ("sourceSurface" IS NULL OR "sourceSurface" IN ('ui','ai','api','system')),
    "actionId"    TEXT,
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "audit_event_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE SET NULL,
    CONSTRAINT "audit_event_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "account_connection"(id) ON DELETE SET NULL
);
CREATE INDEX "audit_event_accountId_createdAt_idx" ON "audit_event" ("accountId", "createdAt");
CREATE INDEX "audit_event_eventType_idx"           ON "audit_event" ("eventType");

-- =============================================================================
-- 8. Drafts (compose)
-- =============================================================================

CREATE TABLE "draft" (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "accountId"   UUID NOT NULL,
    "toRecipients" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "ccRecipients" JSONB NOT NULL DEFAULT '[]'::jsonb,
    subject       TEXT,
    body          TEXT,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "draft_accountId_updatedAt_idx" ON "draft" ("accountId", "updatedAt");

-- =============================================================================
-- 9. Saved Searches (filter presets)
-- =============================================================================

CREATE TABLE "saved_search" (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "accountId" UUID NOT NULL,
    name        TEXT NOT NULL,
    filters     JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "saved_search_accountId_idx" ON "saved_search" ("accountId");

-- =============================================================================
-- 10. Email Templates (compose presets)
-- =============================================================================

CREATE TABLE "email_template" (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "accountId" UUID NOT NULL,
    name        TEXT NOT NULL,
    subject     TEXT NOT NULL,
    body        TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'general'
                CHECK (category IN ('general','followup','request','announcement','custom')),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "email_template_accountId_idx" ON "email_template" ("accountId");

-- =============================================================================
-- 11. Conversation Intelligence (relationships, overrides)
-- =============================================================================

CREATE TABLE "email_relationship" (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "accountId"       UUID NOT NULL,
    "fromEmailId"     UUID NOT NULL,
    "toEmailId"       UUID NOT NULL,
    "relationshipType" TEXT NOT NULL
                      CHECK ("relationshipType" IN
                             ('reply_to','follow_up_to','reminder_of','clarification_of',
                              'update_to','forward_of','related_to','supersedes','references')),
    confidence        DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    reason            TEXT NOT NULL DEFAULT '',
    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "email_relationship_accountId_fromEmailId_idx" ON "email_relationship" ("accountId", "fromEmailId");
CREATE INDEX "email_relationship_accountId_toEmailId_idx"   ON "email_relationship" ("accountId", "toEmailId");

CREATE TABLE "conversation_override" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "accountId"     UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "emailId"       UUID,
    "threadId"      UUID,
    "overrideType"  TEXT NOT NULL
                    CHECK ("overrideType" IN ('split','merge','exclude','include')),
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "conversation_override_conversationId_fkey"
        FOREIGN KEY ("conversationId") REFERENCES "conversation"(id) ON DELETE CASCADE
);
CREATE INDEX "conversation_override_accountId_conversationId_idx"
    ON "conversation_override" ("accountId", "conversationId");

-- =============================================================================
-- updated_at trigger — keep every row's "updatedAt" fresh on UPDATE.
-- (Mirrors Prisma's @updatedAt behavior.)
-- =============================================================================

CREATE OR REPLACE FUNCTION "set_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
    tables_with_updated_at TEXT[] := ARRAY[
        'user','account_connection','sync_state','category','sender','email',
        'rule','deadline','draft','saved_search','email_template','conversation'
    ];
BEGIN
    FOREACH t IN ARRAY tables_with_updated_at LOOP
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON %I ' ||
            'FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();',
            t || '_set_updated_at', t
        );
    END LOOP;
END $$;

-- =============================================================================
-- Done. 27 tables, 31 indexes (28 mirror Prisma @@index + 3 FK-convenience
-- on email_attachment.emailId / category_membership.emailId /
-- classification_result.emailId), 7 table-level UNIQUE constraints (mirror
-- Prisma @@unique) + 1 column-level UNIQUE (user.email), 20 inline CHECK
-- constraints emulating the Prisma enum-string fields, 1 trigger function.
-- Run 002_seed_data.sql next to verify the schema with demo data.
-- =============================================================================
