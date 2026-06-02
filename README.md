# UnderTable

**Anonymous Office Chat for Table Top Tech**

> What happens UnderTable, stays UnderTable.

## Overview

UnderTable is a full-stack anonymous office chat application built with Next.js 14 and Supabase. It features real-time messaging, anonymous identities, polls, GIF sharing, and a comprehensive admin panel — all wrapped in a beautiful, responsive UI.

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + TailwindCSS + shadcn/ui
- **Backend:** Next.js API Routes (no separate backend server)
- **Realtime + Presence + Auth + Database:** Supabase
- **Charts:** Recharts
- **Notifications:** sonner (toasts) + Browser Push API
- **PDF Export:** jsPDF
- **Deploy:** Vercel

## Prerequisites

- Node.js 18+ (recommended: 20+)
- npm
- A Supabase project (free tier works)
- A Tenor API key (for GIF search)

## Local Development Setup

### 1. Clone and Install

```bash
git clone <repo-url>
cd undertable
npm install
```

### 2. Supabase Project Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings → API and copy your URL and keys
3. Run the migration files in order in the Supabase SQL Editor:

   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_realtime_enable.sql`
   - `supabase/migrations/004_storage_buckets.sql`

4. Run the seed data:
   - `supabase/seed.sql`

5. Enable Realtime:
   - Go to Database → Replication
   - Enable replication for tables: `messages`, `reactions`, `read_receipts`, `polls`, `poll_votes`, `pinned_messages`, `profiles`

6. Enable Storage:
   - Create a bucket called `chat-media` (public or private based on your preference)
   - The migration file handles the policies

### 3. Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key (for admin operations) |
| `NEXT_PUBLIC_TENOR_API_KEY` | Your Tenor API key (for GIF search) |

### 4. Tenor API Key Setup

1. Go to [Tenor API Key](https://developers.google.com/tenor/guides/quickstart)
2. Create a new API key
3. Add it to your `.env.local` as `NEXT_PUBLIC_TENOR_API_KEY`

### 5. Deploy Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Deploy edge functions
supabase functions deploy expire-messages
supabase functions deploy weekly-highlights
supabase functions deploy daily-starter

# Set cron schedules (in Supabase Dashboard → Edge Functions)
# expire-messages: every hour
# weekly-highlights: every Monday at 9:00 AM
# daily-starter: every weekday at 9:00 AM
```

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 7. First Admin Setup

1. Create an invite link by running this SQL in Supabase SQL Editor:
   ```sql
   INSERT INTO invite_links (code, created_by, is_active)
   VALUES ('admin-invite-2024', (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1), true);
   ```

   Or, if no admin exists yet:
   ```sql
   INSERT INTO invite_links (code, created_by, is_active)
   VALUES ('admin-invite-2024', '00000000-0000-0000-0000-000000000000', true);
   ```

2. Sign up at `http://localhost:3000/invite/admin-invite-2024`

3. Promote your user to admin:
   ```sql
   UPDATE profiles SET role = 'admin', status = 'approved' WHERE anonymous_name = 'Your Name';
   ```

4. Create real invite links from the admin panel at `/admin/invites`

## Deploying to Vercel

1. Push your code to a GitHub repository

2. Go to [vercel.com](https://vercel.com) and connect your repo

3. Add environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_TENOR_API_KEY`

4. Deploy! Vercel will automatically detect Next.js

5. Update your Supabase project's Auth settings:
   - Go to Authentication → Settings
   - Add your Vercel domain to the allowed redirect URLs
   - Add `https://your-domain.vercel.app` to Site URL

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── admin/              # Admin panel pages
│   ├── bookmarks/          # Bookmarked messages
│   ├── chat/               # Chat room pages
│   ├── invite/[code]/      # Invite validation
│   ├── login/              # Login page
│   ├── pending/            # Pending approval page
│   ├── search/             # Global search
│   └── signup/             # Signup page
├── components/
│   ├── admin/              # Admin components
│   ├── chat/               # Chat components
│   ├── layout/             # Layout components
│   └── ui/                 # shadcn/ui components
├── hooks/                  # Custom React hooks
├── lib/
│   ├── supabase/           # Supabase clients & types
│   └── utils/              # Utility functions
└── middleware.ts            # Auth middleware
supabase/
├── migrations/             # SQL migration files
├── functions/              # Edge functions
└── seed.sql                # Default data
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Escape` | Close modals, cancel edit, dismiss reply |
| `Ctrl+K` | Open search |
| `Ctrl+B` | Open bookmarks |
| `Enter` | Send message |
| `Shift+Enter` | New line in message |
| `Escape` (in edit) | Cancel editing |

## Features

### User Features
- 🎭 Anonymous identities with auto-generated names
- 👻 Ghost mode (hide presence, read receipts, typing)
- 💬 Real-time messaging with typing indicators
- 👍 Message reactions (👍 ❤️ 😂 🔥 😮)
- 📌 Bookmark messages
- 🔗 Reply to messages
- 📝 Edit messages (within 10 min)
- 🗑️ Delete messages
- 🚫 Block users
- 🚩 Report messages
- 📊 Anonymous polls
- 🖼️ GIF sharing via Tenor
- 🔥 Hot topics feed
- 🏆 Reaction leaderboard
- 🌙 Dark mode

### Admin Features
- 📊 Dashboard with stats
- 👥 Member management (approve/reject/ban)
- 🏠 Room management (create/edit/delete)
- 🔗 Invite link management
- 🚩 Report queue
- 🔤 Keyword filter management
- 📈 Activity analytics with charts
- 💬 Conversation starters
- 📄 Export room digest (PDF)
- 🔒 Read-only mode
- ⚡ Slow mode per room

## How to Promote a User to Admin

Run this SQL in your Supabase SQL Editor:

```sql
UPDATE profiles
SET role = 'admin', status = 'approved'
WHERE anonymous_name = 'Your Anonymous Name';
```

## License

Private - Table Top Tech
