# UnderTable — Complete Project Audit

> **Scope:** every file under `src/`, `supabase/`, and root configs.
> **Audit-only.** No code changes proposed inside this document beyond the
> `Suggested fix` column of the roadmap in §10.
> **Date:** 2026-07-08.
> **Method:** static read of every source file; cross-referenced git log,
> migrations, hook contracts, and Supabase RLS policies.

---

## 1. Project Overview

UnderTable is a real-time **anonymous office chat** web app ("What happens
UnderTable, stays UnderTable") for "Table Top Tech". Members sign up only via
an invite link, pick an `Adjective Animal` anonymous name, are approved by an
admin, then exchange real-time messages in topic-based rooms. The app includes
rich chat features (reactions, replies, polls, GIFs, bookmarks, blocks,
reports, typing indicators, presence/ghost mode, message TTL, slow mode,
read-only rooms), an admin panel (member management, room management, invite
links, reports, keyword filters, analytics, conversation starters, PDF digest
export), and a polished "dark aurora glassmorphism" UI on top of shadcn/ui
primitives.

### Tech stack detected

| Layer            | Technology                                                           |
| ---------------- | -------------------------------------------------------------------- |
| Framework        | **Next.js 14.2.35** (App Router, RSC + `'use client'` islands)        |
| Language         | **TypeScript 5** (`strict: true`)                                    |
| Auth + DB        | **Supabase** (`@supabase/ssr` 0.6.1, `@supabase/supabase-js` 2.45.0) |
| Realtime         | Supabase Realtime (`postgres_changes` + presence channels)           |
| UI primitives    | **shadcn/ui-style** on **Radix UI** + **class-variance-authority**   |
| Styling          | **Tailwind CSS 3.4** with a small design-token extension             |
| Theming          | **next-themes** (`defaultTheme="dark"`; light theme defined but unused) |
| Icons            | **lucide-react**                                                     |
| Notifications    | **sonner** (toast)                                                   |
| Charts           | **recharts** (admin analytics)                                       |
| PDF              | **jspdf**                                                            |
| Emoji            | Custom hand-rolled picker (8 categories, ~240 emojis) — `@emoji-mart/data` and `emoji-mart` declared in deps but **not used** |
| Virtualization   | **react-window** declared in deps, **not used**                      |
| Misc utilities   | `date-fns`, `uuid`, `clsx`, `tailwind-merge`                         |
| Server functions | **Supabase Edge Functions** (Deno): `invite-signup`, `verify-room-password`, `expire-messages`, `daily-starter`, `weekly-highlights` |
| Storage          | Supabase Storage (`chat-media` bucket)                               |
| Deployment       | `next.config.mjs` (Vercel-friendly, `serverActions.bodySizeLimit: '2mb'`), `.vercel-trigger` empty file, `build.log` committed to repo |
| Database         | PostgreSQL via Supabase (16 tables, 9 migrations)                    |
| Migrations       | `001_initial_schema` → `009_apply_migration_005_columns`             |

### Folder structure summary

```
src/
├── app/                          Next.js App Router pages
│   ├── layout.tsx                Root layout (fonts, ThemeProvider, ErrorBoundary)
│   ├── page.tsx                  Root redirect → /chat or /login
│   ├── globals.css               Tailwind base + glass/aurora utilities
│   ├── fonts/                    GeistVF.woff, GeistMonoVF.woff (self-hosted)
│   ├── login/                    Email/password sign-in
│   ├── signup/                   Invite-gated registration
│   ├── invite/[code]/            Server component: validate invite, redirect
│   ├── pending/                  Polling page for awaiting approval
│   ├── chat/                     Chat shell (IconRail + LeftSidebar + main + RightSidebar)
## 2. Feature Inventory

| # | Feature | Route / Location | Status | Notes |
|---|---------|------------------|--------|-------|
| 1 | Email/password login | `src/app/login/page.tsx` | **Complete** | Supabase auth, password-visibility toggle, redirect handling. |
| 2 | Signup via invite | `src/app/signup/page.tsx` | **Complete** | Validates invite, debounced name-availability check, password-strength meter, 3 name suggestions. |
| 3 | Invite validation gate | `src/app/invite/[code]/page.tsx` + `invite-signup` edge fn | **Complete** | Server-component redirect, edge function atomic claim via `claim_invite_code()`. |
| 4 | Pending approval page | `src/app/pending/page.tsx` | **Complete** | Polls `profiles.status` every 10s. |
| 5 | Middleware auth + status | `src/middleware.ts` | **Complete** | Banned → /login?error=banned; pending → /pending; admin guard. |
| 6 | Chat shell (3-pane) | `ChatLayoutClient.tsx` | **Complete** | IconRail 58 + LeftSidebar 224 + main + RightSidebar 200; Esc/Ctrl+K/Ctrl+B shortcuts. |
| 7 | Room auto-redirect | `src/app/chat/page.tsx` | **Partial** | Picks first room alphabetically; with zero rooms user is stuck on a spinner. |
| 8 | Real-time messaging | `useMessages.ts` | **Complete** | Filtered postgres_changes channel, optimistic send, 10-min edit window. |
| 9 | Message send (text) | `MessageInput.tsx` | **Complete** | Slow-mode countdown, emoji picker, @-mentions, typing detection, auto-grow. |
| 10 | Message reply | `ReplyPreview.tsx` + `MessageItem` | **Complete** | Hover-reply, preview chip. |
| 11 | Message edit | `useMessages.editMessage` + RLS | **Complete** | Client + server. |
| 12 | Message delete | `useMessages.deleteMessage` | **Complete** | Soft-delete + dialog. |
| 13 | Message pin | `chat/[roomId]/page.tsx:311-330` | **Partial** | Admin-only, but message itself never shows a "pinned" indicator. |
| 14 | Pinned messages bar | `PinnedMessagesBar.tsx` | **Complete** | Last 3, realtime. |
| 15 | Reactions (👍 ❤️ 😂 🔥 😮) | `ReactionBar.tsx` + `ReactionPill.tsx` | **Complete** | Optimistic toggle, dedup on unique violation. |
| 16 | GIF search / send | `GifPickerModal.tsx` (Tenor) | **Complete** | Auto-detected by URL regex. |
| 17 | Polls — create | `PollCreateModal.tsx` | **Complete** | 2–4 options, optional expiry. |
| 18 | Polls — display + vote | `PollCard.tsx` + `usePolls` | **Complete** | Recharts, admin can close. |
| 19 | Bookmarks | `src/app/bookmarks/page.tsx` | **Complete** | Search highlight, remove. |
| 20 | Global search | `src/app/search/page.tsx` | **Complete** | `ilike '%q%'`, grouped by room, plus in-room search. |
| 21 | Anonymous identity | `signup` + `name-generator.ts` | **Complete** | 100×100+ combos. |
| 22 | Identity reset (30d cooldown) | `SettingsModal.tsx` | **Complete** | Cooldown in days. |
| 23 | Ghost mode | `SettingsModal.tsx:263-277` | **Complete** | Presence hook filters ghost users. |
| 24 | Block user | `MessageItem.tsx:343-355` | **Partial** | Client-state only, no realtime sync. |
| 25 | Report message | `chat/[roomId]/page.tsx:332-355` | **Complete** | Reason radio. |
| 26 | Keyword auto-flag | SQL trigger in `005` | **Complete** | Server-side. |
| 27 | Slow mode | `rooms.slow_mode_seconds` + UI | **Complete** | 0/10/30/60/120. |
| 28 | Message TTL | `message_ttl_seconds` + edge fn | **Complete** | Cron edge fn purges. |
| 29 | Confession box | `is_confession_box` | **Partial** | Warning copy hard-codes "1 hour" but TTL is configurable. |
| 30 | Read-only rooms | `rooms.is_readonly` | **Partial (UX)** | Prop wired, `MessageInput` does not visually disable / show a banner. |
| 31 | Admin dashboard | `src/app/admin/page.tsx` | **Partial** | `activeToday` hard-coded to `0`; `recentActions` declared but never populated. |
| 32 | Admin members | `src/app/admin/members/page.tsx` | **Complete** | 4 tabs, bulk, ban/unban. |
| 33 | Admin rooms CRUD | `src/app/admin/rooms/page.tsx` | **Complete** | Password, slow mode, TTL, accent, emoji, private, confession. |
| 34 | Admin invite links | `src/app/admin/invites/page.tsx` | **Complete** | Generate, copy, revoke. |
| 35 | Admin reports | `src/app/admin/reports/page.tsx` | **Complete** | 3 tabs, approve/dismiss/delete/ban. |
| 36 | Admin keyword filters | `src/app/admin/filters/page.tsx` | **Complete** | CRUD + test area. |
| 37 | Admin analytics | `src/app/admin/analytics/page.tsx` | **Complete** | 4 charts. |
| 38 | Admin starters | `src/app/admin/starters/page.tsx` | **Complete** | Add, post now. |
| 39 | PDF room digest | `src/lib/utils/export-pdf.ts` | **Dead code** | Full implementation, **no caller**. |
| 40 | Notification preferences | `SettingsModal.tsx` | **Partial (UX)** | Saved, never applied (no `Notification` API). |
| 41 | Push notifications | — | **Missing** | README claims Browser Push; no SW, no `Notification` API. |
### Dead code / unused exports

* `src/lib/utils/export-pdf.ts` — `generateRoomDigestPDF` + `generateAnonymousLabels` are never imported.
* `@emoji-mart/data` and `emoji-mart` in `package.json` — never imported (replaced by hand-rolled picker).
* `react-window` in `package.json` — never imported.
* `src/lib/utils/keyword-filter.ts` — `checkKeywordFilter` exported, never called.
* `src/app/admin/page.tsx:25` — `setRecentActions` reserved, never populated.
* `src/app/admin/page.tsx:53` — `activeToday: 0` hard-coded; never updated.
* `src/components/chat/MessageItem.tsx` — never renders a "pinned" indicator on a pinned message.
* `src/components/chat/MessageList.tsx:211` — copy "auto-delete after 1 hour" hard-coded; TTL is configurable.
* `src/components/chat/MessageInput.tsx:102-103` — `void roomId; void roomName;` props declared but never used.
* `src/hooks/useReactions.ts` — defined, **never imported anywhere** (MessageItem does its own reactions handling inline).

### TODO / FIXME / HACK

No `TODO`, `FIXME`, `XXX`, or `HACK` markers in the source. (Only `// FIX:` comments documenting prior bug fixes — those are intentional design notes, not outstanding work.)

### Features implied by UI but not functional

* **Pin button in `ReactionBar.tsx:90`** — wires `onPin` which inserts a `pinned_messages` row, but the bar **never re-renders the message with a "pinned" indicator**.
* **SettingsModal "Theme" tab** is implied by `next-themes` and the `theme` column on `profiles`, but the Settings modal has **no theme tab** — only Identity / Notifications / Blocks.
* **"Settings" gear icon in `IconRail` opens the same modal as the LeftSidebar settings button** — duplicate entry point.

---


| 42 | Daily starter cron | `daily-starter` | **Complete** | Edge fn exists. |
## 3. UX & User Flow Audit

### Main journeys

#### A. New user joins via invite

1. Admin generates a link in `/admin/invites` → user clicks `/invite/<code>`.
2. `src/app/invite/[code]/page.tsx` (server component) validates code is active and not over `max_uses`, then redirects to `/signup?code=<code>`.
3. Signup form shows 3 suggested names, password strength bar (3 levels: weak/fair/strong by length + uppercase + digit), debounced name-availability check.
4. On submit, `supabase.auth.signUp` is called. **The signup handler does *not* insert a `profiles` row** (`src/app/signup/page.tsx:96-130` only calls `signUp` + `signInWithPassword`).
5. After signup the user is redirected to `/chat`, but the middleware sees no profile row → bounces to `/pending`.
6. Admin approves in `/admin/members` → next 10s poll, user enters `/chat`.

**Friction / dead ends:**
* `src/app/signup/page.tsx` **does not create a `profiles` row** — it relies on an `auth.users` → `profiles` trigger that **does not exist in any migration** (the only DB-side "create the first admin" path is the manual SQL in `supabase/seed.sql`). The middleware does `maybeSingle()` against `profiles` and falls through, so a brand-new signup lands in `/pending` forever until an admin runs manual SQL to insert the matching `profiles` row. This is a **critical silent break** (see §6).
* Password requirements differ between the strength meter (`<6 → weak; <10 or no upper or no digit → fair`) and the form's `minLength={6}` — a 9-char password with no uppercase is "fair" but accepted; a 5-char password is "weak" but the form rejects it.
* `signup` uses `signInWithPassword` after `signUp`; if email confirmation is required (default in Supabase), the sign-in call fails and the user is told "Invalid login credentials" — confusing because they just signed up.

#### B. Approved user sends a message

1. Login → middleware sees `status='approved'` → `/chat`.
2. `/chat/page.tsx` fetches first room by name, redirects to `/chat/<id>`.
3. ChatLayoutClient verifies approved status, mounts 3-pane shell.
4. `useMessages` opens realtime channel, fetches last 100 messages.
5. User types → typing channel `track` → others see "X is typing".
6. User presses Enter → `sendMessage` inserts → realtime echo upserts → scrolls to bottom.

**Friction:**
* `MessageInput.tsx` does not visually disable the textarea when `slowModeSeconds > 0` — it just no-ops the send. The user sees keypresses accepted but nothing happens, and the countdown chip is the only feedback.
* `MessageItem.tsx:338` recomputes `canEdit` every render — the Edit button in the action bar disappears the moment the 10-min window passes, but the action bar only opens on hover, so a user who hasn't hovered in 9:59 has to find the message by scrolling.

#### C. Admin approves a member

1. New user signs up → sits in `profiles` with `status='pending'` (assuming the missing trigger).
2. Admin visits `/admin/members` → pending tab is the default.
### Empty states

| Page | Empty state | Notes |
|------|-------------|-------|
| `/chat/[roomId]` | "No messages yet / Be the first" (MessageList.tsx:188-204) | Good. |
| `/chat` (index) | Spinner (no rooms check) | **Bad — with 0 rooms the user is stuck on a forever-spinner.** |
| `/search` | "Search messages / Type to search" (page.tsx:123-130) | Good. |
| `/search` (no results) | "No results found" | Good. |
| `/bookmarks` | Falls into the search-empty state path (page.tsx) | Acceptable, but no dedicated copy. |
| `/admin/members` (any tab) | "No <status> members" | Good. |
| `/admin/invites` | "No invite links yet" | Good. |
| `/admin/rooms` | Renders an empty grid — no empty-state message | **Bad — looks broken.** |
| `/admin/filters` | "No keywords added yet" | Good. |
| `/admin/starters` | "All starters have been posted" | Good. |
| `/admin/reports` | "No reports to review" | Good. |
| `/admin/analytics` | 4 empty charts with no labels | **Bad — no "no data" copy, axes look broken.** |
| `/pending` | "You're on the list!" | Good. |
| `/login` | "Don't have an account? You need an invite link to join." | Good. |

### Loading states

* Chat layout: `Loader2` spinner during auth check.
* Chat room: `useMessages.loading` flips to `true` then `false`, but **MessageList only ever shows a spinner-less empty state** (line 188). On a cold load, the user sees the empty ghost icon + "No messages yet" for a beat before messages appear.
* Admin pages: each shows a `Loader2` spinner while the initial query runs.
* Search: spinner while debounced query executes.
* The **send button has no optimistic state** — after pressing Enter, the input is cleared but the message does not appear in the list until the realtime echo lands (sub-second, but visible on slow networks). On error, the toast fires but the typed text is **already gone** (MessageInput clears the input before `await onSend`).

### Error states

* **`useMessages` sets `error` on realtime channel error** (line 314) — but the chat page never reads it; the only place the error string would surface is a developer console log.
* **No global error toast** for failed Supabase queries — most call sites only `console.error` (`useMessages.ts:311, 318, 330; usePolls.ts:55; usePresence.ts:84; MessageList.tsx:85, 99; ReadReceipts.tsx:56, 61, 71; PinnedMessagesBar.tsx:43, 71, 86; PollCard.tsx:55, 59, 70, 99, 123`).
* The `ErrorBoundary` (`src/components/ErrorBoundary.tsx`) shows a styled error screen with Try-Again / Reload buttons — good.
* `Login page` shows a red error banner and a toast (line 67-71 + 42).
* `Signup` shows a red banner inline.
* **API failures in admin pages are silent** — e.g. `admin/rooms` `loadRooms` only `console.error`s (line 88) if the retry path also fails. The user sees no rooms and no message.
* The chat page **does not validate** the room name input on `RoomSettingsModal.tsx:60` — empty room name is allowed; only "no changes" short-circuits.

### Mobile experience

* `ChatLayoutClient.tsx:111-118` shows a hamburger button `lg:hidden`, but **the LeftSidebar has no `translate-x`/closed class** for small screens — `isOpen` state is wired but the sidebar renders inside a `flex lg:w-[224px]` container that is always visible. **Hamburger is non-functional** on mobile.
* `RightSidebar` is `200px` fixed width with `flex-shrink: 0` — on a 360px screen the **3 panes total 58 + 224 + 200 = 482px wide**, exceeding the viewport. There is no `hidden lg:flex` wrapper.
* The chat room header in `chat/[roomId]/page.tsx:412-460` is a flex row with no `flex-wrap` and no truncation on the description — on narrow screens the long room name + buttons overflow horizontally.
* `MessageInput.tsx` does not handle the iOS keyboard pushing the layout (no `visualViewport` handler). The textarea will be covered on small phones.
* `GifPickerModal` grid is `grid-cols-2` (line 83) — works on 360px but the modal `sm:max-w-[500px]` is wider than the viewport on phones.
## 4. UI & Design System Audit

### Color usage

**Defined design tokens (in `tailwind.config.ts` and `globals.css`):**

* `primary` violet scale: 50–900 from `#F5F3FF` to `#4C1D95`. `DEFAULT: #A78BFA`.
* `accent.DEFAULT: #A78BFA`, `accent.hover: #F0ABFC` (mismatched with the primary token — `accent.hover` is a pink that isn't in the `primary` scale).
* `glass` white-alpha tokens: 5/8/10/16 % with 7/8/10 % borders.
* `text.primary: #FFFFFF`, `text.secondary: rgba(255,255,255,0.7)`, `text.muted: rgba(255,255,255,0.45)`, `text.hint: rgba(255,255,255,0.35)`, `text.lavender: #C4B5FD`.
* `status.online: #34D399`, `status.idle: #F59E0B`.
* CSS-variable `--destructive: #EF4444`, `--success: #22C55E`, `--warning: #F59E0B`, `--background: #0E0E1A`, `--foreground: #FFFFFF`.
* `aurora-bg` uses three radial gradients (pink `#DB2777`, cyan `#0891B2`, violet `#6D28D9`) plus a `linear-gradient(160deg, #14122B 0%, #0C0B1C 100%)` — hard-coded in CSS.
* `bg-primary-gradient` (CSS) is `linear-gradient(135deg, #7C3AED, #9333EA)` **whereas** Tailwind's `backgroundImage.primary-gradient` is `linear-gradient(135deg, #A78BFA, #F0ABFC)`. **Two different gradients with the same name.** Components mix `bg-primary-gradient` (CSS) and `bg-[#A78BFA]` / `from-[#A78BFA] to-[#F0ABFC]` (Tailwind) arbitrarily.
* 10 hard-coded `avatar-gradient-N` classes use 10 different color pairs (each pair is hand-picked; no shared palette).
* `glass-panel`, `glass-card`, `glass-message`, `glass-auth`, `glass-strong`, `glass-chat` are defined in `globals.css` with overlapping but distinct alpha/border values. The choice of which to use is not consistent.
  * `glass-strong` is **never used**.
  * `glass-chat` is `background: transparent` — **defined but does nothing.**

**Inconsistent shades of the same color (a small sample):**
* `text-[#EDEBF7]` (`MessageItem.tsx:497`) is a near-white that does **not** appear in the `text` token set.
* `text-[#2E1065]` is the `default` button foreground — used in `ui/button.tsx:11` and `ui/badge.tsx:10` — but the only place this specific violet appears; the `primary` token scale skips it.
* `text-[#56566E]` is the most-frequently used muted text color, but `globals.css` defines `text.muted: rgba(255,255,255,0.45)` — a different value entirely. The hex `#56566E` is hard-coded in **>30 places**.
* `text-[#DDD6FE]`, `text-[#C4B5FD]`, `text-[#A78BFA]`, `text-[#7C3AED]`, `text-[#5B21B6]` are all "violet" variants used inconsistently for the same semantic role.
* `text-[#22223A]`, `text-[#18182A]`, `text-[#0B0B14]`, `text-[#13131F]`, `text-[#0C0B1C]`, `text-[#0E0E1A]`, `text-[#14122B]` are all "near-black" backgrounds hand-picked in different files.

### Typography

* Font family: Geist Sans + Geist Mono, self-hosted via `next/font/local` (good).
* `font-weight` values observed: `400` (body), `500` (h1, admin h1, label, some buttons), `600` (right-sidebar "Online Now" header), `700` (ghost logo). No `300`, no `800` used. The README says font weight is `100 900` variable — only 4 weights are ever used.
* `text-[10px]`, `text-[11px]`, `text-[12px]`, `text-[13px]`, `text-[14px]`, `text-xl`, `text-2xl` — at least 7 distinct sizes for body / sub-text.
* Heading sizes: `h1` is `26px` in `globals.css:38` but admin pages use `text-[26px] font-medium` repeatedly. The `<h1>` rule is rarely applied because pages are full of `<div className="text-[26px] font-medium">`. There is **no semantic heading hierarchy** anywhere on the site.
* `text-balance` utility is defined (`globals.css:63`) but never used.
* `<title>` is set in `layout.tsx` to "UnderTable" — but per-page `metadata` is missing everywhere.

### Spacing & layout

* Padding scale used inconsistently: `p-2`, `p-3`, `p-4`, `p-6`, `p-8`, plus bespoke `px-4 py-2`/`py-3`/`px-6 py-4`/`px-3 py-2` mixes. The 6 cards in `StatsCards.tsx` use the same `p-4`; consistent.
* Border-radius: tailwind config defines `bubble: 17px`, `input: 13px`, `icon: 11px`, `card: 14px`, `auth: 24px`, `full: 50%`. Files use:
  * `rounded-[13px]` — login/signup/PollCard/MessageInput/buttons
  * `rounded-[14px]` — admin cards / SettingsModal
  * `rounded-[17px]` — Dialog content
  * `rounded-[12px]` — admin sidebar items, GifPickerModal tiles
  * `rounded-[11px]` — icon buttons
  * `rounded-[10px]` — reply preview
  * `rounded-[8px]` — context-menu items, button variants
  * `rounded-[16px]` — admin starters posted-row (admin/starters/page.tsx:146) — only place
  * `rounded-[18px]` — login logo
  * `rounded-full` — pills
  * **9 different radii for "card"-shaped containers.**
* Shadows: `shadow-glow`, `shadow-glow-sm` (tw config), plus ad-hoc `shadow-[0_4px_14px_rgba(167,139,250,0.4)]`, `shadow-[0_3px_12px_rgba(124,58,237,0.3)]`, `shadow-xl`, `shadow-2xl`, `shadow-lg`. Inconsistent.

### Component consistency

* **Buttons** — the `Button` component (`ui/button.tsx`) is used ~80% of the time. Exceptions:
  * `chat/IconRail.tsx`, `MessageItem.tsx` action bar, `LeftSidebar.tsx` use **raw `<button>` elements** with hand-styled `rounded-[11px]` and `hover:bg-...` instead of `Button size="icon"`. Same pattern, three different implementations.
* **Inputs** — `Input` from `ui/input.tsx` is the standard. `RoomSettingsModal.tsx` uses `<Input>` with `h-9` and then overrides `h-9 text-sm` ad-hoc.
* **Modals** — `Dialog` from Radix is the standard. The confim-dialog copy is **almost identical in 4 places** (delete message, report message, block user, delete room), all using `DialogContent` + `DialogHeader` + `DialogTitle` + `DialogDescription` + Cancel/Delete footer. Could be a single `<ConfirmDialog>` component.
* **Spinners** — `Loader2 h-X w-X animate-spin text-[#A78BFA]` is hand-written in 14+ places. A `<Spinner size="sm|lg" />` component would help.
* **Avatars** — `Avatar` / `AvatarFallback` from Radix is the standard. `RightSidebar.tsx:70-74` uses it; `MessageItem.tsx:404-416` uses it; `members/page.tsx:148-155` uses it. But `MessageItem.tsx` uses inline `getAvatarGradient(name)` for the background, while `members/page.tsx` uses `getAvatarColor(name)` (the **single** color, not the gradient) — same component, different styling.
* **Toast** — `sonner` is used everywhere via `toast.success/error` — consistent.
### Dark mode

* The `ThemeProvider` is configured with `defaultTheme="dark"`, `enableSystem={false}`. The light theme is technically supported by Tailwind's `dark:` prefix (in `button.tsx`, `input.tsx`, etc.) but **every component uses hard-coded `text-white`, `bg-[#0C0B1C]`, etc. with no `dark:` variants**. Switching theme to "light" would produce a near-invisible UI.
* `:root` defines `--background: #0E0E1A` but the `<body>` in `globals.css` immediately overrides it with the `radial-gradient` + `linear-gradient` aurora — `--background` is never used.
* `PollCard.tsx:34` reads `useTheme()` to compute `isDark = theme === 'dark'`, but the rest of the file uses hard-coded colors that work in dark only. The `isDark` variable **does not actually branch on anything**.

### Accessibility

* **Inputs have labels** in `Login` (`htmlFor="email"`) and `Signup` and admin forms, but the **chat room search input in `chat/[roomId]/page.tsx:470-478` has no `id`/`htmlFor`** (the icon-only button above it is the toggle).
* `aria-live`/`role` are present on `ErrorBoundary` (good), but no other live regions exist for "new message" / "new reaction" announcements.
* The **floating action bar in `MessageItem.tsx:530-555`** is positioned with `-top-9` or `top-full mt-1` based on `showBelow` — no `aria-expanded`, no semantic role.
* `dialog.tsx` correctly wires `DialogTitle`, `DialogDescription`, focus trap, and `aria-modal` (Radix handles it).
* **Buttons in the ReactionBar use only icons** with `title` attributes (e.g. line 53 `title={`React with ${emoji}`}`). `title` is read by screen readers on desktop but not mobile. No `aria-label`.
* **Color contrast**:
  * `text-[rgba(255,255,255,0.35)]` (`hint` token) on dark aurora background = ratio ≈ 4.0:1 (passes AA for large text, fails AA for body).
  * `text-[#56566E]` on dark aurora = ratio ≈ 3.2:1 (**fails AA** for body text). Used as a "muted" color >30 times.
  * `text-[rgba(255,255,255,0.7)]` = ratio ≈ 9.5:1 (good).
  * `text-[rgba(255,255,255,0.45)]` = ratio ≈ 5.4:1 (passes AA body, fails AAA).
  * `bg-[#EF4444]/20` for destructive button background = `text-[#EF4444]` on top. Ratio ≈ 5.8:1, ok.
* **Keyboard navigation**:
  * `MessageItem.tsx:530-555` action bar is hover-only (`onMouseEnter` / `onMouseLeave`); keyboard users cannot reach Reply / React / Edit / Delete.
  * `LeftSidebar.tsx:372-387` context menu (right-click on room) is **mouse-only**; no keyboard equivalent.
  * `MessageList.tsx:104-110` uses `isScrolledUpRef` for "show new messages" — no keyboard hook to jump to bottom.
  * `signup/page.tsx` has no focus management when a name-availability check completes; screen reader users get no feedback.
* **Focus states** are present in shadcn components (radix `focus-visible:ring-2 focus-visible:ring-[#A78BFA]`), but custom buttons in `IconRail.tsx:138-150` have `hover:bg-...` but no `focus-visible:ring-*` — they look identical to non-keyboard users.
* **Alt text**: `MessageItem.tsx:124` renders `<img alt={alt} />` for GIFs; the alt defaults to "GIF". `avatar.tsx` `AvatarImage` is not used (only `AvatarFallback`); an `alt` is never reached.
* The `Search` icon-only button in `chat/[roomId]/page.tsx:447-457` has `title="Search messages (Ctrl+F)"` but no `aria-label`. Same for `Settings`, `Pin` icons.

---
## 5. Code Quality & Architecture Audit

### Component structure

* **God components**:
  * `src/components/chat/MessageItem.tsx` is ~580 lines and handles rendering, edit-state, GIF detection, block confirmation, reaction toggle, reply dispatch, jump-to-message, search highlight, mention highlight. It contains 4 local components and 5 state machines.
  * `src/app/chat/[roomId]/page.tsx` is ~640 lines and inlines room/profile state, all modals, all action-bar callbacks, the room header, the message input, and the message list. Could be split into `<RoomHeader>`, `<MessageActions>`, `<RoomModals>`.
  * `src/components/chat/MessageInput.tsx` is ~580 lines: emoji picker, mention autocomplete, slow-mode countdown, typing indicator, paste handling, local storage. Could be split.
  * `src/components/layout/LeftSidebar.tsx` is ~450 lines: room list, password gate, context menu, mute logic, ghost-mode toggle, settings handler. Multiple concerns.
  * `src/components/layout/SettingsModal.tsx` is ~320 lines: 4 tabs each with own state.

* **Duplicated logic**:
  * "find the first room by name and redirect" is in both `src/app/chat/page.tsx:12-22` and `LeftSidebar.tsx:86`.
  * The "full column list vs legacy column list fallback" string is duplicated **verbatim** in `LeftSidebar.tsx:92-95`, `admin/rooms/page.tsx:62-65`, and `chat/[roomId]/page.tsx:181-184`. Should be a shared constant.
  * `createClient()` is called three different ways: `useRef(createClient()).current`, `useMemo(() => createClient(), [])`, and bare `createClient()`. Inconsistent.
  * The "loader spinner" JSX is inlined in 14+ places.

* **Prop drilling**:
### State management

* Pure local-component React state. **No Context, no Redux/Zustand, no Jotai.** `current-room.ts` is a hand-rolled pub-sub for one integer.
* `usePresence` is called from **two places** in the same render tree (`chat/[roomId]/page.tsx` and `RightSidebar.tsx`). Each call instantiates its own `usePresence` which has its own `supabase.channel` — **two separate Supabase channels for the same presence data**.
* `useMessages` keeps messages in local state and patches via realtime callbacks. Works but the messages array is re-created on every state change; downstream `MessageList` is not memoised.
* `useReactions` is defined but **not used** — `MessageItem` does its own reactions aggregation inline.

### API / data layer

* **No shared data layer / no React Query / no SWR.** Every page does `useEffect` + `useState` + `await supabase.from(...).select(...)`. There is no caching, no stale-while-revalidate, no automatic revalidation on focus.
* **Duplicated queries**:
  * `profiles.role` is fetched in `admin/layout.tsx:56-60` and `chat/ChatLayoutClient.tsx:73-77` and many other places — never cached.
  * `rooms` is fetched in `chat/page.tsx`, `LeftSidebar.tsx`, `SettingsModal.tsx`, `MessageList.tsx`, indirectly in `MessageItem`.
  * `blocked` users are re-fetched from the blocks table in `SettingsModal.tsx` and not in `MessageList` (where they're used).
* **Waterfall requests**:
  * `useMessages` calls `messages` query → `reactions` query → `replies` query **in sequence** (lines 99-130).
  * `bookmarks/page.tsx` does bookmarks → rooms → authors in two parallel queries (good).
  * `admin/rooms/page.tsx` `loadRooms` has a fallback chain — **sequential, not parallel**.
* **No pagination** anywhere — `useMessages.limit = 100`, `bookmarks.page.tsx` no limit, `search.page.tsx` `.limit(50)`, `LeftSidebar` no limit. >1000 rows would dump everything into memory.
* **N+1 patterns**:
  * `bookmarks/page.tsx:92-102` fetches rooms + authors in 2 `Promise.all` calls (good).
  * `useMessages` does 3 sequential awaits for a single room — 100 messages × reactions × replies = up to 300 rows.

### TypeScript quality

* `tsconfig.json` has `strict: true`. Good.
* **The third generic of the Supabase client is pinned to `any`** (`src/lib/supabase/client.ts:25, server.ts:10, middleware.ts:10`). The comments justify this as a known supabase-js + custom schema type interaction.
* `as never` casts in `admin/page.tsx:68` and `admin/filters/page.tsx:45` for inserts.
* `as unknown as <Type>` casts in: `chat/[roomId]/page.tsx:182-184`, `admin/reports/page.tsx:70-87`, `admin/analytics/page.tsx:60, 100`, `bookmarks/page.tsx:75-86`, `PinnedMessagesBar.tsx:41`, `LeftSidebar.tsx` (loadRooms), `search/page.tsx:54`, `MessageList.tsx` poll subscriptions.
* No `@ts-ignore` / `@ts-expect-error` in the source.
* `any` appears in: `usePresence.ts:31, 39-66, 90, 108, 170, 207, 247, 271, 281, 285, 291, 294, 326, 330, 349, 354, 360, 392, 393, 396, 400` (10+ uses, all in a hand-rolled `SupabaseLike` type).

### Error handling

* **Try/catch around every Supabase call** is the norm; this is good.
* **But error messages are rarely surfaced to the user**:
  * `useMessages.ts:311, 318, 330` — `console.error` only.
  * `useMessages.ts:312-314` — `setError('Realtime connection lost — pull to refresh.')` is set but **the chat page never reads `error` from the hook** (line 67 destructures `error` but JSX never uses it).
  * `usePolls.ts:55, 84, 91, 112, 142` — silent.
  * `usePresence.ts:84, 87, 100, 110, 122, 124, 137, 153, 178, 185, 200, 208, 286, 372, 377, 399` — every error is just logged.
  * `MessageList.tsx:85, 99`, `ReadReceipts.tsx:56, 61, 71, 105`, `PinnedMessagesBar.tsx:43, 71, 86`, `PollCard.tsx:55, 59, 70, 99, 123`, `LeftSidebar.tsx:63, 65, 82, 286, 290, 301, 333, 339` — silent.
  * `MessageItem.tsx` reactions: `console.error` + one user-facing toast on failure (line 332).
  * The chat page itself (`chat/[roomId]/page.tsx:131`) catches and toasts, but most of its handlers don't.
* **Unhandled promise rejections**:
  * `useMessages.ts:336-337` has `eslint-disable react-hooks/exhaustive-deps` and intentionally doesn't depend on `messages`.
  * `usePresence.ts:170` returns `Promise<unknown>` from `track` but result is never checked.
  * `useMessages.ts:380-381` does `if (data) { ... }` after `await supabase...insert` — if realtime event lands before the fallback upsert, local state has it twice (`upsertMessage` updates in place, so ok).
* **Silent failures on auth refresh**: `supabase.auth.getUser()` is called in 11+ places — if it fails, none of them surface a re-login prompt.

### Naming and file organization

* `src/lib/supabase/database.types.ts` is named `database.types.ts` but is hand-written, not generated.
* `src/lib/utils/keyword-filter.ts` — only used in admin/filters; arguably belongs in `src/app/admin/filters/`.
* `src/lib/utils/current-room.ts` is a hand-rolled pub-sub (not really a util) — could be a React context.
* `useReactions.ts` is in `src/hooks/` but **not used** by any component.
* `export-pdf.ts` is in `src/lib/utils/` but **not used** by any component.
* Folder `src/app/chat/ChatLayoutClient.tsx` is a sibling of `layout.tsx`; the `Client` suffix is unusual.
* Admin subroutes don't share a common `_components` folder; each page inlines its own table rows, badges, etc.

### Dependencies

* 26 runtime deps.
* **Unused in code** but declared:
  * `emoji-mart`, `@emoji-mart/data` — replaced by hand-rolled picker in MessageInput.
  * `react-window` — never imported.
  * `date-fns` — `date-fns` is in `package.json` but no file imports it. Time formatting is done by hand in `src/lib/utils/time.ts` using `toLocaleDateString`.
## 6. Security Audit

### Auth

* Auth is via `@supabase/ssr` with cookies. The middleware (`src/middleware.ts`) calls `supabase.auth.getUser()` on every request and refreshes the session cookie.
* **Public routes** are `['/login', '/invite', '/signup']` (line 10 of middleware). `'/invite/[code]'` is protected by `pathname.startsWith('/invite')` which also matches the static `/invite` segment, so a request to `/invite` without a code is allowed.
* **The signup page does not create a `profiles` row** (`src/app/signup/page.tsx:96-130`). It calls `supabase.auth.signUp` and then `signInWithPassword`, but **no `insert into profiles`** exists client-side and **no SQL trigger on `auth.users` exists in any migration** to create it. A brand-new user has an `auth.users` row but no `profiles` row.
* The middleware's `maybeSingle()` against `profiles` returns `null` for new signups → falls through. The chat layout (`ChatLayoutClient.tsx:73-77`) also `maybeSingle()`s and routes to `/pending` because the user is not `approved`. **The user is stuck on `/pending` forever** because:
  * The admin approves by setting `status='approved'` in `/admin/members`.
  * But the admin can only find them in the `profiles` table — and **the `profiles` row was never created**, so the user does not appear in the list.
  * The "First admin setup" README says to run manual SQL: `INSERT INTO profiles (id, anonymous_name, ...)`. The README acknowledges the bootstrap is manual.
  * `seed.sql` is even more explicit: *"After creating your first user, run this SQL..."* — there is no programmatic profile creation path for any user.
* **Admin protection is in middleware** (line 47–49 of `src/middleware.ts`) — `if (pathname.startsWith('/admin') && profile?.role !== 'admin')` → redirect to `/chat`. The `admin/layout.tsx` re-checks (lines 49-68). Double-gated.
* **Client-side admin checks** are present in `chat/[roomId]/page.tsx:409` (`isAdmin = profile.role === 'admin'`) and the pin button is only rendered for admins in `MessageItem.tsx` (action bar). The underlying `pinned_messages` RLS policy is `is_admin()` — server-side enforcement. So client UI and server RLS agree.
* **Ban enforcement**: middleware redirects banned users to `/login?error=banned`. The chat layout's `checkAuth` only checks `status !== 'approved'`, so banned users fall through to `/pending` (because `status !== 'approved'` is true for banned too). **A banned user lands on `/pending`** which polls every 10s, sees status is `banned`, redirects to `/login` (line 35-37 of pending page).


  * `@radix-ui/react-alert-dialog` — declared but no component uses it; confirm dialogs use `Dialog`.
### Database / RLS

* **All 16 tables have RLS enabled** (`002_rls_policies.sql:4-20`).
* The RLS helper functions `is_approved()`, `is_admin()`, and `can_access_room()` are `SECURITY DEFINER` and run on every `SELECT`.
* **Migration 007 fixed two critical RLS holes**:
  1. The permissive `messages_update_own` policy was **dropped** (line 40) so the 10-min edit window (in 005) is now the only owner-side UPDATE — Postgres OR's the USING clauses of all matching UPDATE policies, so without the drop the time check was bypassable.
  2. `can_access_room` was rewritten to enforce `room_password` via a `verified_room_access` table the `verify-room-password` edge function writes to (line 64-102). The previous version trusted a client-side sessionStorage gate.
* `reactions_select` was tightened in 007 to require `can_access_room(message_room_id)` (line 117-126) — prevents private-room reaction enumeration.
* **`conversation_starters_select` is `USING (true)`** (`002_rls_policies.sql:337`). Inserts/updates are admin-only.
* **`profiles_select_approved` allows `id = auth.uid() OR is_admin()`** (line 64-67) — a user can read their own profile even if it's `pending` or `banned`. Acceptable.
* **Profile updates by users** go through `profiles_update_own` (line 74-76) — `id = auth.uid() OR is_admin()`. There is **no field-level restriction**: a user could in theory update `role` to `'admin'` (the WITH CHECK is the same). **The `role` column is client-mutable.** This is a privilege-escalation risk. (See P0 in §10.)
* **Messages SELECT uses `is_deleted = false`** in 007 — soft-deleted messages are invisible to non-admins.
* **Pinned messages INSERT** is admin-only (line 311 of 002). **The chat page calls this from any user** if the UI ever exposes the button (it does not, currently).
* **`reports` INSERT is `reported_by = auth.uid()`** (line 273) — a user can only report as themselves. Admins SELECT and UPDATE.
* **Storage policies** were hardened across 004, 006, 008:
  * Bucket `chat-media` is **public** for SELECT (migration 008:33) — any authenticated user can read any file. Trade-off documented in the migration: privacy boundary is the `messages` table RLS, not the storage layer.
  * INSERT is per-folder (`<user_id>/...`) — users can only upload under their own user id.
  * DELETE is owner + admin.
  * MIME type enforced on INSERT and UPDATE (006_storage_policy_fix.sql:43-58) — prevents stored-XSS via type confusion.
  * Size cap of 5 MB on INSERT and UPDATE (006_storage_policy_fix.sql:66-80).

### Secrets

* `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_TENOR_API_KEY` are prefixed `NEXT_PUBLIC_` — bundled into the client. Acceptable for these.
* `SUPABASE_SERVICE_ROLE_KEY` is the **only** server-side key, and is used **only** in:
  * `src/lib/supabase/server.ts:43` (`getServiceRoleClient`) — **but this function is never called anywhere in the codebase** (grep returns 0 callers in `src/`).
  * The 5 edge functions in `supabase/functions/*/index.ts` — correct, those run on the server.
* **No API keys are hardcoded in the source**. `.env.local` is in `.gitignore` (confirmed by repo structure: `.env.local` is present but is a local file; `.env.example` is the template).
* `src/lib/utils/export-pdf.ts` is dead code so it doesn't leak anything.


  * `@radix-ui/react-checkbox` — declared but no component uses it; admin/members uses a raw `<input type="checkbox">`.
### Input validation

* The signup page validates `name.length >= 3` and `password.length >= 6` (browser-native `required` + `minLength`).
* The name-availability check is a `SELECT` against `profiles.anonymous_name` (line 71-78 of signup). The query is parameterized via Supabase's `.eq()` — no SQL injection.
* The MessageInput allows `content` to be **any string** including newlines, mentions, GIF URLs. There is **no content-length limit on the client or in the DB schema** (`messages.content TEXT` in migration 001) — a user can paste 10MB of text and it goes through.
* The chat room search (`chat/[roomId]/page.tsx`) and global search (`/search`) use `ilike '%query%'` — the query string is bound by the Supabase client, so SQL injection is not possible. But the query is **not sanitized for ILIKE wildcards** (a user typing `%` matches everything).
* Admin form for room create (`admin/rooms/page.tsx`) inserts `name`, `description`, `icon_emoji`, `accent_color` etc. **Without length limits**. A 1MB room name is accepted.
* `MessageItem.tsx` calls `onEdit(messageId, content)` and `onEdit` is `editMessage` from the hook, which calls `.update({ content, is_edited: true })`. The hook **does not validate** `content` before sending.

### Rate limiting

* **No rate limiting on the Next.js app side.**
* `invite-signup` edge function: no rate limit; CORS is `*` (line 21 of `invite-signup/index.ts`) — any origin can call it.
* `verify-room-password` edge function: per-IP rate limit of 10/min (line 36-77 of `verify-room-password/index.ts`) using an in-memory `Map` on `globalThis` — **this is per-instance**, so in a multi-instance deployment each instance has its own bucket, effectively multiplying the limit by the instance count. The comment acknowledges this. CORS is locked to a single `ALLOWED_ORIGIN` env var.
* `expire-messages`, `daily-starter`, `weekly-highlights` edge functions: no rate limit and no CORS check.
* **AI/LLM calls: none present** (Tenor is a non-AI GIF API, no LLM is used anywhere).

### Other security notes

* `src/lib/supabase/server.ts:7-23` swallows errors with `try { cookies().set(...) } catch {}` — Supabase requires this for Server Components.
* `SUPABASE_SERVICE_ROLE_KEY` in `getServiceRoleClient` (server.ts:38-51) bypasses RLS by design. The function is **never called from any importable code path**, but it is exported and could be misused in future code. Consider inlining it into the edge functions and removing the export.
* `search/page.tsx` exposes `result.rooms.name` and `result.rooms.icon_emoji` to any user — the `messages` RLS already filtered to rooms they can access, so this is safe.
* `usePresence.ts:160-168` runs `callerId` in the verify-room-password edge function by reading `authHeader` — but the supabase client trusts the JWT, so a stolen JWT would let a user verify any room. The room password itself is bcrypt-hashed (when set via edge function) — but `verify-room-password/index.ts:181-200` falls back to **plaintext compare** if the stored hash doesn't start with `$2` — and migration 008's seed data is plaintext. So room passwords that were created before 008 are stored in plaintext in the DB. Anyone with read access to the DB (admin SQL console) can read all room passwords.

## 7. Performance Audit

### Bundle red flags

* `src/app/chat/[roomId]/page.tsx` is a `'use client'` file but is **huge** (~640 lines, imports 10+ components). It could be split into a server-component shell that imports only the message-list and message-input client components. Currently the **chat page is fully client-rendered** — no SSR for the initial shell.
* `src/app/chat/ChatLayoutClient.tsx`, `LeftSidebar.tsx`, `RightSidebar.tsx`, `IconRail.tsx`, `SettingsModal.tsx` are all `'use client'`. The chat shell is 100% client.
* `src/app/admin/analytics/page.tsx` imports `recharts`. Recharts is **~100KB** gzipped. The page is `'use client'` so the entire recharts bundle is in the admin chunk. Could be dynamic-imported: `const Recharts = dynamic(() => import('recharts'))`.
* `jspdf` is in the `lib/utils/` but is dead code (no callers). If re-introduced, must be `dynamic({ ssr: false })` or only loaded on the export button click.
* `react-window` is in dependencies but never used — would have been a good fit for the messages list (which currently does `.map()` over up to 100 messages, fine, but for rooms with 1000+ messages it would be a problem).
* `useMessages` does not memoize the `messages` array — every `upsertMessage` / `removeMessage` produces a new array, causing `MessageList` to re-render its entire tree.
* `MessageList.tsx` does not memoize `MessageItem` children. With 100 messages, every realtime message triggers a re-render of the whole list.

### Images

* **No `next/image` usage anywhere**. All images are raw `<img>` tags:
  * `MessageItem.tsx:148-160` — `<img src={url} alt={alt} loading="lazy" />` for GIFs. Lacks `width`/`height` (causes CLS).
  * `GifPickerModal.tsx:90-95` — `<img src={gif.media_formats?.tinygif?.url} loading="lazy" />` for picker thumbnails. No `width`/`height`.
  * `Avatar` / `AvatarImage` from Radix is declared but never used (only `AvatarFallback`).
* GIF URLs come from Tenor's CDN — no `next/image` proxy, no Supabase image transforms.
* `chat-media` storage bucket is public; uploaded images are referenced by full Supabase storage URLs.

### Database

* `useMessages` fetches `select *` from `messages` (line 102) — fetches every column for every message. The list only needs `id, content, user_id, room_id, created_at, is_edited, is_deleted, reply_to, expires_at, is_flagged` — `is_pinned` and `is_flagged` are not used in the list view.
* `useMessages` then does **3 separate queries** for the same room: messages, reactions (all reactions in the room), and reply_context (all messages referenced as replies). For 100 messages with 5 reactions each, this is 5 round-trips minimum.
* `useMessages` has no pagination — `limit = 100` (line 62). A room with 100+ messages **loses older messages on reload** and there is no "load more" UI.
* `LeftSidebar.tsx` `loadRooms` has no `limit`. With 1000 rooms, the sidebar would render 1000 list items.
* `admin/analytics/page.tsx` `loadData` fetches **all** messages from the time window with `select('created_at')` — for a 30-day window on a busy room, this is tens of thousands of rows transferred.
* `admin/analytics/page.tsx` line 95 also does a second `select('room_id, rooms!inner(name, icon_emoji)')` — duplicates the message fetch.
* `admin/reports/page.tsx` `auto-flagged` branch loads flagged messages but the join result type is forced via cast.
* `search/page.tsx` `ilike` search **scans the entire `messages` table** for the query. No `tsvector` index is used (even though `idx_messages_search` GIN index was created in `001_initial_schema.sql:77`).
* `bookmarks/page.tsx` does not use the `idx_bookmarks_user` index for ordering by `created_at` (the index is on `(user_id)` only).

### Re-render / memoization

* `useMessages` returns a fresh `messages` array on every change. `MessageList` receives it as a prop and re-renders the full tree.
* `MessageItem` is **not wrapped in `React.memo`**. With 100 messages, any change to one message re-renders all 100.
* `MessageInput.tsx` `setContent` triggers a `useEffect` that re-computes `textarea.style.height` on every keystroke.
* `usePolls.ts` re-fetches all polls + votes on every realtime event. (The hook was improved — see comment in `usePolls.ts:38` — but `MessageList.tsx:67-89` **re-fetches all polls on every event** still, because the channel is `'*'` event filter.)
* `MessageList.tsx:67-89` polls channel uses event `'*'` and on every event calls `loadPolls()` — full re-fetch. This is N polls × M events. A `usePolls` (incremental) hook exists; `MessageList` does not use it.
* `usePresence` opens a separate channel from `RightSidebar`'s `usePresence` (which also opens a channel) — two channels, two subscriptions, two presence tracks for the same user.

### Third-party / AI calls
## 8. SEO & Metadata

* **The app is intentionally not indexed** — `layout.tsx:30` sets `robots: { index: false, follow: false }` for the entire site. This is correct for an internal company tool.
* **No per-page `<title>`** is set. Every page renders inside the root layout's `metadata.title: 'UnderTable'`. Page tabs all show "UnderTable" — not "UnderTable · #general" etc.
* **No `metadata` export in any page.tsx** (only `layout.tsx` has one).
* **No Open Graph / Twitter cards** (`openGraph`, `twitter` are absent from `metadata`).
* **No `sitemap.ts` or `robots.txt`**. Even though the app is noindex, having a `robots.txt` that explicitly disallows indexing is best practice.
* **No structured data** (JSON-LD) — not needed for an internal chat app, but worth noting.
* **HTML semantics**:
  * The chat page has **no `<main>` landmark** outside `ChatLayoutClient.tsx:133` (a `<main className="flex-1 flex flex-col min-w-0 glass-chat">` is rendered around `children`). The admin pages are also `<main>` (line 125 of `admin/layout.tsx`). OK.
  * **`MessageItem.tsx:409-579` uses `<div>` for the message body** — a `<article>` per message would be more semantic.
  * The chat header in `chat/[roomId]/page.tsx:412-460` has `<h1>` but the title is `text-sm` — visually subordinate to the buttons next to it.
  * The `<form>` elements in `Login`, `Signup`, `AdminFilters`, `AdminStarters`, `RoomSettingsModal` are correct.
  * `RoomSettingsModal` has a Switch wrapped in a `<div>` (line 220) instead of `<label>`.
  * `MessageInput.tsx` textarea has no associated `<label>`.
* **No skip-to-content link** for keyboard / screen reader users.
* **`<html lang="en">`** is set in `layout.tsx:47` — good.

---



* No AI calls. Tenor is a non-AI GIF search.
## 9. Scoring Summary

| Category                | Score | One-line justification |
|-------------------------|-------|------------------------|
| **Features**            | 6/10  | Most advertised features work, but ~6 are missing (push, hot topics, leaderboard, theme switcher, digest export, on-message pin indicator); `export-pdf` is dead code. |
| **UX**                  | 6/10  | Polished visuals, but mobile layout is broken (3-pane overflow), key journeys have dead ends (mobile hamburger, block list reload, confession TTL copy), silent errors throughout. |
| **UI / Design consistency** | 5/10 | Aurora glassmorphism is cohesive, but 9+ border-radii for "card", 5 near-black hex values, inconsistent avatar backgrounds, no semantic heading hierarchy, hard-coded colors bypass tokens. |
| **Code quality**        | 6/10  | Hooks are well-isolated and most bugs are commented, but 3 god components (~600 lines each), 26 deps of which ~7 are unused, no shared data layer, no Context, prop drilling. |
| **Security**            | 7/10  | RLS is comprehensive and 007 closed the 2 critical holes, but `profiles.role` is client-mutable, no `profiles` row is created on signup (silent break for non-bootstrap users), plaintext room passwords persist from the legacy seed, in-memory rate-limit doesn't scale. |
| **Performance**         | 6/10  | Realtime incremental updates in some hooks, but `MessageList` does full poll re-fetches, no `next/image`, no pagination, no memoization, every `<img>` lacks width/height (CLS), no parallelization in `useMessages`. |
| **SEO**                 | 5/10  | Intentionally noindex (correct), but no per-page titles, no OG tags, no robots.txt, no `<article>` semantics for messages. |
| **Overall**             | 6/10  | A genuinely useful internal product with strong security foundations, but the silent profile-creation break, dead `export-pdf`, mobile layout, and hard-coded design system will keep showing up in incident reports until fixed. |

## 10. Prioritized Improvement Roadmap

### P0 — Critical (security holes / broken core features / data loss)

**[P0] No automatic `profiles` row creation on signup**
- Where: `src/app/signup/page.tsx:96-130`; no `auth.users → profiles` trigger in any migration.
- Problem: A brand-new user gets an `auth.users` row but no `profiles` row, so they can never be approved (admin can't find them in `/admin/members`) and the app is in a broken state until a DBA runs the manual SQL from the README.
- Suggested fix: Add a SQL trigger in a new migration `010_profiles_signup_trigger.sql`: `CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION create_profile_for_new_user();` and the function inserts a `profiles` row with `status='pending'`, a generated `anonymous_name`, and `avatar_color`.
- Effort: **S**.

**[P0] `profiles.role` is client-mutable via `profiles_update_own`**
- Where: `supabase/migrations/002_rls_policies.sql:74-76`.
- Problem: A user can run `supabase.from('profiles').update({ role: 'admin' }).eq('id', user.id)` from DevTools and become admin.
- Suggested fix: Replace the broad `WITH CHECK (id = auth.uid() OR is_admin())` with a column-restricted variant that **excludes `role`** (e.g. revoke UPDATE on `role` and `status` for non-admins via separate policies, or move the `role`/`status` mutations behind edge functions that re-check the caller's role server-side).
- Effort: **M**.

**[P0] `verify-room-password` accepts plaintext stored passwords (legacy seed)**
- Where: `supabase/functions/verify-room-password/index.ts:181-200`; `supabase/seed.sql` does not set passwords but any pre-008 production row has a plaintext password.
- Problem: Any user with DB read access (DBA, leaked backup) can read all room passwords in plaintext.
- Suggested fix: Add migration `010_rehash_room_passwords.sql` that re-hashes every non-`$2` `room_password` value via `crypt(...)` and drop the plaintext-comparison branch in the edge function.
- Effort: **S**.

**[P0] `invite-signup` edge function has `*` CORS and no rate limit**
- Where: `supabase/functions/invite-signup/index.ts:21-23, 30-100`.
- Problem: Any origin can claim invite codes (race / enumeration) and there is no abuse protection.
- Suggested fix: Restrict CORS to `ALLOWED_ORIGIN` env var (mirroring `verify-room-password`) and add the same per-IP rate-limit pattern.
- Effort: **S**.

**[P0] `MessageList.tsx:67-89` re-fetches all polls + votes on every realtime event**
- Where: `src/components/chat/MessageList.tsx`.
- Problem: A busy room with 10 polls and 100 votes per poll triggers a full re-fetch on every vote / reaction / message event. O(n²) per minute.
- Suggested fix: Use the existing `usePolls` hook (already in `src/hooks/usePolls.ts`) which has incremental event handling, and pass polls down to `PollCard` instead of `MessageList` querying directly.
### P1 — High (major UX friction / big design inconsistencies / perf users will feel)

**[P1] Mobile layout broken: 3-pane overflow + non-functional hamburger**
- Where: `src/app/chat/ChatLayoutClient.tsx:111-118` (hamburger), `RightSidebar.tsx:24-37` (fixed 200px), `LeftSidebar.tsx` (fixed 224px).
- Problem: 58 + 224 + 200 = 482px on a 360px screen; hamburger does nothing.
- Suggested fix: Hide `LeftSidebar` and `RightSidebar` on `<lg`, render them as slide-over drawers controlled by `sidebarOpen` (LeftSidebar) and a new toggle (RightSidebar); make the hamburger actually toggle.
- Effort: **M**.

**[P1] Room password prompt is bypassable via direct Supabase API call (only sessionStorage gate)**
- Where: `src/components/layout/LeftSidebar.tsx` (password gate), `supabase/migrations/007_rls_hardening.sql` (fixed server-side).
- Problem: 007 added `verified_room_access` to enforce server-side, but the **client-side** check on which `useMessages` and other hooks depend is still the old sessionStorage. RLS would block the actual reads, but the **room list and member list still display the password-protected room in the sidebar**.
- Suggested fix: Filter `LeftSidebar` to hide rooms where `has_password===true && !verifiedAccess.has(roomId)`, and have the verify edge function write to a client-readable cache that is invalidated on logout.
- Effort: **M**.

**[P1] No `profiles` row → no admin discoverability for non-bootstrap users (P0 above is the trigger; P1 is the admin UI)**
- Where: `src/app/admin/members/page.tsx`.
- Problem: Even after the trigger is added, the admin needs a way to set the `anonymous_name` (currently user-chosen at signup). The signup form already picks a name, so the trigger can read it from `raw_user_meta_data` or a server function.
- Suggested fix: Pass `anonymous_name` + `avatar_color` from signup via `auth.signUp({ options: { data: { anonymous_name, avatar_color } } })`; the trigger reads them and creates the row.
- Effort: **S**.

**[P1] `MessageItem.tsx` and `MessageList.tsx` not memoized; full-list re-renders**
- Where: `src/components/chat/MessageList.tsx`, `src/components/chat/MessageItem.tsx`.
- Problem: With 100 messages, every state change re-renders every `MessageItem`.
- Suggested fix: Wrap `MessageItem` in `React.memo` with a custom comparator on `message.id`, `is_edited`, `reactions.length`, `isOwn`; memoize the `messages` array in `useMessages` so the parent `MessageList` doesn't re-render unnecessarily.
- Effort: **S**.

**[P1] `useMessages` fetches `select *` and 3 sequential queries**
- Where: `src/hooks/useMessages.ts:99-130`.
- Problem: `select *` returns all columns; reactions / replies fetched in sequence.
- Suggested fix: `select('id, content, user_id, room_id, created_at, is_edited, is_deleted, reply_to, expires_at')`; use `Promise.all` for the 3 fetches.
- Effort: **S**.

**[P1] `useMessages.error` is set but never displayed**
- Where: `src/hooks/useMessages.ts:312-314`; `src/app/chat/[roomId]/page.tsx:67` destructures but never uses.
- Problem: User sees "Realtime connection lost" only in console; UI shows stale messages forever.
- Suggested fix: Render a top-of-chat banner when `error` is non-null with a "Retry" button that calls `refresh()`.
- Effort: **S**.

**[P1] Confession-box copy is hard-coded "1 hour"**
- Where: `src/components/chat/MessageList.tsx:211`.
- Problem: TTL is configurable per room in admin; the chat always says "1 hour".
- Suggested fix: Read `room.message_ttl_seconds` and interpolate: `Messages auto-delete after ${formatTtl(ttl)}`.
- Effort: **XS**.

**[P1] `usePresence` instantiated twice in same tree**
- Where: `src/app/chat/[roomId]/page.tsx:71`, `src/components/layout/RightSidebar.tsx:16`.
- Problem: Two channels for the same presence data; throttling logic duplicated.
- Suggested fix: Lift `usePresence` into `ChatLayoutClient` (which already wraps both consumers) and pass `visibleUsers` / `typingUsers` down.
- Effort: **M**.

**[P1] Block list not loaded into `useMessages` initial fetch**
- Where: `src/hooks/useMessages.ts`, `src/app/chat/[roomId]/page.tsx:45` (`blockedUserIds`).
- Problem: Page reload shows previously-blocked users' messages again.
- Suggested fix: On room mount, fetch `blocks.blocked_id` for current user, pass into `useMessages` filter.
- Effort: **S**.

**[P1] Read-only rooms: prop wired, no UX**
- Where: `src/components/chat/MessageInput.tsx:75`, `src/app/chat/[roomId]/page.tsx:539`.
- Problem: Admin can set `is_readonly=true` but users can still type.
- Suggested fix: When `isReadonly===true`, render a non-editable banner and disable the textarea in `MessageInput`.
- Effort: **XS**.


- Effort: **S**.


---


* `GifPickerModal.tsx:39-43` calls `https://tenor.googleapis.com/v2/search?...` **directly from the client**, exposing the `NEXT_PUBLIC_TENOR_API_KEY` in the URL. This is a known concern with Tenor's public API but the key is rate-limited to referrer + IP. Acceptable for a low-stakes internal tool.
* No parallelization of the messages + reactions + replies fetches (sequential `await`).
* No loading feedback for slow network calls beyond the initial route spinner.


---


### P2 — Medium (code quality / minor UX polish)

**[P2] Two different `bg-primary-gradient` definitions (CSS vs Tailwind)**
- Where: `src/app/globals.css:111` and `tailwind.config.ts:57`.
- Problem: Same class name, two different gradients.
- Suggested fix: Pick one (Tailwind config), delete the other.
- Effort: **XS**.

**[P2] Inconsistent border-radius across "card" containers (9 values)**
- Where: every `rounded-[Npx]` in `src/app/`, `src/components/`.
- Problem: Visual inconsistency.
- Suggested fix: Define `rounded-card: 14px`, `rounded-input: 13px`, `rounded-icon: 11px` in Tailwind config and use them. (Already in `theme.extend.borderRadius` — but not used.)
- Effort: **M**.

**[P2] Color contrast: `text-[#56566E]` fails AA**
- Where: ~30 places including `admin/layout.tsx`, `MessageItem.tsx`, etc.
- Problem: Body text fails 4.5:1 contrast.
- Suggested fix: Replace with `text-text/secondary` (`rgba(255,255,255,0.7)`) or a token like `--text-muted: rgba(255,255,255,0.55)`.
- Effort: **M**.

**[P2] 5 unused `@radix-ui/*` and 3 other unused dependencies**
- Where: `package.json` lines 12-46.
- Problem: Bundle bloat (small) and cognitive overhead.
- Suggested fix: Remove `@radix-ui/react-alert-dialog`, `react-checkbox`, `react-dropdown-menu`, `react-popover`, `emoji-mart`, `@emoji-mart/data`, `react-window`, `date-fns`, `jspdf` (jspdf is dead code, see below).
- Effort: **XS**.

**[P2] `useReactions` hook defined but never imported**
- Where: `src/hooks/useReactions.ts`.
- Problem: Dead code (also see P2 dead code).
- Suggested fix: Either remove or refactor `MessageItem` to use it.
- Effort: **XS**.

**[P2] `export-pdf.ts` is dead code**
- Where: `src/lib/utils/export-pdf.ts`.
- Problem: Maintains unused 400KB dep, no UI surfaces it.
- Suggested fix: Either wire an "Export PDF" button on `/admin/rooms` (would also need room selection UI) or delete the file + the `jspdf` dep.
- Effort: **S**.

**[P2] Two styles of Supabase client creation**
- Where: `useRef(createClient()).current` (most files), `useMemo(() => createClient(), [])` (`useMessages.ts:67`), bare `createClient()` (`IconRail.tsx:23`, etc.).
- Problem: Inconsistency, accidental re-creation in some paths.
- Suggested fix: Standardise on `useRef`; remove the `useMemo` in `useMessages`.
- Effort: **XS**.

**[P2] "Active Today" stat is permanently 0; `recentActions` is unused**
- Where: `src/app/admin/page.tsx:25, 53`.
- Problem: Misleading dashboard.
- Suggested fix: Remove the card or populate it from `profiles.last_sign_in_at` (requires schema change) or `profiles.created_at` (today). Remove `recentActions`.
- Effort: **XS**.

**[P2] God components: `MessageItem`, `MessageInput`, `LeftSidebar`, `SettingsModal`, `chat/[roomId]/page.tsx`**
- Where: as above.
- Problem: Hard to navigate, hard to test.
- Suggested fix: Extract `<MessageHeader>`, `<MessageActions>`, `<MessageSearch>`, `<Modals>` from the chat page; split `MessageInput` into `<MessageTextarea>` + `<EmojiPicker>` + `<MentionMenu>`; split `SettingsModal` into the 4 tabs.
- Effort: **L**.

**[P2] Per-page `<title>` missing**
- Where: every `page.tsx`.
- Problem: Tab title is always "UnderTable".
- Suggested fix: Export `metadata` from each `page.tsx` (e.g. `export const metadata: Metadata = { title: 'Members · Admin · UnderTable' }`).
- Effort: **XS**.

**[P2] No robots.txt**
- Where: repo root.
- Problem: The site is noindex via `<meta>` but a missing `robots.txt` makes the intent unclear.
- Suggested fix: Add `app/robots.ts` returning `User-agent: *\nDisallow: /`.
- Effort: **XS**.


  * `@radix-ui/react-dropdown-menu` — declared but no component uses it; LeftSidebar uses a custom context menu.
  * `@radix-ui/react-popover` — declared but no component uses it; emoji picker is a custom popover.
* **Outdated** (last release >12 months ago at audit time): `lucide-react ^0.400.0` is well behind current. `recharts ^2.12.0` is current. `next 14.2.35` is current. `next-themes ^0.3.0` is current.
* **Heavy alternatives**:
  * `jspdf` (~400KB) is loaded by `export-pdf.ts` but never imported. If kept, it should be dynamically imported.
* `useMemo` is used in `useMessages.ts:67` (creating the Supabase client!) — wasteful; should be `useRef`.

---



  * `chat/[roomId]/page.tsx` drills 8 callback props into `MessageList` and 10 props into `MessageItem`. A `useRoomActions(roomId)` context would be cleaner.







* `useMessages` and `usePolls` and `usePresence` each open their own realtime channel — on a phone this means 3-4 long-lived WebSocket connections, no channel sharing.
### P3 — Nice-to-have

**[P3] Hot topics feed**
- Where: README mentions; no code.
- Problem: Not implemented.
- Suggested fix: New table `hot_topics` populated by a cron edge function (similar to `weekly-highlights`), and a `HotTopicsSidebar` component in `LeftSidebar`.
- Effort: **M**.

**[P3] Reaction leaderboard**
- Where: README mentions; `hide_from_leaderboard` column exists in `profiles` but no UI.
- Problem: Not implemented.
- Suggested fix: A `/leaderboard` page or sidebar widget; SQL: `SELECT user_id, COUNT(*) FROM reactions GROUP BY user_id ORDER BY 2 DESC LIMIT 10`.
- Effort: **M**.

**[P3] Push notifications via Browser Push API**
- Where: README mentions; no SW, no `Notification` API.
- Problem: Saved notification preferences have no effect.
- Suggested fix: Add `public/sw.js`, request permission in Settings, show browser notifications when a new message arrives in a non-muted room.
- Effort: **L**.

**[P3] Theme switcher (light / dark)**
- Where: `next-themes` is installed with `attribute="class"` but the entire UI is hard-coded dark.
- Problem: The infra is there; the styling is not.
- Suggested fix: Add a `Theme` tab to `SettingsModal` that toggles `next-themes`; refactor every hard-coded color to use semantic tokens (`bg-surface`, `text-fg-primary`, etc.).
- Effort: **L** (this is a large design-system refactor).

**[P3] Per-room "Mute" persistence (currently localStorage)**
- Where: `src/components/layout/LeftSidebar.tsx:65` (loadMutedRooms).
- Problem: Mute state is per-browser, not per-user.
- Suggested fix: Use the existing `notification_preferences` table with `level: 'muted'`.
- Effort: **S**.

**[P3] GIF alt text from Tenor response**
- Where: `src/components/chat/GifPickerModal.tsx:90-95`, `MessageItem.tsx:148-160`.
- Problem: Alt text is always "GIF" (or "Shared GIF").
- Suggested fix: Use Tenor's `content_description` field if present; fall back to user's filename.
- Effort: **XS**.

**[P3] Drag-to-upload image attachment**
- Where: `MessageInput.tsx:5` imports `Image` icon but the button does nothing.
- Problem: Implied feature, not built.
- Suggested fix: Wire to `chat-media` storage upload, insert message with image URL.
- Effort: **M**.

**[P3] Custom emoji reactions (admin-curated set)**
- Where: `ReactionBar.tsx:13` hard-codes 5 reactions.
- Problem: Reactions cannot be admin-managed.
- Suggested fix: Move the list to a `reactions` table seeded by `seed.sql`; admin CRUD in `/admin`.
- Effort: **M**.

**[P3] Search by author / room / date**
- Where: `src/app/search/page.tsx`.
- Problem: Free-text only.
- Suggested fix: Add filter chips above the search input.
- Effort: **S**.

**[P3] Slow mode countdown in room header (currently only in input)**
- Where: `src/components/chat/MessageInput.tsx:148-160`.
- Problem: Other users can't see if a room is in slow mode.
- Suggested fix: Show a chip in the room header.
- Effort: **XS**.

**[P3] Audit log of admin actions (approve/ban/delete)**
- Where: `src/app/admin/*/page.tsx`.
- Problem: No traceability of who did what.
- Suggested fix: Add an `admin_actions` table; insert in each admin handler; surface in `/admin/analytics` or a new `/admin/audit` page.
- Effort: **M**.

---

*End of audit.*

* The mobile `< 400px` viewport is **not explicitly designed for** anywhere.

---


3. Single approve or bulk select.
4. Optimistic removal from local list; toast on success.

**Friction:** The pending page polls every 10s; on approval the user bounces through a 1-3s loading flash before `/chat` mounts.

#### D. Block a user

1. Hover message → floating action bar → "Block" icon.
2. Confirmation dialog.
3. On confirm, inserts into `blocks`; the `blockedUserIds` state is updated **only in the current tab** — other tabs/devices see no change, and a page reload loses the block list.

**Friction:** blocks are not loaded on `useMessages` initial fetch. Reloading the chat shows un-blocked messages again until the user hovers a message and blocks each one in turn.


| 43 | Weekly highlights cron | `weekly-highlights` | **Complete** | Edge fn exists. |
| 44 | Expire messages cron | `expire-messages` | **Complete** | Edge fn exists. |
| 45 | Hot topics feed | README | **Missing** | No table, no UI. |
| 46 | Reaction leaderboard | README | **Missing** | `hide_from_leaderboard` column exists but no UI reads it. |


│   │   ├── layout.tsx            → ChatLayoutClient (auth-gated shell)
│   │   ├── page.tsx              Index → auto-redirect to first room
│   │   ├── ChatLayoutClient.tsx  3-pane chat shell
│   │   └── [roomId]/page.tsx     The actual chat page (~640 lines)
│   ├── search/                   Global message search (Ctrl+K)
│   ├── bookmarks/                Bookmarked messages page
│   └── admin/                    Admin panel (layout + 7 sub-pages)
├── components/
│   ├── ErrorBoundary.tsx         Top-level boundary
│   ├── ui/                       shadcn primitives (button, input, dialog, …)
│   ├── layout/                   IconRail, LeftSidebar, RightSidebar, SettingsModal
│   ├── chat/                     MessageList/Item/Input, Poll*, PinnedMessagesBar, …
│   └── admin/                    StatsCards
├── hooks/
│   ├── useMessages.ts            Real-time messages hook
│   ├── usePolls.ts               Real-time polls + votes
│   ├── usePresence.ts            Presence + typing channels
│   └── useReactions.ts           Local optimistic reaction toggling (defined, never imported)
├── lib/
│   ├── supabase/                 client, server, middleware, database.types
│   └── utils/                    cn, avatar-color, name-generator, time, keyword-filter, current-room, export-pdf
└── middleware.ts                 Route-level auth + profile-status guards
supabase/
├── migrations/                   9 SQL migrations
├── functions/                    5 Deno edge functions
└── seed.sql                      Default rooms + conversation starters
```

---


