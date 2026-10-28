-- ==============================================================================
-- Supabase PostgreSQL Migration: Production-Ready Real-time Workspace Schema
-- Target: supabase/migrations/20261028000000_initial_schema.sql
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS
DO $$ BEGIN
  CREATE TYPE public.channel_member_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. TABLES

-- ------------------------------------------------------------------------------
-- Table: public.profiles
-- Mirrors auth.users with public profile metadata, auto-populated on user sign-up
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  email TEXT,
  avatar_url TEXT,
  status_text TEXT DEFAULT 'Online',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- Table: public.channels
-- Workspace channels; supports default open channels (owner_id IS NULL)
-- and user-created channels (owner_id REFERENCES profiles(id))
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon_name TEXT NOT NULL DEFAULT 'Hash' CHECK (icon_name IN ('Hash', 'MessageSquare', 'Bell', 'Code')),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- Table: public.channel_members
-- Multi-user channel memberships with roles ('owner', 'admin', 'member')
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.channel_members (
  channel_id TEXT NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.channel_member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (channel_id, user_id)
);

-- ------------------------------------------------------------------------------
-- Table: public.messages
-- Channel chat messages with client_message_id unique constraint for deduplication
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  client_message_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. PERFORMANCE & FOREIGN KEY INDEXES

-- Messages: channel query & chronological retrieval
CREATE INDEX IF NOT EXISTS idx_messages_channel_created
  ON public.messages (channel_id, created_at DESC);

-- Messages: sender FK cascade & user search
CREATE INDEX IF NOT EXISTS idx_messages_sender_id
  ON public.messages (sender_id);

-- Messages: deduplication lookup on client_message_id
CREATE INDEX IF NOT EXISTS idx_messages_client_message_id
  ON public.messages (client_message_id)
  WHERE client_message_id IS NOT NULL;

-- Channel Members: user channel lookups (reverse of composite PK)
CREATE INDEX IF NOT EXISTS idx_channel_members_user_id
  ON public.channel_members (user_id);

-- Channels: owner lookup
CREATE INDEX IF NOT EXISTS idx_channels_owner_id
  ON public.channels (owner_id);

-- Profiles: username lookup
CREATE INDEX IF NOT EXISTS idx_profiles_username
  ON public.profiles (username)
  WHERE username IS NOT NULL;

-- 5. SECURITY DEFINER HELPER FUNCTIONS (PREVENTS RLS RECURSION)

-- Check channel membership without triggering infinite recursion on channel_members
CREATE OR REPLACE FUNCTION public.is_channel_member(
  target_channel_id TEXT,
  target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.channel_members
    WHERE channel_id = target_channel_id
      AND user_id = target_user_id
  );
$$;

-- Get member role without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.get_channel_role(
  target_channel_id TEXT,
  target_user_id UUID
)
RETURNS public.channel_member_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role
  FROM public.channel_members
  WHERE channel_id = target_channel_id
    AND user_id = target_user_id;
$$;

-- 6. ROW LEVEL SECURITY (RLS) POLICIES

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ─── PROFILES POLICIES ───────────────────────────────────────────────────────
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ─── CHANNELS POLICIES ───────────────────────────────────────────────────────
CREATE POLICY "channels_select_member_or_public"
  ON public.channels FOR SELECT
  TO authenticated
  USING (
    owner_id IS NULL
    OR owner_id = auth.uid()
    OR public.is_channel_member(id, auth.uid())
  );

CREATE POLICY "channels_insert_authenticated"
  ON public.channels FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "channels_update_owner_or_admin"
  ON public.channels FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.get_channel_role(id, auth.uid()) IN ('owner', 'admin')
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR public.get_channel_role(id, auth.uid()) IN ('owner', 'admin')
  );

CREATE POLICY "channels_delete_owner"
  ON public.channels FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- ─── CHANNEL MEMBERS POLICIES ────────────────────────────────────────────────
CREATE POLICY "channel_members_select_member"
  ON public.channel_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_channel_member(channel_id, auth.uid())
  );

CREATE POLICY "channel_members_insert_authorized"
  ON public.channel_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Channel owner or admin can add members with role 'member'
    (public.get_channel_role(channel_id, auth.uid()) IN ('owner', 'admin') AND role = 'member')
    -- Channel owner can assign admin role
    OR (public.get_channel_role(channel_id, auth.uid()) = 'owner')
    -- Self-join open/public workspace channels (owner_id IS NULL)
    OR (
      user_id = auth.uid()
      AND role = 'member'
      AND EXISTS (SELECT 1 FROM public.channels c WHERE c.id = channel_id AND c.owner_id IS NULL)
    )
  );

CREATE POLICY "channel_members_update_owner_only"
  ON public.channel_members FOR UPDATE
  TO authenticated
  USING (public.get_channel_role(channel_id, auth.uid()) = 'owner')
  WITH CHECK (public.get_channel_role(channel_id, auth.uid()) = 'owner');

CREATE POLICY "channel_members_delete_self_or_admin"
  ON public.channel_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.get_channel_role(channel_id, auth.uid()) IN ('owner', 'admin')
  );

-- ─── MESSAGES POLICIES ───────────────────────────────────────────────────────
CREATE POLICY "messages_select_channel_member"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    public.is_channel_member(channel_id, auth.uid())
  );

-- Anti-spoofing + authorized member check:
-- Enforces sender_id matches authenticated user, and user is in channel_members
CREATE POLICY "messages_insert_anti_spoofing"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_channel_member(channel_id, auth.uid())
  );

CREATE POLICY "messages_update_own"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "messages_delete_own_or_admin"
  ON public.messages FOR DELETE
  TO authenticated
  USING (
    sender_id = auth.uid()
    OR public.get_channel_role(channel_id, auth.uid()) IN ('owner', 'admin')
  );

-- 7. TRIGGERS & PROCEDURES

-- ------------------------------------------------------------------------------
-- 7.1 Automatic updated_at Timestamps
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_channels_updated_at ON public.channels;
CREATE TRIGGER set_channels_updated_at
  BEFORE UPDATE ON public.channels
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_messages_updated_at ON public.messages;
CREATE TRIGGER set_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 7.2 Automatic Profile Creation on User Sign-up & Default Channel Enrolment
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_avatar TEXT;
BEGIN
  -- Extract display name from metadata or email fallback
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1),
    'Member'
  );

  -- Extract avatar URL or generate avatar based on user name
  v_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || encode(v_name::bytea, 'hex')
  );

  -- Insert profile
  INSERT INTO public.profiles (id, name, email, avatar_url, status_text)
  VALUES (NEW.id, v_name, NEW.email, v_avatar, 'Online')
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        email = EXCLUDED.email,
        avatar_url = EXCLUDED.avatar_url;

  -- Auto-enroll new user into default workspace channels (where owner_id IS NULL)
  INSERT INTO public.channel_members (channel_id, user_id, role)
  SELECT c.id, NEW.id, 'member'::public.channel_member_role
  FROM public.channels c
  WHERE c.owner_id IS NULL
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 7.3 Atomic Channel Creation with Automatic Owner Member Assignment
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_channel_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.channel_members (channel_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner'::public.channel_member_role)
    ON CONFLICT (channel_id, user_id) DO UPDATE
      SET role = 'owner'::public.channel_member_role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_channel_created ON public.channels;
CREATE TRIGGER on_channel_created
  AFTER INSERT ON public.channels
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_channel_created();

-- Optional RPC procedure for explicit atomic channel creation
CREATE OR REPLACE FUNCTION public.create_channel_atomic(
  p_id TEXT,
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_icon_name TEXT DEFAULT 'Hash'
)
RETURNS public.channels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_channel public.channels;
  v_clean_id TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_clean_id := COALESCE(NULLIF(trim(p_id), ''), lower(regexp_replace(trim(p_name), '\s+', '-', 'g')));

  INSERT INTO public.channels (id, name, description, icon_name, owner_id)
  VALUES (v_clean_id, trim(p_name), trim(p_description), p_icon_name, v_user_id)
  RETURNING * INTO v_channel;

  INSERT INTO public.channel_members (channel_id, user_id, role)
  VALUES (v_channel.id, v_user_id, 'owner'::public.channel_member_role)
  ON CONFLICT (channel_id, user_id) DO UPDATE SET role = 'owner'::public.channel_member_role;

  RETURN v_channel;
END;
$$;

-- 8. DEFAULT PUBLIC SEED CHANNELS
INSERT INTO public.channels (id, name, description, icon_name, owner_id)
VALUES
  ('general', 'general', 'Company-wide announcements and team discussions', 'Hash', NULL),
  ('random', 'random', 'Water cooler chat, off-topic discussions, and fun', 'MessageSquare', NULL),
  ('announcements', 'announcements', 'Official workspace updates, policy changes, and events', 'Bell', NULL),
  ('development', 'development', 'Engineering discussions, commits, pull requests, and deploys', 'Code', NULL)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      icon_name = EXCLUDED.icon_name;

-- 9. SUPABASE REALTIME PUBLICATION
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_members;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.messages REPLICA IDENTITY FULL;
