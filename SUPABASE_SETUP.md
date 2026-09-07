# Supabase Setup — Institutional Email Intelligence

This guide walks you through provisioning a Supabase PostgreSQL project for
the Institutional Email Intelligence backend, loading the schema and seed data,
configuring environment variables, and verifying the connection. It then
enables Row Level Security (RLS) with account-level isolation policies so
every row is implicitly scoped to the account that owns it.

> **Prerequisites**
> - A [Supabase](https://supabase.com) account (free tier is fine).
> - `psql` installed locally (optional — the Supabase web SQL editor works too).
> - The two SQL files in this repo: `backend/sql/001_initial_schema.sql` and
>   `backend/sql/002_seed_data.sql`.

---

## 1. Create a Supabase project

1. Sign in at <https://app.supabase.com>.
2. Click **New project**.
3. Pick a **Name** (e.g. `email-intel`), a strong **Database password**
   (save it in your password manager — you'll need it), and the **Region**
   closest to your users.
4. Choose **PostgreSQL 15+** (the default). The schema uses `gen_random_uuid()`
   which is built-in on 13+.
5. Click **Create new project** and wait ~2 minutes for provisioning to finish.

You'll land on the project dashboard. Note the **Project URL** and
**Project ref** in *Project Settings → API* — you'll need them later.

---

## 2. Get the connection string

Open **Project Settings → Database → Connection string** and copy the
**URI** tab. It looks like:

```
postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
```

Two important notes:

- **Use the *pooled* connection (port `6543`) for the FastAPI app** — it
  routes through Supavisor and supports many concurrent connections from
  serverless / containerised workloads.
- **Use the *direct* connection (port `5432`) for Prisma migrations and
  one-off scripts** that need a session-level context.
- Replace `[YOUR-PASSWORD]` with the database password you set in step 1.

URL-encode the password if it contains special characters (`@`, `:`, `/`, etc.).

---

## 3. Run the SQL migrations

You can run the migrations from the Supabase web UI or from `psql`.

### Option A — Web SQL editor (easiest)

1. In the Supabase dashboard, open the **SQL Editor** tab.
2. Click **New query**, paste the entire contents of
   `backend/sql/001_initial_schema.sql`, and click **Run**.
3. Open another **New query**, paste `backend/sql/002_seed_data.sql`, and
   click **Run**.
4. Open a third query and run the verification snippet from the bottom of
   `002_seed_data.sql` — every count should match the expected value.

### Option B — psql (recommended for CI)

```bash
# Replace $DATABASE_URL with your pooled connection string.
export DATABASE_URL='postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres'

psql "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f backend/sql/001_initial_schema.sql

psql "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f backend/sql/002_seed_data.sql
```

Either way, you should now have **27 tables** in the `public` schema. Confirm
with:

```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Expected (27 rows): `account_connection`, `action_item`, `assistant_action`,
`assistant_conversation`, `assistant_message`, `audit_event`, `category`,
`category_membership`, `classification_result`, `conversation`,
`conversation_override`, `deadline`, `draft`, `email`, `email_attachment`,
`email_relationship`, `email_template`, `notification`,
`notification_preference`, `rule`, `rule_version`, `saved_search`,
`sender`, `sync_state`, `thread`, `user`.

---

## 4. Set environment variables

Create a `.env` file (or set these in your FastAPI deployment environment):

```bash
# Pooled connection — used by FastAPI request handlers.
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"

# Direct connection — used by Alembic migrations and one-off scripts.
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

# Supabase project — used for storage / auth integrations.
SUPABASE_URL="https://[project-ref].supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOi..."      # Project Settings → API → anon public
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."  # Project Settings → API → service_role
```

> ⚠️ **Never commit `.env`.** Add it to `.gitignore`. The `service_role` key
> bypasses RLS — keep it on the server only.

---

## 5. Verify with a test query

Run a quick smoke test against the seeded data:

```sql
-- Should return: Aarav Sharma / btech2023.cs@iitjammu.ac.in / 10 / 2 / 1 / 1
SELECT
    u.name,
    a."emailAddress",
    (SELECT COUNT(*) FROM "category"     WHERE "accountId" = a.id) AS categories,
    (SELECT COUNT(*) FROM "email"        WHERE "accountId" = a.id) AS emails,
    (SELECT COUNT(*) FROM "deadline"     WHERE "accountId" = a.id) AS deadlines,
    (SELECT COUNT(*) FROM "notification" WHERE "accountId" = a.id) AS notifications
FROM "user" u
JOIN "account_connection" a ON a."userId" = u.id
LIMIT 1;
```

Or from Python (SQLAlchemy / asyncpg):

```python
import os, asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    row = await conn.fetchrow('''
        SELECT u.name, a."emailAddress", COUNT(c.id) AS categories
        FROM "user" u
        JOIN "account_connection" a ON a."userId" = u.id
        LEFT JOIN "category" c ON c."accountId" = a.id
        GROUP BY u.name, a."emailAddress"
        LIMIT 1
    ''')
    print(row)  # <Record name='Aarav Sharma' emailAddress='...' categories=10>
    await conn.close()

asyncio.run(main())
```

If you see `Aarav Sharma` and `categories=10`, the schema and seed are good.

---

## 6. Row Level Security (RLS)

The application isolates every row by `accountId` (and a handful of tables
by `userId`). Supabase exposes the Postgres `auth.uid()` function inside RLS
policies, which we'll map to the user's account.

### 6.1 Enable RLS on every table

```sql
ALTER TABLE "user"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "account_connection"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sync_state"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "category"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sender"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "thread"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_attachment"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "category_membership"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "classification_result"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rule"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rule_version"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_override"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deadline"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "action_item"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_preference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assistant_conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assistant_message"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assistant_action"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_event"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "draft"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saved_search"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_template"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_relationship"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation_override"   ENABLE ROW LEVEL SECURITY;
```

### 6.2 Helper — current account id

Supabase Auth puts the authenticated user's id in `auth.uid()`. Our app maps
that to a single `account_connection` row. Define a SQL function so policies
stay short:

```sql
CREATE OR REPLACE FUNCTION public.current_account_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM "account_connection"
    WHERE "userId" = auth.uid()
    LIMIT 1
$$;
```

### 6.3 Account-scoped policies (most tables)

Apply the same four policies (SELECT / INSERT / UPDATE / DELETE) to every
table that has an `accountId` column. Below is the template using `email` as
an example — replicate for `category`, `sender`, `conversation`, `thread`,
`rule`, `deadline`, `action_item`, `notification`, `draft`, `saved_search`,
`email_template`, `email_relationship`, `audit_event`, `user_override`,
`conversation_override`:

```sql
-- Example: email
CREATE POLICY "email_select_own" ON "email"
    FOR SELECT USING ("accountId" = public.current_account_id());

CREATE POLICY "email_insert_own" ON "email"
    FOR INSERT WITH CHECK ("accountId" = public.current_account_id());

CREATE POLICY "email_update_own" ON "email"
    FOR UPDATE USING ("accountId" = public.current_account_id())
    WITH CHECK ("accountId" = public.current_account_id());

CREATE POLICY "email_delete_own" ON "email"
    FOR DELETE USING ("accountId" = public.current_account_id());
```

### 6.4 Child tables (no direct accountId — join to parent)

Tables like `email_attachment`, `category_membership`, `classification_result`,
`rule_version`, and `assistant_message` don't have an `accountId` column.
Scope them through their parent:

```sql
-- email_attachment: scope through email
CREATE POLICY "email_attachment_select_own" ON "email_attachment"
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM "email" e
        WHERE e.id = "email_attachment"."emailId"
          AND e."accountId" = public.current_account_id()));

CREATE POLICY "email_attachment_insert_own" ON "email_attachment"
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM "email" e
        WHERE e.id = "email_attachment"."emailId"
          AND e."accountId" = public.current_account_id()));

CREATE POLICY "email_attachment_delete_own" ON "email_attachment"
    FOR DELETE USING (EXISTS (
        SELECT 1 FROM "email" e
        WHERE e.id = "email_attachment"."emailId"
          AND e."accountId" = public.current_account_id()));

-- category_membership: scope through email OR category
CREATE POLICY "category_membership_select_own" ON "category_membership"
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM "email" e
                WHERE e.id = "category_membership"."emailId"
                  AND e."accountId" = public.current_account_id())
     OR EXISTS (SELECT 1 FROM "category" c
                WHERE c.id = "category_membership"."categoryId"
                  AND c."accountId" = public.current_account_id()));

CREATE POLICY "category_membership_insert_own" ON "category_membership"
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM "category" c
                WHERE c.id = "category_membership"."categoryId"
                  AND c."accountId" = public.current_account_id()));

CREATE POLICY "category_membership_delete_own" ON "category_membership"
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM "category" c
                WHERE c.id = "category_membership"."categoryId"
                  AND c."accountId" = public.current_account_id()));

-- rule_version: scope through rule
CREATE POLICY "rule_version_select_own" ON "rule_version"
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM "rule" r
        WHERE r.id = "rule_version"."ruleId"
          AND r."accountId" = public.current_account_id()));

CREATE POLICY "rule_version_insert_own" ON "rule_version"
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM "rule" r
        WHERE r.id = "rule_version"."ruleId"
          AND r."accountId" = public.current_account_id()));

CREATE POLICY "rule_version_delete_own" ON "rule_version"
    FOR DELETE USING (EXISTS (
        SELECT 1 FROM "rule" r
        WHERE r.id = "rule_version"."ruleId"
          AND r."accountId" = public.current_account_id()));
```

### 6.5 User-scoped tables (User, AssistantConversation)

```sql
-- user: a row is visible only to itself
CREATE POLICY "user_select_self" ON "user"
    FOR SELECT USING (id = auth.uid());
CREATE POLICY "user_update_self" ON "user"
    FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- assistant_conversation: scoped by userId (or accountId)
CREATE POLICY "assistant_conversation_select_own" ON "assistant_conversation"
    FOR SELECT USING ("userId" = auth.uid());
CREATE POLICY "assistant_conversation_insert_own" ON "assistant_conversation"
    FOR INSERT WITH CHECK ("userId" = auth.uid());
CREATE POLICY "assistant_conversation_update_own" ON "assistant_conversation"
    FOR UPDATE USING ("userId" = auth.uid())
    WITH CHECK ("userId" = auth.uid());
CREATE POLICY "assistant_conversation_delete_own" ON "assistant_conversation"
    FOR DELETE USING ("userId" = auth.uid());

-- assistant_message / assistant_action: scope through assistant_conversation
CREATE POLICY "assistant_message_select_own" ON "assistant_message"
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM "assistant_conversation" ac
        WHERE ac.id = "assistant_message"."conversationId"
          AND ac."userId" = auth.uid()));
-- (repeat INSERT / UPDATE / DELETE following the same EXISTS pattern)
```

### 6.6 Service-role bypass

The `service_role` key (set in step 4) bypasses RLS entirely — so background
sync workers, AI agents, and admin tooling that need cross-account access can
connect with `service_role`. **Never expose this key to the browser.**

### 6.7 Verify RLS

```sql
-- From the SQL editor, signed in as a non-service-role user:
SELECT * FROM "email";          -- only rows for current_account_id() visible
SELECT * FROM "category";       -- only this account's categories

-- Confirm RLS is enabled:
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('email', 'category', 'notification')
ORDER BY relname;
-- Expect relrowsecurity = true for all three.
```

---

## 7. Backups

Supabase takes automatic daily backups on the Pro plan and above. For the
free tier, schedule a weekly `pg_dump`:

```bash
pg_dump "$DIRECT_URL" --no-owner --no-privileges \
  --format=custom --file=backup-$(date +%Y%m%d).dump
```

Store the dump in object storage (S3, R2, or Supabase Storage).

---

## 8. Common pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| `permission denied for table "email"` | RLS enabled but no policy matches, and you're connecting as `anon`/`authenticated` | Add the policies in §6.3, or connect with `service_role` for admin tasks. |
| `gen_random_uuid() does not exist` | Running on PostgreSQL < 13 without pgcrypto | The `CREATE EXTENSION IF NOT EXISTS pgcrypto;` at the top of `001_initial_schema.sql` handles this — re-run that line. |
| `relation "user" already exists` | Re-running `001_initial_schema.sql` | Drop the schema first: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` (⚠️ destructive — only on a fresh project). |
| `remaining connection slots are reserved` | Too many direct connections | Switch the app to the pooled URL (port 6543). |
| Seed inserts fail with FK violation | Ran `002_seed_data.sql` before `001_initial_schema.sql` | Re-run `001_initial_schema.sql` first. |

---

## 9. Next steps

1. Wire up Alembic (or Prisma Migrate in PostgreSQL mode) so future schema
   changes are versioned — see `BACKEND_MIGRATION.md` §6 for the iteration
   plan.
2. Point the FastAPI app's `DATABASE_URL` at the pooled connection string.
3. Run the FastAPI test suite against the seeded database.
4. Once green, enable Supabase Auth (email + Google OAuth) and replace the
   demo session helper with real `auth.uid()` resolution.
