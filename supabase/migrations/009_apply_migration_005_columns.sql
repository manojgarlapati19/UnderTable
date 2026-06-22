-- ============================================================================
-- Migration 009: Add columns introduced by migration 005 (idempotent)
--
-- Why this exists separately from 005:
--   The production Supabase project was deployed with only migrations
--   001-004 + 006 + 007 + 008 applied. Migration 005 (which adds the
--   columns `is_active`, `has_password`, `room_password`, and
--   `message_ttl_seconds`) was never run, causing every rooms list to
--   throw `column rooms.has_password does not exist` (Postgres 42703).
--
--   Rather than re-running 005 (which would also re-create the
--   `claim_invite_code` function and re-introduce constraints), we ship
--   009 with ONLY the idempotent column adds + the trigger that keeps
--   `has_password` in sync with `room_password`.
--
--   This file is safe to re-run.
-- ============================================================================

-- Add the missing columns from migration 005. IF NOT EXISTS makes this
-- idempotent — running on a database that already has the columns is a
-- no-op.
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS room_password TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS has_password BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS message_ttl_seconds INT DEFAULT NULL;

-- Sync trigger: keep has_password in lock-step with room_password. Same
-- function as 005; created here independently so this migration is
-- self-contained.
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

-- Backfill any existing rows so has_password matches room_password state.
UPDATE rooms SET has_password = (room_password IS NOT NULL AND room_password != '');
