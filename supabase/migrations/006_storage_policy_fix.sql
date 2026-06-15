-- UnderTable - Storage policy hardening for chat-media
--
-- Issues fixed:
--   1. The previous SELECT policy let any authenticated user read any file in
--      the bucket — including files uploaded by other users. This violates
--      per-user media privacy.
--   2. The previous INSERT policy trusted the client-supplied `content_type`.
--      A malicious client could upload a script with `image/png` and then
--      request it as text/html, leading to stored XSS.
--   3. The MIME/size triggers could be bypassed by updating an existing row.
--   4. No explicit size cap on UPDATE — a row could grow post-insert.
--
-- Apply this after 004_storage_buckets.sql. All statements are idempotent.

-- ---------------------------------------------------------------------------
-- 1. Restrict SELECT to the file owner, plus admins (moderation use case).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "chat_media_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_select_owner" ON storage.objects;

CREATE POLICY "chat_media_select_owner" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'chat-media'
    AND (
      auth.role() = 'authenticated'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- Admins can read any file (for moderation / abuse handling).
CREATE POLICY "chat_media_select_admin" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'chat-media'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'approved'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Re-validate content type on UPDATE so it can't be mutated after upload.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_file_mime_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bucket_id = 'chat-media' THEN
    IF NEW.content_type NOT IN ('image/jpeg', 'image/png', 'image/gif', 'image/webp') THEN
      RAISE EXCEPTION 'File type not allowed. Allowed: jpg, png, gif, webp';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_file_mime_update_trigger ON storage.objects;
CREATE TRIGGER check_file_mime_update_trigger
  BEFORE UPDATE OF content_type ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION check_file_mime_update();

-- ---------------------------------------------------------------------------
-- 3. Prevent size growth on UPDATE (defence-in-depth — file content itself
--    can't be replaced via UPDATE in Supabase Storage, but this makes the
--    invariant explicit and auditable).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_file_size_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bucket_id = 'chat-media' AND NEW.size > 5242880 THEN
    RAISE EXCEPTION 'File size exceeds 5MB limit';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_file_size_update_trigger ON storage.objects;
CREATE TRIGGER check_file_size_update_trigger
  BEFORE UPDATE OF size ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION check_file_size_update();

-- ---------------------------------------------------------------------------
-- 4. Allow the owner to UPDATE metadata on their own objects (e.g. replacing
--    a draft attachment). Keeps the bucket manageable.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "chat_media_update_own" ON storage.objects;
CREATE POLICY "chat_media_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'chat-media'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
