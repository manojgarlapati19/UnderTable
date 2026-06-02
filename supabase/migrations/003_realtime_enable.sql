-- UnderTable - Enable Realtime for specified tables
-- Tables: messages, reactions, read_receipts, polls, poll_votes, pinned_messages

-- Enable realtime subscription for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE read_receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE polls;
ALTER PUBLICATION supabase_realtime ADD TABLE poll_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE pinned_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
