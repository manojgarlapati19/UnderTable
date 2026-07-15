-- ============================================================================
-- Migration 010: Consolidated audit fixes
--
-- Run this once in the Supabase SQL editor (or via `supabase db push`).
-- Every statement is idempotent (IF EXISTS / IF NOT EXISTS / CREATE OR REPLACE)
-- so it is safe to re-run.
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
END $$;

-- ============================================================================
-- End of migration 010.
-- ============================================================================
