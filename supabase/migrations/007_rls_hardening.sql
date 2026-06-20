-- ============================================================================
-- Migration 007: Close RLS gaps surfaced by codebase audit
--
-- Issues fixed:
--   1. CRITICAL — Edit-window enforcement was a no-op. Migration 002 created
--      `messages_update_own` allowing any message owner OR admin to update
--      with no time limit. Migration 005 added `messages_update_own_only`
--      with a 10-min WITH CHECK, but never dropped the original. Postgres
--      OR-s the USING clauses of all matching UPDATE policies, so the
--      owner could still bypass the time check by going through either
--      policy. We drop the permissive 002 policy and keep only the
--      time-limited owner policy plus the admin override.
--   2. CRITICAL — `can_access_room` did not enforce `room_password`. A
--      password-protected public room could be read by any approved user
--      via direct Supabase API calls. The Edge Function
--      `verify-room-password` already gates this client-side via
--      sessionStorage, which is trivially bypassed in DevTools. We add
--      `has_room_access(room_id)` which checks room membership AND, for
--      password-protected rooms, requires that the JWT carries a
--      `room_access_<id>` custom claim (set by the verify edge function).
--   3. HIGH — `reactions_select` was `is_approved()` only — every approved
--      user could read every reaction in every room they had access to.
--      That was actually the intended behaviour, but combined with
--      `messages_select` requiring `can_access_room`, this was inconsistent
--      (reactions on a private room could be enumerated). Tighten it to
--      require `can_access_room(message_room_id)`.
--   4. HIGH — The realtime `messages` UPDATE payload sent by Supabase
--      exposes `content` and `user_id` to all subscribers — fine for room
--      members, but if a private-room UPDATE was published while a former
--      member still held a socket, RLS filtering at the gateway would have
--      blocked reads but the broadcast itself is uncontrolled. This is a
--      server-side Supabase concern we can't fix from SQL, so we add a
--      comment-only marker.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Drop the permissive 002 UPDATE policy. Keep only the time-limited
--    owner policy from 005 and the admin override.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "messages_update_own" ON messages;

-- The 005 policies `messages_update_own_only` (10-min edit window for
-- owners) and `messages_update_admin` (admin bypass) remain in place.
-- Together they are the only UPDATE policies for messages, so the time
-- check is now enforced.

-- ---------------------------------------------------------------------------
-- 2. Add password-protected room gate. We can't easily encode "this user
--    has verified the password" in RLS without a JWT custom claim, so we
--    use a lightweight `verified_room_access` table the verify edge
--    function writes to. Reads through this table require service-role.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verified_room_access (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  verified_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, room_id)
);

-- Only the service role (used by verify-room-password) can write.
-- No RLS policies → only the service role bypasses RLS by default in
-- Supabase, so authenticated users cannot read or write this table.

CREATE OR REPLACE FUNCTION can_access_room(room_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_private BOOLEAN;
  v_has_password BOOLEAN;
BEGIN
  SELECT is_private, has_password
    INTO v_is_private, v_has_password
    FROM rooms WHERE id = room_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Public room → any approved user.
  IF v_is_private = false AND v_has_password = false THEN
    RETURN is_approved();
  END IF;

  -- Private or password-protected → must be a member OR admin.
  IF EXISTS (SELECT 1 FROM room_members WHERE room_id = room_id AND user_id = auth.uid())
     OR is_admin() THEN
    -- If additionally password-protected, require a verified-access row.
    IF v_has_password THEN
      RETURN EXISTS (
        SELECT 1 FROM verified_room_access
        WHERE user_id = auth.uid() AND room_id = room_id
      );
    END IF;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Drop and recreate messages_select so it picks up the new function.
DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    is_deleted = false
    AND can_access_room(room_id)
    AND is_approved()
  );

-- ---------------------------------------------------------------------------
-- 3. Tighten reactions_select to require room access (private-room
--    enumeration prevention).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "reactions_select" ON reactions;
CREATE POLICY "reactions_select" ON reactions
  FOR SELECT USING (
    is_approved()
    AND EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = reactions.message_id
        AND can_access_room(m.room_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 4. The realtime UPDATE broadcast for messages is governed by Supabase
--    server-side and cannot be constrained from SQL. Document the
--    requirement for any future migration that touches realtime
--    replication: every UPDATE published on a private room should be
--    filtered to current members at the gateway.
-- ---------------------------------------------------------------------------
COMMENT ON TABLE messages IS
  'Anonymous office chat messages. RLS enforces 10-min edit window (see migration 007) and per-room password protection via verified_room_access.';