-- =============================================================================
-- 002_seed_data.sql
-- Institutional Email Intelligence — minimal seed data to verify the schema.
--
-- Mirrors src/lib/sync/seed-data.ts + src/lib/sync/seed.ts at a reduced scale:
--   • 1 demo user  (Aarav Sharma / btech2023.cs@iitjammu.ac.in)
--   • 1 connected Google account + SyncState row
--   • 10 default categories (Placement, Academic, Professors, Research,
--     Student Welfare, Medical, Hostel, Events, Finance, Others)
--   • 3 representative senders
--   • 1 conversation + 1 thread + 2 sample emails (Internship Opportunity +
--     Pre-Placement Talk follow-up)
--   • 1 open deadline + 1 unread notification derived from the seed email
--
-- All inserts are idempotent (ON CONFLICT DO NOTHING) so re-running is safe.
-- Run AFTER 001_initial_schema.sql on the same database.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Demo user + account + sync state (deterministic UUIDs for reproducibility)
-- -----------------------------------------------------------------------------
INSERT INTO "user" (id, email, name, "avatarUrl") VALUES
    ('00000000-0000-0000-0000-000000000001',
     'btech2023.cs@iitjammu.ac.in',
     'Aarav Sharma',
     NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "account_connection"
    (id, "userId", provider, "providerAccountId", "emailAddress", "displayName", status)
VALUES
    ('00000000-0000-0000-0000-000000000010',
     '00000000-0000-0000-0000-000000000001',
     'google',
     'demo-1043287562398',
     'btech2023.cs@iitjammu.ac.in',
     'Aarav Sharma',
     'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO "sync_state"
    ("accountId", "gmailHistoryId", "lastSyncedAt", "syncStatus", "retryCount")
VALUES
    ('00000000-0000-0000-0000-000000000010',
     'seed-0001',
     now(),
     'success',
     0)
ON CONFLICT ("accountId") DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. Default categories — 10 system categories (Placement, Academic, …, Others)
--    Using UUIDs 100..109 so category IDs are deterministic across reruns.
-- -----------------------------------------------------------------------------
INSERT INTO "category"
    (id, "accountId", name, description, "systemDefault", "sortOrder", color, icon)
VALUES
    ('00000000-0000-0000-0000-000000000101',
     '00000000-0000-0000-0000-000000000010',
     'Placement', 'Internships, placements, career development',
     true, 1,  'amber',   'briefcase'),
    ('00000000-0000-0000-0000-000000000102',
     '00000000-0000-0000-0000-000000000010',
     'Academic', 'Exams, registration, grades, curriculum',
     true, 2,  'blue',     'graduation-cap'),
    ('00000000-0000-0000-0000-000000000103',
     '00000000-0000-0000-0000-000000000010',
     'Professors', 'Faculty communications, projects, assignments',
     true, 3,  'violet',   'user'),
    ('00000000-0000-0000-0000-000000000104',
     '00000000-0000-0000-0000-000000000010',
     'Research', 'Research programs, library, publications',
     true, 4,  'teal',     'flask-conical'),
    ('00000000-0000-0000-0000-000000000105',
     '00000000-0000-0000-0000-000000000010',
     'Student Welfare', 'Counseling, scholarships, sports',
     true, 5,  'rose',     'heart'),
    ('00000000-0000-0000-0000-000000000106',
     '00000000-0000-0000-0000-000000000010',
     'Medical', 'Health check-ups, vaccinations, medical center',
     true, 6,  'red',      'stethoscope'),
    ('00000000-0000-0000-0000-000000000107',
     '00000000-0000-0000-0000-000000000010',
     'Hostel', 'Room allotment, mess, maintenance',
     true, 7,  'orange',   'home'),
    ('00000000-0000-0000-0000-000000000108',
     '00000000-0000-0000-0000-000000000010',
     'Events', 'Cultural fests, hackathons, talks, alumni',
     true, 8,  'fuchsia',  'calendar'),
    ('00000000-0000-0000-0000-000000000109',
     '00000000-0000-0000-0000-000000000010',
     'Finance', 'Fees, receipts, payments',
     true, 9,  'green',    'wallet'),
    ('00000000-0000-0000-0000-000000000110',
     '00000000-0000-0000-0000-000000000010',
     'Others', 'Unmatched and external messages',
     true, 99, 'slate',    'inbox')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Sample senders (Placement Office, Academic Office, Professor)
-- -----------------------------------------------------------------------------
INSERT INTO "sender"
    ("accountId", "senderEmail", "senderName", domain,
     "firstSeenAt", "lastSeenAt", "messageCount", "ruleStatus")
VALUES
    ('00000000-0000-0000-0000-000000000010',
     'placement@iitjammu.ac.in', 'Placement Office', 'iitjammu.ac.in',
     now() - interval '1 day', now() - interval '1 day', 2, 'has_rule'),
    ('00000000-0000-0000-0000-000000000010',
     'academic@iitjammu.ac.in', 'Academic Office', 'iitjammu.ac.in',
     now() - interval '1 day', now() - interval '1 day', 0, 'none'),
    ('00000000-0000-0000-0000-000000000010',
     'rkumar@iitjammu.ac.in', 'Dr. Rajesh Kumar', 'iitjammu.ac.in',
     NULL, NULL, 0, 'none')
ON CONFLICT ("accountId", "senderEmail") DO NOTHING;

-- Capture the generated/seeded sender IDs for the email FK below.
-- (We use a CTE-style lookup at insert time so the FK resolves whether the
--  row was newly inserted or already present from a previous run.)
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 4. Conversation + thread (Placement: 2-message follow-up)
-- -----------------------------------------------------------------------------
INSERT INTO "conversation"
    (id, "accountId", "canonicalSubject", status, "followUpState", importance,
     "messageCount", "participantSummary", "latestMessageAt", "firstMessageAt")
VALUES
    ('00000000-0000-0000-0000-000000000201',
     '00000000-0000-0000-0000-000000000010',
     'Summer Internship 2025',
     'awaiting_user',
     'due',
     'important',
     2,
     '[{"email":"placement@iitjammu.ac.in","name":"Placement Office"},
       {"email":"btech2023.cs@iitjammu.ac.in","name":"Aarav Sharma"}]'::jsonb,
     now() - interval '6 hours',
     now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO "thread"
    ("accountId", "providerThreadId", subject, "lastMessageAt", "conversationId")
VALUES
    ('00000000-0000-0000-0000-000000000010',
     'thread-placement-1',
     'Summer Internship 2025 — Application Window Opens Monday',
     now() - interval '6 hours',
     '00000000-0000-0000-0000-000000000201')
ON CONFLICT ("accountId", "providerThreadId") DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. Sample emails — 2 messages in the placement conversation
--    (Sender FK resolved by subselect on (accountId, senderEmail).)
-- -----------------------------------------------------------------------------
WITH s AS (
    SELECT id AS sender_id FROM "sender"
    WHERE "accountId" = '00000000-0000-0000-0000-000000000010'
      AND "senderEmail" = 'placement@iitjammu.ac.in'
    LIMIT 1
),
t AS (
    SELECT id AS thread_id FROM "thread"
    WHERE "accountId" = '00000000-0000-0000-0000-000000000010'
      AND "providerThreadId" = 'thread-placement-1'
    LIMIT 1
)
INSERT INTO "email"
    ("accountId", "threadId", "providerMessageId", "providerThreadId",
     "senderId", "fromName", "fromEmail",
     "toRecipients", "ccRecipients", "bccRecipients",
     subject, snippet, "bodyText", "bodyHtmlSanitized",
     "receivedAt", "isRead", "isStarred", "isImportant",
     "isSpam", "isDraft", "isSent", "isArchived", "hasAttachment",
     "snoozedUntil", labels, "extractedLinks",
     "classificationSource", "classificationConfidence")
SELECT
    '00000000-0000-0000-0000-000000000010',
    t.thread_id,
    'msg-placement-1',
    'thread-placement-1',
    s.sender_id,
    'Placement Office',
    'placement@iitjammu.ac.in',
    '[{"name":"BTech 2023","email":"btech2023.cs@iitjammu.ac.in"}]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    'Summer Internship 2025 — Application Window Opens Monday',
    'The Summer Internship 2025 application window opens on Monday at 10:00 AM. Eligibility: CGPA >= 7.5…',
    'Dear Students, the Summer Internship 2025 application window opens on Monday at 10:00 AM. Eligibility: CGPA >= 7.5, no active backlogs. Deadline: 25th of this month, 11:59 PM.',
    '<p>Dear Students, the Summer Internship 2025 application window opens on Monday at 10:00 AM.</p>',
    now() - interval '1 day',
    false, true, true,
    false, false, false, false, true,
    NULL,
    '["inbox","important"]'::jsonb,
    '[]'::jsonb,
    'sender_rule', 0.95
FROM s, t
ON CONFLICT ("accountId", "providerMessageId") DO NOTHING;

WITH s AS (
    SELECT id AS sender_id FROM "sender"
    WHERE "accountId" = '00000000-0000-0000-0000-000000000010'
      AND "senderEmail" = 'placement@iitjammu.ac.in'
    LIMIT 1
),
t AS (
    SELECT id AS thread_id FROM "thread"
    WHERE "accountId" = '00000000-0000-0000-0000-000000000010'
      AND "providerThreadId" = 'thread-placement-1'
    LIMIT 1
)
INSERT INTO "email"
    ("accountId", "threadId", "providerMessageId", "providerThreadId",
     "senderId", "fromName", "fromEmail",
     "toRecipients", "ccRecipients", "bccRecipients",
     subject, snippet, "bodyText", "bodyHtmlSanitized",
     "receivedAt", "isRead", "isStarred", "isImportant",
     "isSpam", "isDraft", "isSent", "isArchived", "hasAttachment",
     "snoozedUntil", labels, "extractedLinks",
     "classificationSource", "classificationConfidence")
SELECT
    '00000000-0000-0000-0000-000000000010',
    t.thread_id,
    'msg-placement-2',
    'thread-placement-1',
    s.sender_id,
    'Placement Office',
    'placement@iitjammu.ac.in',
    '[{"email":"btech2023.cs@iitjammu.ac.in"}]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    'Re: Summer Internship 2025 — Pre-Placement Talk Schedule',
    'A pre-placement talk has been scheduled for this Friday, 4:00 PM, Auditorium 1.',
    'A pre-placement talk has been scheduled for this Friday, 4:00 PM, Auditorium 1. Attendance is mandatory.',
    '<p>A pre-placement talk has been scheduled for <strong>this Friday, 4:00 PM, Auditorium 1</strong>.</p>',
    now() - interval '6 hours',
    false, false, true,
    false, false, false, false, false,
    NULL,
    '["inbox"]'::jsonb,
    '[]'::jsonb,
    'sender_rule', 0.9
FROM s, t
ON CONFLICT ("accountId", "providerMessageId") DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. CategoryMembership — both emails → Placement
-- -----------------------------------------------------------------------------
INSERT INTO "category_membership" ("emailId", "categoryId", source, confidence)
SELECT e.id, c.id, 'sender_rule', 0.95
FROM "email" e, "category" c
WHERE e."accountId" = '00000000-0000-0000-0000-000000000010'
  AND e."providerMessageId" IN ('msg-placement-1', 'msg-placement-2')
  AND c."accountId" = '00000000-0000-0000-0000-000000000010'
  AND c.name = 'Placement'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 7. Open deadline + unread notification derived from the seed email
-- -----------------------------------------------------------------------------
INSERT INTO "deadline"
    ("accountId", "emailId", "categoryId", title, "dueAt", confidence, status)
SELECT
    '00000000-0000-0000-0000-000000000010',
    e.id,
    c.id,
    'Summer Internship 2025 — Application Deadline',
    now() + interval '20 days',
    0.92,
    'open'
FROM "email" e, "category" c
WHERE e."accountId" = '00000000-0000-0000-0000-000000000010'
  AND e."providerMessageId" = 'msg-placement-1'
  AND c."accountId" = '00000000-0000-0000-0000-000000000010'
  AND c.name = 'Placement'
ON CONFLICT DO NOTHING;

INSERT INTO "notification"
    ("accountId", "emailId", "categoryId", title, body, importance, "isRead")
SELECT
    '00000000-0000-0000-0000-000000000010',
    e.id,
    c.id,
    'Important: Summer Internship 2025 — Application Window Opens Monday',
    'Eligibility: CGPA >= 7.5. Deadline: 25th of this month, 11:59 PM.',
    'urgent',
    false
FROM "email" e, "category" c
WHERE e."accountId" = '00000000-0000-0000-0000-000000000010'
  AND e."providerMessageId" = 'msg-placement-1'
  AND c."accountId" = '00000000-0000-0000-0000-000000000010'
  AND c.name = 'Placement'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. Audit trail — record that the demo seed was loaded.
-- -----------------------------------------------------------------------------
INSERT INTO "audit_event"
    ("userId", "accountId", "eventType", "targetType", "targetId",
     "sourceSurface", metadata)
VALUES
    ('00000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000010',
     'SEED_DATA_LOADED',
     'system',
     'demo-1043287562398',
     'system',
     '{"source": "002_seed_data.sql", "version": 1}'::jsonb)
ON CONFLICT DO NOTHING;

COMMIT;

-- =============================================================================
-- Verification queries — run manually to confirm the schema accepts the seed.
-- =============================================================================
-- SELECT COUNT(*) AS users         FROM "user";                                      -- expect 1
-- SELECT COUNT(*) AS accounts      FROM "account_connection";                        -- expect 1
-- SELECT COUNT(*) AS categories    FROM "category" WHERE "systemDefault";            -- expect 10
-- SELECT COUNT(*) AS senders       FROM "sender";                                    -- expect 3
-- SELECT COUNT(*) AS conversations FROM "conversation";                              -- expect 1
-- SELECT COUNT(*) AS threads       FROM "thread";                                    -- expect 1
-- SELECT COUNT(*) AS emails        FROM "email";                                     -- expect 2
-- SELECT COUNT(*) AS memberships   FROM "category_membership";                       -- expect 2
-- SELECT COUNT(*) AS deadlines     FROM "deadline";                                  -- expect 1
-- SELECT COUNT(*) AS notifications FROM "notification";                              -- expect 1
-- SELECT COUNT(*) AS audit_events  FROM "audit_event";                               -- expect 1
--
-- SELECT c.name AS category, COUNT(m.id) AS membership_count
-- FROM "category" c
-- LEFT JOIN "category_membership" m ON m."categoryId" = c.id
-- GROUP BY c.name
-- ORDER BY c."sortOrder";                                                              -- Placement: 2, rest: 0
