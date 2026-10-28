# Supabase Architecture & Production Setup Guide

This guide provides step-by-step instructions for provisioning, configuring, and verifying the **Supabase** backend for `workspace-app`.

---

## 1. Architecture Overview

`workspace-app` integrates with Supabase to deliver a secure, multi-user communication workspace:

- **Authentication (`auth.users`)**: Native session management, email/password registration, password authentication, and session recovery across tab reloads (`onAuthStateChange`).
- **User Profiles (`public.profiles`)**: Automatically synchronized mirror of `auth.users` via database trigger (`on_auth_user_created`).
- **Channels (`public.channels`)**: Workspace discussion rooms supporting default system channels (`owner_id IS NULL`) and user-created channels (`owner_id REFERENCES profiles(id)`).
- **Channel Members (`public.channel_members`)**: Composite key `(channel_id, user_id)` managing user roles (`owner`, `admin`, `member`) with atomic assignment via database trigger (`on_channel_created`).
- **Messages (`public.messages`)**: Channel chat messages enforced with client message UUIDs (`client_message_id UNIQUE`) for deterministic deduplication, optimistic UI reconciliation, and idempotent retry resilience.
- **Row Level Security (RLS)**: Strict access controls preventing unauthorized message reads/writes, preventing sender spoofing (`sender_id = auth.uid()`), and avoiding infinite policy recursion via `SECURITY DEFINER STABLE` helper functions (`is_channel_member`, `get_channel_role`).
- **Supabase Realtime**: WebSocket event streaming on table `public.messages` with `REPLICA IDENTITY FULL` scoped per channel.

---

## 2. Step 1: Create a Supabase Project

You can set up Supabase using either the **Supabase Cloud Dashboard** or the **Supabase Local CLI**.

### Option A: Supabase Cloud Dashboard (Recommended for Production)

1. Navigate to [Supabase Dashboard](https://supabase.com/dashboard) and sign in.
2. Click **New Project** and select your organization.
3. Enter your project details:
   - **Name**: `workspace-app`
   - **Database Password**: Choose a strong password and save it securely.
   - **Region**: Select the region closest to your users.
4. Click **Create new project** and wait for the database provisioning to complete (~1-2 minutes).

### Option B: Supabase Local CLI (Recommended for Offline / Local Docker Development)

1. Ensure [Docker Desktop](https://www.docker.com/) is running.
2. Install the Supabase CLI if you haven't already:
   ```bash
   npm install -g supabase
   ```
3. In the repository root, start the local containers:
   ```bash
   supabase start
   ```
4. Note the output API URL (typically `http://127.0.0.1:54321`) and anon key.

---

## 3. Step 2: Apply Database Migrations

The database schema, RLS policies, anti-spoofing triggers, and initial seed channels are defined in:
`supabase/migrations/20261028000000_initial_schema.sql`

### For Supabase Cloud:
1. Open your project in the Supabase Dashboard.
2. In the left navigation menu, click **SQL Editor**.
3. Click **New query** (or the `+` button).
4. Copy the entire contents of `supabase/migrations/20261028000000_initial_schema.sql` and paste them into the SQL editor.
5. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`).
6. Confirm that the execution status indicates `Success. No rows returned`.

### For Supabase Local CLI:
Run:
```bash
supabase db reset
# Or directly apply the migration file:
supabase migration up
```

---

## 4. Step 3: Verify Database Tables, RLS Policies & Realtime

To ensure all migrations applied correctly, verify the following in your database:

### 4.1 Tables Created
Navigate to **Table Editor** in the Supabase Dashboard and verify the 4 tables:
1. `profiles`: Contains columns `id` (UUID PK), `name`, `username`, `email`, `avatar_url`, `status_text`, `created_at`, `updated_at`.
2. `channels`: Contains columns `id` (TEXT PK), `name`, `description`, `icon_name`, `owner_id`, `created_at`, `updated_at`.
3. `channel_members`: Contains columns `channel_id` (TEXT), `user_id` (UUID), `role` (enum: owner/admin/member), `joined_at`.
4. `messages`: Contains columns `id` (UUID PK), `channel_id` (TEXT FK), `sender_id` (UUID FK), `content` (TEXT), `client_message_id` (TEXT UNIQUE), `created_at`, `updated_at`.

### 4.2 Seed Channels Verification
Run the following SQL query in **SQL Editor** to confirm the default channels exist:
```sql
SELECT id, name, icon_name, owner_id FROM public.channels;
```
Expected output includes:
- `general` (icon: `Hash`, owner_id: `NULL`)
- `random` (icon: `MessageSquare`, owner_id: `NULL`)
- `announcements` (icon: `Bell`, owner_id: `NULL`)
- `development` (icon: `Code`, owner_id: `NULL`)

### 4.3 Row Level Security (RLS) Policies
Under **Authentication > Policies** (or **Table Editor > [Table] > View policies**), confirm that RLS is enabled on all 4 tables:
- `profiles`:
  - `profiles_select_all` (SELECT to `authenticated`)
  - `profiles_insert_own` (INSERT `auth.uid() = id`)
  - `profiles_update_own` (UPDATE `auth.uid() = id`)
- `channels`:
  - `channels_select_member_or_public` (SELECT open or user channels)
  - `channels_insert_authenticated` (INSERT with `owner_id = auth.uid()`)
  - `channels_update_owner_or_admin` (UPDATE for owners and admins)
  - `channels_delete_owner` (DELETE for channel owner)
- `channel_members`:
  - `channel_members_select_member` (SELECT members)
  - `channel_members_insert_authorized` (INSERT with role validation and open channel auto-enrolment)
  - `channel_members_update_owner_only` (UPDATE role)
  - `channel_members_delete_self_or_admin` (DELETE)
- `messages`:
  - `messages_select_channel_member` (SELECT scoped to authorized channel members)
  - `messages_insert_anti_spoofing` (INSERT enforcing `sender_id = auth.uid()` AND channel membership)
  - `messages_update_own` (UPDATE sender only)
  - `messages_delete_own_or_admin` (DELETE sender or channel admin)

### 4.4 Supabase Realtime Publication
Navigate to **Database > Publications** and click **`supabase_realtime`**:
- Verify that `public.messages`, `public.channels`, and `public.channel_members` are included in the publication.
- Verify `public.messages` has `REPLICA IDENTITY FULL` enabled.

---

## 5. Step 4: Configure Authentication Settings

1. In the Supabase Dashboard, go to **Authentication > Providers > Email**.
2. **Email Provider**: Ensure it is enabled.
3. **Confirm Email**:
   - For **Development / Quick Start**: Uncheck **"Confirm email"**. This allows users to immediately sign in upon registration without awaiting an email verification link.
   - For **Production**: Keep **"Confirm email"** checked and configure SMTP under **Project Settings > Authentication > SMTP Settings**.
4. Click **Save**.

---

## 6. Step 5: Configure Environment Variables

1. In your project directory (`workspace-app`), copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Retrieve your project credentials:
   - In Supabase Dashboard, go to **Project Settings > API**.
   - Copy the **Project URL** into `NEXT_PUBLIC_SUPABASE_URL`.
   - Copy the **anon public key** into `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Open `.env.local` and populate the values:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

> **Note on Offline Mode**: If `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are not provided, `workspace-app` runs in **dual-mode offline fallback**. In offline mode, authentication and message store actions run in-memory and via `localStorage` with a 1000ms delay simulator.

---

## 7. Step 6: Launch Development Server & Verify

### 7.1 Start the Development Server
```bash
cd workspace-app
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 7.2 Run Verification Test Suites
Execute the verification test commands to validate everything:

```bash
# 1. Lint cleanliness (zero errors)
npx eslint src

# 2. TypeScript static typecheck (zero type errors)
npx tsc --noEmit

# 3. Next.js production build check
npm run build

# 4. Master regression test suite (122 tests across 4 tiers)
npm test

# 5. Targeted Supabase Auth unit tests
npx tsx tests/supabase-auth.test.ts

# 6. Real-time chat sync, deduplication & retry tests
npx tsx tests/realtime-chat-sync.test.ts

# 7. Comprehensive end-to-end Supabase integration suite
npx tsx tests/supabase-integration.test.ts
```

---

## 8. Troubleshooting & FAQ

### Issue: "new row violates row-level security policy for table messages"
- **Cause**: User is attempting to insert a message with a `sender_id` that does not match `auth.uid()`, or the user has not been added to `channel_members` for that channel.
- **Resolution**: Ensure the user is authenticated via `useAuthStore` and is a member of the channel. For default channels (`general`, `random`, `announcements`, `development`), the `handle_new_user()` trigger auto-enrolls all new users on sign-up.

### Issue: "duplicate key value violates unique constraint idx_messages_client_message_id" (PostgreSQL 23505)
- **Cause**: A retry was triggered for a message whose insert had already succeeded on the server before the client lost connection.
- **Resolution**: This is expected and fully handled! `workspace-app` catches error code `23505`, queries the existing message by `client_message_id`, retrieves the server database ID, and marks the message as `sent` idempotently.

### Issue: Real-time messages are not appearing across browser windows
- **Checklist**:
  1. Confirm that `supabase_realtime` publication includes the `messages` table:
     ```sql
     SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
     ```
  2. Confirm `REPLICA IDENTITY FULL` is active on `messages`:
     ```sql
     ALTER TABLE public.messages REPLICA IDENTITY FULL;
     ```
  3. Ensure both browser sessions are in the same channel (e.g., `#general`). Realtime streaming is scoped per active channel to prevent cross-channel leakage.
