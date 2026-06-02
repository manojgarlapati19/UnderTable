-- UnderTable - Storage Bucket Policies for chat-media

-- Allow authenticated users to upload files to chat-media bucket
CREATE POLICY "chat_media_insert_authenticated" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-media'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to read files from chat-media bucket
CREATE POLICY "chat_media_select_authenticated" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'chat-media'
    AND auth.role() = 'authenticated'
  );

-- Allow users to delete their own uploads
CREATE POLICY "chat_media_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'chat-media'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow admins to delete any file
CREATE POLICY "chat_media_delete_admin" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'chat-media'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND status = 'approved')
  );

-- Maximum file size check (5MB) via a function
CREATE OR REPLACE FUNCTION check_file_size()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bucket_id = 'chat-media' AND NEW.size > 5242880 THEN
    RAISE EXCEPTION 'File size exceeds 5MB limit';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_file_size_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION check_file_size();

-- Allowed MIME types for chat-media
CREATE OR REPLACE FUNCTION check_file_mime()
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

CREATE TRIGGER check_file_mime_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION check_file_mime();
