-- Migration: Private Storage for chat-attachments
-- 
-- Makes the bucket private so object paths are not publicly guessable.
-- Signed URLs (generated client-side per-render) replace permanent public URLs.
--
-- Backward-compat note: existing attachment_url values that contain full https://
-- public URLs continue to be served directly from MessageItem.tsx (isStoragePath
-- returns false → url used as-is). Only new uploads store bare paths.

-- Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'chat-attachments';

-- Drop old permissive SELECT policy
DROP POLICY IF EXISTS "chat_attachments_select" ON storage.objects;

-- New SELECT policy: any authenticated user (private bucket + signed URLs = no anonymous access).
-- Full membership-scoped enforcement requires a backend API route (out-of-scope for client-only app).
-- The INSERT policy still enforces (storage.foldername(name))[1] = auth.uid()::text — unchanged.
DO $$ BEGIN
  CREATE POLICY "chat_attachments_select_auth"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'chat-attachments');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
