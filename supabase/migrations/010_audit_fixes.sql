-- ============================================================================
-- Migration 010: Consolidated audit fixes
--
-- Run this once in the Supabase SQL editor (or via `supabase db push`).
-- Every statement is idempotent (IF EXISTS / IF NOT EXISTS / CREATE OR REPLACE)
-- so it is safe to re-run.
--
-- NOTE: this file does NOT assume migrations 001-009 were fully applied.
-- Running it against a fresh/partial database surfaced
-- `relation "verified_room_access" does not exist`, meaning at least
-- migration 007 (and possibly 005) had never actually run here. Section 0
-- below defensively re-creates every prerequisite object (rooms password
-- columns, is_admin()/is_approved(), the verified_room_access table,
-- 'rejected' status, claim_invite_code(), the 10-min edit window) so this
-- single file is a true standalone baseline regardless of migration history.
--
-- Fixes, grouped by table:
--   verified_room_access : RLS was never enabled -> password gate bypassable
--   can_access_room()    : parameter shadowed column name -> ambiguous/tautological
--   room_members         : self-referential SELECT policy -> 42P17 recursion
--   messages_update_admin: checked role only, not approval status (consistency)
--   invite_links         : confirm anon/authenticated validation policy (kept,
--                          documented) + add updated_at for audit trail
--   pinned_messages       : add UPDATE policy is not needed (delete already
--                          exists for unpin), just documenting it's usable
--   profiles / rooms      : confirm admin-write policies (no change needed,
--                          included as explicit re-asserts so this file is a
--                          complete standalone fix script)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Defensive re-application of prerequisite schema. This migration was
--    written assuming 001-009 had already run, but on at least one target
--    database migrations 005/007 were never actually applied (confirmed by
--    `relation "verified_room_access" does not exist` when this file was
--    first run). Recreate every object this script depends on, guarded by
--    IF NOT EXISTS, so this file is truly standalone regardless of which
--    of 001-009 have or haven't been applied.
-- ---------------------------------------------------------------------------

-- From migration 005: rooms columns used by can_access_room() below.
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS room_password TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS has_password BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS message_ttl_seconds INT DEFAULT NULL;

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

UPDATE rooms SET has_password = (room_password IS NOT NULL AND room_password != '')
  WHERE has_password IS DISTINCT FROM (room_password IS NOT NULL AND room_password != '');

-- From migration 002: helper functions every policy below calls. Re-applying
-- is a no-op if they already exist correctly (CREATE OR REPLACE), and a
-- real fix if this database somehow never got migration 002 either.
CREATE OR REPLACE FUNCTION is_approved()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- From migration 007: the table can_access_room()'s password-gate check
-- reads from. This was the object actually missing on the target database.
CREATE TABLE IF NOT EXISTS verified_room_access (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  verified_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, room_id)
);

-- From migration 005: 'rejected' status (admin/members reject action relies
-- on this being a legal value) and the atomic invite-claim function
-- (release_invite_code below assumes invite_links has uses_count/max_uses,
-- which are from 001, but claim_invite_code itself is what invite-signup
-- calls at signup time -- reapply defensively in case 005 never landed).
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'banned'));

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

  UPDATE invite_links
  SET uses_count = uses_count + 1
  WHERE id = v_invite.id;

  v_remaining := CASE
    WHEN v_invite.max_uses IS NULL THEN -1
    ELSE GREATEST(0, v_invite.max_uses - v_invite.uses_count - 1)
  END;

  RETURN jsonb_build_object('valid', true, 'uses_left', v_remaining);
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. verified_room_access: RLS was never enabled in migration 007, which
--    means (depending on default Supabase grants) any authenticated client
--    could INSERT their own (user_id, room_id) row directly and grant
--    themselves access to a password-protected room without ever calling
--    verify-room-password. Enable RLS with NO policies at all so only the
--    service-role key (used by the edge function) can read/write it.
-- ---------------------------------------------------------------------------
ALTER TABLE verified_room_access ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: default-deny for anon/authenticated roles.
-- The verify-room-password edge function uses the service-role client,
-- which bypasses RLS entirely, so it is unaffected by this change.

-- ---------------------------------------------------------------------------
-- 2. Fix can_access_room(): the parameter was named `room_id`, identical to
--    the `room_members.room_id` / `verified_room_access.room_id` columns
--    queried inside it. Every reference inside the function body resolved
--    to the parameter itself (self-comparison), making the membership and
--    verified-access checks tautological (or, depending on
--    plpgsql.variable_conflict, a hard "ambiguous column" runtime error).
--    Renamed to p_room_id and fully qualified all column references.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION can_access_room(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_private BOOLEAN;
  v_has_password BOOLEAN;
BEGIN
  SELECT rooms.is_private, rooms.has_password
    INTO v_is_private, v_has_password
    FROM rooms WHERE rooms.id = p_room_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Public, non-password room -> any approved user.
  IF v_is_private = false AND v_has_password = false THEN
    RETURN is_approved();
  END IF;

  -- Private or password-protected -> must be a member OR admin.
  IF EXISTS (
       SELECT 1 FROM room_members
       WHERE room_members.room_id = p_room_id
         AND room_members.user_id = auth.uid()
     )
     OR is_admin() THEN
    -- If additionally password-protected, require a verified-access row.
    IF v_has_password THEN
      RETURN EXISTS (
        SELECT 1 FROM verified_room_access
        WHERE verified_room_access.user_id = auth.uid()
          AND verified_room_access.room_id = p_room_id
      );
    END IF;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Fix room_members_select recursion (error 42P17). The original policy's
--    USING clause subquerried room_members from within a policy defined on
--    room_members itself. Move the "is this user a member of the same room
--    as some other row" check into a SECURITY DEFINER helper function,
--    which bypasses RLS for its internal query and breaks the recursion.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_member_of_room(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM room_members
    WHERE room_members.room_id = p_room_id
      AND room_members.user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "room_members_select" ON room_members;
CREATE POLICY "room_members_select" ON room_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_admin()
    OR is_member_of_room(room_members.room_id)
  );

-- From migration 005/007: the 10-minute edit window. If 005 never landed on
-- this database, the only UPDATE policy on messages was 002's permissive
-- "owner or admin, no time limit" -- reapply the time-limited version and
-- drop the permissive one, same as 007 did.
CREATE OR REPLACE FUNCTION is_within_edit_window(message_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  msg_created_at TIMESTAMPTZ;
BEGIN
  SELECT created_at INTO msg_created_at FROM messages WHERE id = message_id;
  RETURN EXTRACT(EPOCH FROM (now() - msg_created_at)) < 600;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "messages_update_own" ON messages;
DROP POLICY IF EXISTS "messages_update_own_only" ON messages;
CREATE POLICY "messages_update_own_only"
  ON messages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND is_within_edit_window(id));

-- ---------------------------------------------------------------------------
-- 4. messages_update_admin (005) checked `role = 'admin'` without also
--    requiring `status = 'approved'`, inconsistent with the is_admin()
--    helper used by every other admin-gated policy in the schema (an admin
--    account that got banned/rejected could still edit any message). Drop
--    and recreate using is_admin() for consistency.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "messages_update_admin" ON messages;
CREATE POLICY "messages_update_admin"
  ON messages FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- ---------------------------------------------------------------------------
-- 5. invite_links: add updated_at so revoke actions leave an audit trail
--    (admin/invites/page.tsx revokeLink() just sets is_active=false today
--    with no timestamp of when that happened).
-- ---------------------------------------------------------------------------
ALTER TABLE invite_links
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invite_links_updated_at ON invite_links;
CREATE TRIGGER trg_invite_links_updated_at
  BEFORE UPDATE ON invite_links
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 5b. Invite quota rollback. signup/page.tsx calls the `invite-signup` edge
--    function (which atomically increments uses_count via claim_invite_code)
--    BEFORE attempting auth.signUp()/profiles.insert(). If either of those
--    later steps fails (duplicate email, weak password rejected by Supabase
--    Auth, a dropped connection, etc.) the invite's uses_count had already
--    been permanently incremented with no compensating decrement -- a
--    max_uses: 1 invite could be burned by a failed attempt. Add a
--    SECURITY DEFINER function the client can call to release a claim it
--    just took, and grant EXECUTE to anon/authenticated (signup happens
--    before the user has a session).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION release_invite_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite invite_links%ROWTYPE;
BEGIN
  SELECT * INTO v_invite FROM invite_links WHERE code = p_code FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('released', false, 'error', 'Invalid invite code');
  END IF;

  UPDATE invite_links
  SET uses_count = GREATEST(0, uses_count - 1)
  WHERE id = v_invite.id;

  RETURN jsonb_build_object('released', true);
END;
$$;

GRANT EXECUTE ON FUNCTION release_invite_code(TEXT) TO anon, authenticated;

-- The existing "invite_links_select_valid" policy (is_active = true OR
-- is_admin()) is intentionally left in place: the checklist explicitly
-- requires unauthenticated/just-signed-up visitors to be able to validate
-- an invite code via a direct table read from /invite/[code]. Note this
-- does expose all *active* invite codes/use-counts to any reader who
-- queries the table without a .eq('code', ...) filter, not just the one
-- they're checking -- acceptable for this app's threat model (codes are
-- meant to be shared), but if you want to lock this down further, move
-- invite validation entirely behind the `invite-signup` edge function /
-- `claim_invite_code` RPC (which already run as service-role) and drop
-- this SELECT policy down to `is_admin()` only.

-- ---------------------------------------------------------------------------
-- 6. Re-assert profiles/rooms admin-write policies so this file is a
--    complete, standalone fix script (no functional change; these already
--    exist correctly from migration 002, included defensively).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid() OR is_admin())
  WITH CHECK (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "rooms_insert_admin" ON rooms;
CREATE POLICY "rooms_insert_admin" ON rooms
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "rooms_update_admin" ON rooms;
CREATE POLICY "rooms_update_admin" ON rooms
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "rooms_delete_admin" ON rooms;
CREATE POLICY "rooms_delete_admin" ON rooms
  FOR DELETE USING (is_admin());

-- ---------------------------------------------------------------------------
-- 7. Realtime: confirm publication includes every table the client
--    subscribes to (messages, reactions, read_receipts, polls, poll_votes,
--    pinned_messages already added in 003; poll_votes' partner poll_votes
--    changes and pinned_messages changes both need to be live for
--    usePolls.ts / PinnedMessagesBar.tsx to update without a refetch).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'poll_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE poll_votes;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'pinned_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pinned_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'polls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE polls;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'read_receipts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE read_receipts;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  END IF;
END $$;

-- ============================================================================
-- End of migration 010.
-- ============================================================================
