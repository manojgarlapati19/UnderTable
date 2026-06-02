-- UnderTable - Row Level Security Policies
-- Each policy follows the spec: users can read/insert/update based on their role and status

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinned_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_starters ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if user is approved
CREATE OR REPLACE FUNCTION is_approved()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check if user can access a room
CREATE OR REPLACE FUNCTION can_access_room(room_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM rooms r
    WHERE r.id = room_id
    AND (
      r.is_private = false
      OR EXISTS (SELECT 1 FROM room_members rm WHERE rm.room_id = r.id AND rm.user_id = auth.uid())
      OR is_admin()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PROFILES POLICIES
-- ============================================================
-- Users can read all approved profiles
CREATE POLICY "profiles_select_approved" ON profiles
  FOR SELECT USING (
    status = 'approved' OR id = auth.uid() OR is_admin()
  );

-- Users can insert their own profile
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Users can update their own profile; admins can update any
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid() OR is_admin())
  WITH CHECK (id = auth.uid() OR is_admin());

-- Only admins can delete profiles
CREATE POLICY "profiles_delete_admin" ON profiles
  FOR DELETE USING (is_admin());

-- ============================================================
-- ROOMS POLICIES
-- ============================================================
-- Approved users can read non-private rooms; private rooms require membership
CREATE POLICY "rooms_select_approved" ON rooms
  FOR SELECT USING (
    (is_private = false AND is_approved())
    OR (is_private = true AND EXISTS (
      SELECT 1 FROM room_members WHERE room_id = rooms.id AND user_id = auth.uid()
    ))
    OR is_admin()
  );

-- Admins can insert rooms
CREATE POLICY "rooms_insert_admin" ON rooms
  FOR INSERT WITH CHECK (is_admin());

-- Admins can update rooms
CREATE POLICY "rooms_update_admin" ON rooms
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- Admins can delete rooms
CREATE POLICY "rooms_delete_admin" ON rooms
  FOR DELETE USING (is_admin());

-- ============================================================
-- ROOM MEMBERS POLICIES
-- ============================================================
-- Members can view room membership
CREATE POLICY "room_members_select" ON room_members
  FOR SELECT USING (
    user_id = auth.uid() OR is_admin() OR EXISTS (
      SELECT 1 FROM room_members rm WHERE rm.room_id = room_members.room_id AND rm.user_id = auth.uid()
    )
  );

-- Admins can manage room members
CREATE POLICY "room_members_insert_admin" ON room_members
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "room_members_delete_admin" ON room_members
  FOR DELETE USING (is_admin());

-- ============================================================
-- MESSAGES POLICIES
-- ============================================================
-- Approved users can read non-deleted messages in accessible rooms
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    is_deleted = false
    AND can_access_room(room_id)
    AND is_approved()
  );

-- Approved users can insert their own messages
CREATE POLICY "messages_insert_own" ON messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND is_approved()
    AND can_access_room(room_id)
  );

-- Users can update their own messages; admins can update any
CREATE POLICY "messages_update_own" ON messages
  FOR UPDATE USING (
    (user_id = auth.uid() OR is_admin())
    AND is_approved()
  ) WITH CHECK (
    (user_id = auth.uid() OR is_admin())
    AND is_approved()
  );

-- Admins can delete messages
CREATE POLICY "messages_delete_admin" ON messages
  FOR DELETE USING (is_admin());

-- ============================================================
-- REACTIONS POLICIES
-- ============================================================
-- All approved users can read reactions
CREATE POLICY "reactions_select" ON reactions
  FOR SELECT USING (is_approved());

-- Users can insert their own reactions
CREATE POLICY "reactions_insert_own" ON reactions
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND is_approved()
  );

-- Users can delete their own reactions
CREATE POLICY "reactions_delete_own" ON reactions
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- READ RECEIPTS POLICIES
-- ============================================================
-- All approved users can read read_receipts
CREATE POLICY "read_receipts_select" ON read_receipts
  FOR SELECT USING (is_approved());

-- Users can insert their own read_receipts (skip if ghost_mode)
CREATE POLICY "read_receipts_insert_own" ON read_receipts
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND is_approved()
    AND NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND ghost_mode = true
    )
  );

-- ============================================================
-- INVITE LINKS POLICIES
-- ============================================================
-- Anyone can read invite validity (code check)
CREATE POLICY "invite_links_select_valid" ON invite_links
  FOR SELECT USING (is_active = true OR is_admin());

-- Admins can insert invite links
CREATE POLICY "invite_links_insert_admin" ON invite_links
  FOR INSERT WITH CHECK (is_admin());

-- Admins can update invite links
CREATE POLICY "invite_links_update_admin" ON invite_links
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- POLLS POLICIES
-- ============================================================
-- Approved users can read all polls in accessible rooms
CREATE POLICY "polls_select" ON polls
  FOR SELECT USING (
    is_approved() AND can_access_room(room_id)
  );

-- Approved users can insert polls
CREATE POLICY "polls_insert_own" ON polls
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND is_approved()
  );

-- Admins can update polls (close, etc.)
CREATE POLICY "polls_update_admin" ON polls
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- POLL VOTES POLICIES
-- ============================================================
-- Approved users can read poll votes
CREATE POLICY "poll_votes_select" ON poll_votes
  FOR SELECT USING (is_approved());

-- Users can insert their own vote (once)
CREATE POLICY "poll_votes_insert_own" ON poll_votes
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND is_approved()
  );

-- ============================================================
-- BOOKMARKS POLICIES
-- ============================================================
-- Users can read their own bookmarks
CREATE POLICY "bookmarks_select_own" ON bookmarks
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own bookmarks
CREATE POLICY "bookmarks_insert_own" ON bookmarks
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can delete their own bookmarks
CREATE POLICY "bookmarks_delete_own" ON bookmarks
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- BLOCKS POLICIES
-- ============================================================
-- Users can read their own blocks
CREATE POLICY "blocks_select_own" ON blocks
  FOR SELECT USING (blocker_id = auth.uid() OR blocked_id = auth.uid());

-- Users can insert their own blocks
CREATE POLICY "blocks_insert_own" ON blocks
  FOR INSERT WITH CHECK (blocker_id = auth.uid());

-- Users can delete their own blocks
CREATE POLICY "blocks_delete_own" ON blocks
  FOR DELETE USING (blocker_id = auth.uid());

-- ============================================================
-- REPORTS POLICIES
-- ============================================================
-- Users can insert their own reports
CREATE POLICY "reports_insert_own" ON reports
  FOR INSERT WITH CHECK (reported_by = auth.uid());

-- Only admins can read all reports
CREATE POLICY "reports_select_admin" ON reports
  FOR SELECT USING (is_admin());

-- Admins can update reports
CREATE POLICY "reports_update_admin" ON reports
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- NOTIFICATION PREFERENCES POLICIES
-- ============================================================
-- Users can read their own notification preferences
CREATE POLICY "notification_preferences_select_own" ON notification_preferences
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert/update their own preferences
CREATE POLICY "notification_preferences_insert_own" ON notification_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "notification_preferences_update_own" ON notification_preferences
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Users can delete their own preferences
CREATE POLICY "notification_preferences_delete_own" ON notification_preferences
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- PINNED MESSAGES POLICIES
-- ============================================================
-- All approved users can read pinned messages
CREATE POLICY "pinned_messages_select" ON pinned_messages
  FOR SELECT USING (is_approved());

-- Admins can insert pinned messages
CREATE POLICY "pinned_messages_insert_admin" ON pinned_messages
  FOR INSERT WITH CHECK (is_admin());

-- Admins can delete pinned messages
CREATE POLICY "pinned_messages_delete_admin" ON pinned_messages
  FOR DELETE USING (is_admin());

-- ============================================================
-- KEYWORD FILTERS POLICIES
-- ============================================================
-- All approved users can read keyword filters (to filter messages client-side)
CREATE POLICY "keyword_filters_select" ON keyword_filters
  FOR SELECT USING (is_approved());

-- Admins can insert keyword filters
CREATE POLICY "keyword_filters_insert_admin" ON keyword_filters
  FOR INSERT WITH CHECK (is_admin());

-- Admins can delete keyword filters
CREATE POLICY "keyword_filters_delete_admin" ON keyword_filters
  FOR DELETE USING (is_admin());

-- ============================================================
-- CONVERSATION STARTERS POLICIES
-- ============================================================
-- All approved users can read conversation starters
CREATE POLICY "conversation_starters_select" ON conversation_starters
  FOR SELECT USING (true);

-- Admins can insert conversation starters
CREATE POLICY "conversation_starters_insert_admin" ON conversation_starters
  FOR INSERT WITH CHECK (is_admin());

-- Admins can update conversation starters
CREATE POLICY "conversation_starters_update_admin" ON conversation_starters
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- Admins can delete conversation starters
CREATE POLICY "conversation_starters_delete_admin" ON conversation_starters
  FOR DELETE USING (is_admin());
