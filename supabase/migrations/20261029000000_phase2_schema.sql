-- ==============================================================================
-- Supabase PostgreSQL Migration: Phase 2 Chat MVP Schema Additions
-- Target: supabase/migrations/20261029000000_phase2_schema.sql
-- ==============================================================================

-- 1. CHANNELS: Add is_dm column for Direct Messaging
ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS is_dm BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_channels_is_dm
  ON public.channels (is_dm);

-- 2. MESSAGES: Add edited flag and attachment metadata
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT,
  ADD COLUMN IF NOT EXISTS attachment_size INTEGER;

-- 3. CHANNEL MEMBERS: Add last_read_at for Unread Tracking
ALTER TABLE public.channel_members
  ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

-- 4. STORAGE: Chat Attachments Bucket Setup & Policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  true,
  10485760, -- 10MB limit
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 10485760;

-- Storage RLS Policies
DO $$ BEGIN
  CREATE POLICY "chat_attachments_select"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'chat-attachments');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "chat_attachments_insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'chat-attachments'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "chat_attachments_delete_own"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'chat-attachments'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 5. HELPER FUNCTION: Get or Create Deterministic 1-1 Direct Message
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

  -- Deterministic canonical ID sorted by UUID strings
  IF v_caller_id::text < target_user_id::text THEN
    v_dm_channel_id := 'dm-' || v_caller_id::text || '-' || target_user_id::text;
  ELSE
    v_dm_channel_id := 'dm-' || target_user_id::text || '-' || v_caller_id::text;
  END IF;

  -- Check if channel already exists
  IF NOT EXISTS (SELECT 1 FROM public.channels WHERE id = v_dm_channel_id) THEN
    -- Get target user display name
    SELECT name INTO v_target_name FROM public.profiles WHERE id = target_user_id;
    SELECT name INTO v_caller_name FROM public.profiles WHERE id = v_caller_id;

    -- Create DM channel
    INSERT INTO public.channels (id, name, description, icon_name, owner_id, is_dm)
    VALUES (
      v_dm_channel_id,
      COALESCE(v_target_name, 'Direct Message'),
      'Direct conversation between members',
      'MessageSquare',
      v_caller_id,
      true
    )
    ON CONFLICT (id) DO NOTHING;

    -- Enrol both participants as members
    INSERT INTO public.channel_members (channel_id, user_id, role)
    VALUES
      (v_dm_channel_id, v_caller_id, 'member'::public.channel_member_role),
      (v_dm_channel_id, target_user_id, 'member'::public.channel_member_role)
    ON CONFLICT (channel_id, user_id) DO NOTHING;
  END IF;

  RETURN v_dm_channel_id;
END;
$$;
