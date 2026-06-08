-- ============================================================================
-- Migration 005: Fix missing schema columns, status values, and RLS
-- Addresses audit findings:
--   profiles: missing theme, notifications_enabled, is_admin (uses role column)
--   rooms: missing room_password, has_password, is_active
--   profiles status: missing 'rejected' value
--   Keyword filter: need server-side enforcement (DB trigger)
--   Message edit window: need RLS enforcement (10-min limit)
--   Invite link atomic claim: need claim_invite_code() function
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Add missing columns to rooms
-- --------------------------------------------------------------------------
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS room_password TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS has_password BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS message_ttl_seconds INT DEFAULT NULL;

-- Auto-update has_password when room_password changes
CREATE OR REPLACE FUNCTION sync_room_has_password()
RETURNS TRIGGER AS $$
BEGIN
  NEW.has_password := (NEW.room_password IS NOT NULL AND NEW.room_password != '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rooms_sync_has_password ON rooms;
CREATE TRIGGER trg_rooms_sync_has_password
  BEFORE INSERT OR UPDATE OF room_password ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION sync_room_has_password();

-- Sync existing rows
UPDATE rooms SET has_password = (room_password IS NOT NULL AND room_password != '');

-- --------------------------------------------------------------------------
-- 2. Add missing columns to profiles
-- --------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true;

-- Add is_admin as a virtual column based on role, or add it directly
-- Since the existing schema uses 'role' with 'admin'/'user', add is_admin for convenience
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN GENERATED ALWAYS AS (role = 'admin') STORED;

-- --------------------------------------------------------------------------
-- 3. Add 'rejected' to profile status constraint
-- NOTE: The original 001 migration uses a CHECK constraint, not an ENUM.
-- We need to DROP and recreate the constraint.
-- --------------------------------------------------------------------------
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'banned'));

-- --------------------------------------------------------------------------
-- 4. Add missing columns to reports (resolved_by, resolution)
-- --------------------------------------------------------------------------
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS resolution TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ DEFAULT NULL;

-- --------------------------------------------------------------------------
-- 5. RLS for bookmarks (table already exists from 001, but may lack RLS)
-- ---------------------------------------------------------------------------
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookmarks_select_own" ON bookmarks;
DROP POLICY IF EXISTS "bookmarks_insert_own" ON bookmarks;
DROP POLICY IF EXISTS "bookmarks_delete_own" ON bookmarks;

CREATE POLICY "bookmarks_select_own"
  ON bookmarks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "bookmarks_insert_own"
  ON bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookmarks_delete_own"
  ON bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- 6. RLS for blocks (table already exists from 001 as 'blocks')
-- ---------------------------------------------------------------------------
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocks_select_own" ON blocks;
DROP POLICY IF EXISTS "blocks_insert_own" ON blocks;
DROP POLICY IF EXISTS "blocks_delete_own" ON blocks;

CREATE POLICY "blocks_select_own"
  ON blocks FOR SELECT
  USING (auth.uid() = blocker_id);

CREATE POLICY "blocks_insert_own"
  ON blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "blocks_delete_own"
  ON blocks FOR DELETE
  USING (auth.uid() = blocker_id);

-- --------------------------------------------------------------------------
-- 7. RLS for notification_preferences
-- ---------------------------------------------------------------------------
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_preferences_select_own" ON notification_preferences;
DROP POLICY IF EXISTS "notification_preferences_insert_own" ON notification_preferences;
DROP POLICY IF EXISTS "notification_preferences_update_own" ON notification_preferences;
DROP POLICY IF EXISTS "notification_preferences_delete_own" ON notification_preferences;

CREATE POLICY "notification_preferences_select_own"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notification_preferences_insert_own"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notification_preferences_update_own"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "notification_preferences_delete_own"
  ON notification_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- 8. Atomic invite claim function
-- Validates, claims, and increments uses_count in a single atomic operation.
-- Called via service role key from the invite-signup Edge Function.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_invite_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite invite_links%ROWTYPE;
  v_remaining INT;
BEGIN
  -- Lock the row to prevent concurrent claims
  SELECT * INTO v_invite
  FROM invite_links
  WHERE code = p_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid invite code');
  END IF;

  IF NOT v_invite.is_active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invite link has been revoked');
  END IF;

  IF v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invite link has reached its maximum uses');
  END IF;

  -- Atomic increment
  UPDATE invite_links
  SET uses_count = uses_count + 1
  WHERE id = v_invite.id;

  v_remaining := CASE
    WHEN v_invite.max_uses IS NULL THEN -1
    ELSE GREATEST(0, v_invite.max_uses - v_invite.uses_count - 1)
  END;

  RETURN jsonb_build_object(
    'valid', true,
    'uses_left', v_remaining
  );
END;
$$;

-- --------------------------------------------------------------------------
-- 9. Server-side keyword filter trigger
-- Automatically flags messages containing filtered keywords
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_message_keywords()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM keyword_filters
    WHERE NEW.content ILIKE '%' || word || '%'
  ) THEN
    NEW.is_flagged := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_messages_check_keywords ON messages;
CREATE TRIGGER trg_messages_check_keywords
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION check_message_keywords();

-- --------------------------------------------------------------------------
-- 10. Enforce 10-minute edit window via RLS
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_within_edit_window(message_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  msg_created_at TIMESTAMPTZ;
BEGIN
  SELECT created_at INTO msg_created_at FROM messages WHERE id = message_id;
  RETURN EXTRACT(EPOCH FROM (now() - msg_created_at)) < 600; -- 10 minutes in seconds
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old policy and recreate with time check
DROP POLICY IF EXISTS "messages_update_own_only" ON messages;

CREATE POLICY "messages_update_own_only"
  ON messages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND is_within_edit_window(id)
  );

-- Admin can edit any message without time limit
CREATE POLICY "messages_update_admin"
  ON messages FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
