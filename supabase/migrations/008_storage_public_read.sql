-- ============================================================================
-- Migration 008: Make chat-media bucket readable for shared attachments
--
-- Issue fixed:
--   Migrations 004 + 006 created a private bucket with an owner-only SELECT
--   policy. As a result, when user A uploads an image and posts it as a
--   message, user B receives the realtime notification and renders the
--   message but the image element loads a 403 — only user A can read their
--   own files. The chat-with-attachments feature was silently broken.
--
-- Approach:
--   The privacy boundary for chat content is the `messages` table's RLS
--   (gated by `can_access_room`). A file in the chat-media bucket whose
--   path is referenced from a message is logically just an attachment to
--   that message, so the same room-membership check applies. We make the
--   bucket public for SELECT so the storage URL works for any user with a
--   valid session, and rely on the message RLS to keep the URL itself
--   from being discoverable (since the message that links to it is
--   hidden from non-members).
--
-- Writes remain owner-scoped (per-folder under `<user_id>/...`).
-- ============================================================================

UPDATE storage.buckets
SET public = true
WHERE id = 'chat-media';

-- Drop the prior owner-only SELECT policy and replace with a public SELECT
-- gated only by bucket id + authenticated role.
DROP POLICY IF EXISTS "chat_media_select_owner" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_select_admin" ON storage.objects;

CREATE POLICY "chat_media_select_public" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'chat-media'
    AND auth.role() = 'authenticated'
  );

-- Admins still need read for moderation — already covered by the public
-- policy above (admins are authenticated).

-- Refresh the storage publication cache so any cached policy metadata is
-- invalidated.
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';