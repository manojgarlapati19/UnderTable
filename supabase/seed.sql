-- UnderTable - Seed Data
-- Run this after migrations to populate default data

-- ============================================================
-- DEFAULT ROOMS
-- ============================================================
-- Note: created_by is set to null initially; admin can reassign
INSERT INTO rooms (name, description, icon_emoji, accent_color, is_confession_box) VALUES
  ('#general', 'General office chat', '💬', '#7C3AED', false),
  ('#hot-takes', 'Hot takes and controversial opinions', '🔥', '#EF4444', false),
  ('#ideas', 'Share your ideas and suggestions', '💡', '#F59E0B', false),
  ('#random', 'Random conversations', '🎲', '#10B981', false),
  ('#highlights', 'Weekly highlights and announcements', '⭐', '#3B82F6', false),
  ('#confession-box', 'Anonymous confessions — messages auto-delete', '🙊', '#8B5CF6', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- CONVERSATION STARTERS (20 default questions)
-- ============================================================
INSERT INTO conversation_starters (question) VALUES
  ('What is the best productivity hack you have discovered recently?'),
  ('If you could have lunch with any historical figure, who would it be?'),
  ('What is a movie or book that changed your perspective on something?'),
  ('What is the most underrated skill in the workplace?'),
  ('If you could instantly master any skill, what would it be?'),
  ('What is the best piece of advice you have ever received?'),
  ('What is something you believed as a child that turned out to be false?'),
  ('If you could visit any place in the world right now, where would you go?'),
  ('What is a small change that made a big difference in your daily routine?'),
  ('What is the most interesting thing you have learned this week?'),
  ('If you could have a superpower that only helps at work, what would it be?'),
  ('What is the best team-building activity you have ever done?'),
  ('What is a food you disliked as a kid but love now?'),
  ('What is your go-to karaoke song?'),
  ('If you could switch jobs with anyone in the company for a day, who would it be?'),
  ('What is the most memorable compliment you have ever received?'),
  ('What is a hobby you have always wanted to try?'),
  ('If you could add one new holiday to the calendar, what would it be?'),
  ('What is the funniest thing that happened to you at work?'),
  ('What is something you wish you knew when you started your career?')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SAMPLE KEYWORD FILTERS
-- ============================================================
-- Note: These will need a valid admin user_id set after first admin is created
-- Placeholder: replace with actual admin ID after running the app
-- INSERT INTO keyword_filters (word, created_by) VALUES
--   ('spam', (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1)),
--   ('promotion', (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1));
-- For now, skip keyword filter seeding; admin can add via UI

-- ============================================================
-- INSTRUCTIONS FOR PROMOTING A USER TO ADMIN
-- ============================================================
-- After creating your first user, run this SQL in Supabase SQL Editor:
-- UPDATE profiles SET role = 'admin', status = 'approved' WHERE anonymous_name = 'Your Name';
-- Replace 'Your Name' with the anonymous name you chose during signup.

-- ============================================================
-- INSTRUCTIONS FOR CREATING THE FIRST INVITE LINK
-- ============================================================
-- After promoting a user to admin, run this:
-- INSERT INTO invite_links (code, created_by, is_active)
-- VALUES ('tabletop2024', (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1), true);
-- Users can then sign up at: /invite/tabletop2024
