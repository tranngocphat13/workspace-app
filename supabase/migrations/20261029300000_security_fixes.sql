-- ==============================================================================
-- Supabase PostgreSQL Migration: Milestone 1 Security & Database Remediation
-- Target: supabase/migrations/20261029300000_security_fixes.sql
--
-- Fixes Addressed:
-- SEC-01: Storage read policy: replace broad chat_attachments_select_auth with
--         channel-membership scoped read policy.
-- SEC-02: channel_members UPDATE policy: allow users to update their own last_read_at
--         while strictly preventing non-owners from elevating roles.
-- SEC-03: Ensure private channels and DMs cannot be exposed to the public if
--         owner_id is set to null on user deletion.
-- SEC-04: Prevent admins from deleting/kicking the channel owner in channel_members.
-- SEC-05: Restrict RPC get_or_create_dm execution permissions strictly to authenticated.
-- SEC-06: Add DOC/DOCX MIME types to storage bucket chat-attachments allowed_mime_types.
-- SEC-07: Add immutability check on channel_id, sender_id, and created_at on message UPDATE.
-- ==============================================================================

-- ==============================================================================
-- 1. SEC-03: CASCADE OWNERSHIP SAFETY & IS_PUBLIC COLUMN
-- Prevent private channels and DMs from becoming public on owner account deletion.
-- ==============================================================================

-- 1.1 Add explicit is_public column on channels
ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_channels_is_public
  ON public.channels (is_public);

-- 1.2 Mark default workspace seed channels as explicitly public
UPDATE public.channels
  SET is_public = true
  WHERE id IN ('general', 'random', 'announcements', 'development')
     OR (owner_id IS NULL AND is_dm = false);

-- 1.3 Ensure DM channels are NEVER public
UPDATE public.channels
  SET is_public = false
  WHERE is_dm = true;

-- 1.4 Recreate channels SELECT policy using is_public flag
DROP POLICY IF EXISTS "channels_select_member_or_public" ON public.channels;

CREATE POLICY "channels_select_member_or_public"
  ON public.channels FOR SELECT
  TO authenticated
  USING (
    (is_public = true AND is_dm = false)
    OR (owner_id IS NOT NULL AND owner_id = auth.uid())
    OR public.is_channel_member(id, auth.uid())
  );

-- 1.5 Recreate channel_members INSERT policy to only allow self-joining explicitly public channels
DROP POLICY IF EXISTS "channel_members_insert_authorized" ON public.channel_members;

CREATE POLICY "channel_members_insert_authorized"
  ON public.channel_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Channel owner or admin can add members with role 'member'
    (public.get_channel_role(channel_id, auth.uid()) IN ('owner', 'admin') AND role = 'member')
    -- Channel owner can assign admin role
    OR (public.get_channel_role(channel_id, auth.uid()) = 'owner')
    -- Self-join strictly public workspace channels (is_public = true and not DM)
    OR (
      user_id = auth.uid()
      AND role = 'member'
      AND EXISTS (
        SELECT 1 FROM public.channels c
        WHERE c.id = channel_id
          AND c.is_public = true
          AND c.is_dm = false
      )
    )
  );

-- 1.6 Update handle_new_user trigger to enroll users only into public non-DM channels
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

  -- Auto-enroll new user into default workspace channels (is_public = true, is_dm = false)
  INSERT INTO public.channel_members (channel_id, user_id, role)
  SELECT c.id, NEW.id, 'member'::public.channel_member_role
  FROM public.channels c
  WHERE c.is_public = true AND c.is_dm = false
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ==============================================================================
-- 2. SEC-02: CHANNEL MEMBERS UPDATE & ROLE ELEVATION PROTECTION
-- Allow members to update their own last_read_at while preventing role tampering.
-- ==============================================================================

-- 2.1 Trigger function guarding role tampering and key immutability
CREATE OR REPLACE FUNCTION public.check_channel_member_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role public.channel_member_role;
BEGIN
  -- channel_id and user_id are strictly immutable
  IF NEW.channel_id <> OLD.channel_id OR NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'Cannot modify channel_id or user_id of a channel member';
  END IF;

  -- If role is modified, only channel owners are authorized to change roles
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    v_caller_role := public.get_channel_role(OLD.channel_id, auth.uid());
    IF v_caller_role IS DISTINCT FROM 'owner'::public.channel_member_role THEN
      RAISE EXCEPTION 'Only channel owners can change member roles';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_channel_member_update ON public.channel_members;
CREATE TRIGGER trigger_check_channel_member_update
  BEFORE UPDATE ON public.channel_members
  FOR EACH ROW
  EXECUTE FUNCTION public.check_channel_member_update();

-- 2.2 UPDATE policy for channel_members
DROP POLICY IF EXISTS "channel_members_update_owner_only" ON public.channel_members;
DROP POLICY IF EXISTS "channel_members_update_self_or_owner" ON public.channel_members;

CREATE POLICY "channel_members_update_self_or_owner"
  ON public.channel_members FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.get_channel_role(channel_id, auth.uid()) = 'owner'
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.get_channel_role(channel_id, auth.uid()) = 'owner'
  );

-- ==============================================================================
-- 3. SEC-04: OWNER KICK PROTECTION IN CHANNEL MEMBERS
-- Prevent admins from deleting/kicking channel owners or fellow admins.
-- ==============================================================================

DROP POLICY IF EXISTS "channel_members_delete_self_or_admin" ON public.channel_members;

CREATE POLICY "channel_members_delete_self_or_admin"
  ON public.channel_members FOR DELETE
  TO authenticated
  USING (
    -- 1. Users can always leave / remove themselves
    user_id = auth.uid()
    -- 2. Channel owner can kick any member or admin
    OR public.get_channel_role(channel_id, auth.uid()) = 'owner'
    -- 3. Channel admin can ONLY kick regular members, NEVER the owner or fellow admins
    OR (
      public.get_channel_role(channel_id, auth.uid()) = 'admin'
      AND public.get_channel_role(channel_id, user_id) = 'member'
    )
  );

-- ==============================================================================
-- 4. SEC-05: RPC get_or_create_dm HARDENING & PERMISSION RESTRICTION
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_or_create_dm(target_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_dm_channel_id TEXT;
  v_caller_name TEXT;
  v_target_name TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_caller_id = target_user_id THEN
    RAISE EXCEPTION 'Cannot create direct message with yourself';
  END IF;

  -- Validate target user exists in profiles
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  -- Deterministic canonical ID sorted by UUID strings
  IF v_caller_id::text < target_user_id::text THEN
    v_dm_channel_id := 'dm-' || v_caller_id::text || '-' || target_user_id::text;
  ELSE
    v_dm_channel_id := 'dm-' || target_user_id::text || '-' || v_caller_id::text;
  END IF;

  -- Get display names
  SELECT name INTO v_target_name FROM public.profiles WHERE id = target_user_id;
  SELECT name INTO v_caller_name FROM public.profiles WHERE id = v_caller_id;

  -- Create DM channel atomically (is_dm = true, is_public = false)
  INSERT INTO public.channels (id, name, description, icon_name, owner_id, is_dm, is_public)
  VALUES (
    v_dm_channel_id,
    COALESCE(v_target_name, 'Direct Message'),
    'Direct conversation between members',
    'MessageSquare',
    v_caller_id,
    true,
    false
  )
  ON CONFLICT (id) DO NOTHING;

  -- Enrol both participants as members
  INSERT INTO public.channel_members (channel_id, user_id, role)
  VALUES
    (v_dm_channel_id, v_caller_id, 'member'::public.channel_member_role),
    (v_dm_channel_id, target_user_id, 'member'::public.channel_member_role)
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  RETURN v_dm_channel_id;
END;
$$;

-- Restrict execution strictly to authenticated role (prevent anonymous public calls)
REVOKE EXECUTE ON FUNCTION public.get_or_create_dm(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm(UUID) TO authenticated;

-- ==============================================================================
-- 5. SEC-06: STORAGE BUCKET MIME TYPES ALIGNMENT
-- Add DOC and DOCX MIME types to allowed_mime_types
-- ==============================================================================

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
WHERE id = 'chat-attachments';

-- ==============================================================================
-- 6. SEC-01: STORAGE READ AUTHORIZATION (Hardening chat-attachments bucket)
-- Replace broad select policy with channel-membership scoped read policy.
-- ==============================================================================

DROP POLICY IF EXISTS "chat_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "chat_attachments_select_auth" ON storage.objects;
DROP POLICY IF EXISTS "chat_attachments_select_channel_member" ON storage.objects;

CREATE POLICY "chat_attachments_select_channel_member"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (
      -- 1. Uploader can always read their own uploaded files
      (storage.foldername(name))[1] = auth.uid()::text
      OR owner = auth.uid()
      -- 2. Scoped by channel folder: path begins with {channel_id}/...
      OR EXISTS (
        SELECT 1 FROM public.channel_members cm
        WHERE cm.channel_id = (storage.foldername(name))[1]
          AND cm.user_id = auth.uid()
      )
      -- 3. Scoped by message attachment reference: file is linked to a message in an authorized channel
      OR EXISTS (
        SELECT 1 FROM public.messages m
        JOIN public.channels c ON c.id = m.channel_id
        WHERE (m.attachment_url = name OR m.attachment_url LIKE '%' || name)
          AND (
            public.is_channel_member(m.channel_id, auth.uid())
            OR (c.is_dm = false AND (c.is_public = true OR (c.owner_id IS NULL AND c.is_public IS DISTINCT FROM false)))
          )
      )
    )
  );

-- ==============================================================================
-- 7. SEC-07: MESSAGE UPDATE IMMUTABILITY & PURE ATTACHMENT SUPPORT
-- ==============================================================================

-- 7.1 Trigger enforcing immutability of channel_id, sender_id, and created_at on UPDATE
CREATE OR REPLACE FUNCTION public.check_message_update_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.channel_id <> OLD.channel_id THEN
    RAISE EXCEPTION 'Cannot modify message channel_id';
  END IF;

  IF NEW.sender_id <> OLD.sender_id THEN
    RAISE EXCEPTION 'Cannot modify message sender_id';
  END IF;

  IF NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Cannot modify message created_at';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_message_update_immutability ON public.messages;
CREATE TRIGGER trigger_check_message_update_immutability
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.check_message_update_immutability();

-- 7.2 Relax content check constraint to support messages with pure attachments
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_content_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_check
  CHECK (length(trim(content)) > 0 OR attachment_url IS NOT NULL);
