export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/**
 * Relationship between two Supabase tables.
 *
 * The Supabase JS client requires every entry of
 * `Database['public']['Tables'][name]` to have a `Relationships` key, even
 * if the relationship graph is unknown (we just pass `[]`). Without this
 * key the generated client collapses query results to `never` and
 * `.insert(...)` / `.update(...)` calls fail to type-check.
 */
type DbRelationship = {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          anonymous_name: string
          role: 'user' | 'admin'
          status: 'pending' | 'approved' | 'rejected' | 'banned'
          avatar_color: string
          ghost_mode: boolean
          hide_from_leaderboard: boolean
          identity_reset_at: string | null
          theme: string
          notifications_enabled: boolean
          is_admin: boolean
          created_at: string
        }
        Insert: {
          id: string
          anonymous_name: string
          role?: 'user' | 'admin'
          status?: 'pending' | 'approved' | 'rejected' | 'banned'
          avatar_color: string
          ghost_mode?: boolean
          hide_from_leaderboard?: boolean
          identity_reset_at?: string | null
          theme?: string
          notifications_enabled?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          anonymous_name?: string
          role?: 'user' | 'admin'
          status?: 'pending' | 'approved' | 'rejected' | 'banned'
          avatar_color?: string
          ghost_mode?: boolean
          hide_from_leaderboard?: boolean
          identity_reset_at?: string | null
          theme?: string
          notifications_enabled?: boolean
          created_at?: string
        }
        Relationships: DbRelationship[]
      }
      rooms: {
        Row: {
          id: string
          name: string
          description: string
          icon_emoji: string
          accent_color: string
          is_private: boolean
          is_confession_box: boolean
          message_ttl_hours: number | null
          message_ttl_seconds: number | null
          slow_mode_seconds: number
          is_readonly: boolean
          is_active: boolean
          has_password: boolean
          room_password: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string
          icon_emoji?: string
          accent_color?: string
          is_private?: boolean
          is_confession_box?: boolean
          message_ttl_hours?: number | null
          message_ttl_seconds?: number | null
          slow_mode_seconds?: number
          is_readonly?: boolean
          is_active?: boolean
          has_password?: boolean
          room_password?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          icon_emoji?: string
          accent_color?: string
          is_private?: boolean
          is_confession_box?: boolean
          message_ttl_hours?: number | null
          message_ttl_seconds?: number | null
          slow_mode_seconds?: number
          is_readonly?: boolean
          is_active?: boolean
          has_password?: boolean
          room_password?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: DbRelationship[]
      }
      room_members: {
        Row: {
          id: string
          room_id: string
          user_id: string
          added_by: string
          added_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          added_by: string
          added_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string
          added_by?: string
          added_at?: string
        }
        Relationships: DbRelationship[]
      }
      messages: {
        Row: {
          id: string
          room_id: string
          user_id: string
          content: string
          reply_to: string | null
          is_edited: boolean
          is_deleted: boolean
          is_pinned: boolean
          is_flagged: boolean
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          content: string
          reply_to?: string | null
          is_edited?: boolean
          is_deleted?: boolean
          is_pinned?: boolean
          is_flagged?: boolean
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string
          content?: string
          reply_to?: string | null
          is_edited?: boolean
          is_deleted?: boolean
          is_pinned?: boolean
          is_flagged?: boolean
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: DbRelationship[]
      }
      reactions: {
        Row: {
          id: string
          message_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          emoji?: string
          created_at?: string
        }
        Relationships: DbRelationship[]
      }
      read_receipts: {
        Row: {
          id: string
          message_id: string
          user_id: string
          seen_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          seen_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          seen_at?: string
        }
        Relationships: DbRelationship[]
      }
      invite_links: {
        Row: {
          id: string
          code: string
          created_by: string
          uses_count: number
          max_uses: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          created_by: string
          uses_count?: number
          max_uses?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          created_by?: string
          uses_count?: number
          max_uses?: number | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: DbRelationship[]
      }
      polls: {
        Row: {
          id: string
          room_id: string
          created_by: string
          question: string
          options: Json
          is_closed: boolean
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          created_by: string
          question: string
          options?: Json
          is_closed?: boolean
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          created_by?: string
          question?: string
          options?: Json
          is_closed?: boolean
          expires_at?: string | null
          created_at?: string
        }
        Relationships: DbRelationship[]
      }
      poll_votes: {
        Row: {
          id: string
          poll_id: string
          user_id: string
          option_id: string
          created_at: string
        }
        Insert: {
          id?: string
          poll_id: string
          user_id: string
          option_id: string
          created_at?: string
        }
        Update: {
          id?: string
          poll_id?: string
          user_id?: string
          option_id?: string
          created_at?: string
        }
        Relationships: DbRelationship[]
      }
      bookmarks: {
        Row: {
          id: string
          user_id: string
          message_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          message_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          message_id?: string
          created_at?: string
        }
        Relationships: DbRelationship[]
      }
      blocks: {
        Row: {
          id: string
          blocker_id: string
          blocked_id: string
          created_at: string
        }
        Insert: {
          id?: string
          blocker_id: string
          blocked_id: string
          created_at?: string
        }
        Update: {
          id?: string
          blocker_id?: string
          blocked_id?: string
          created_at?: string
        }
        Relationships: DbRelationship[]
      }
      reports: {
        Row: {
          id: string
          message_id: string
          reported_by: string
          reason: string
          status: 'pending' | 'reviewed' | 'dismissed'
          resolved_by: string | null
          resolution: string | null
          resolved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          reported_by: string
          reason: string
          status?: 'pending' | 'reviewed' | 'dismissed'
          resolved_by?: string | null
          resolution?: string | null
          resolved_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          reported_by?: string
          reason?: string
          status?: 'pending' | 'reviewed' | 'dismissed'
          resolved_by?: string | null
          resolution?: string | null
          resolved_at?: string | null
          created_at?: string
        }
        Relationships: DbRelationship[]
      }
      notification_preferences: {
        Row: {
          id: string
          user_id: string
          room_id: string
          level: 'all' | 'mentions' | 'muted'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          room_id: string
          level?: 'all' | 'mentions' | 'muted'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          room_id?: string
          level?: 'all' | 'mentions' | 'muted'
          created_at?: string
        }
        Relationships: DbRelationship[]
      }
      pinned_messages: {
        Row: {
          id: string
          room_id: string
          message_id: string
          pinned_by: string
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          message_id: string
          pinned_by: string
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          message_id?: string
          pinned_by?: string
          created_at?: string
        }
        Relationships: DbRelationship[]
      }
      keyword_filters: {
        Row: {
          id: string
          word: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          word: string
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          word?: string
          created_by?: string
          created_at?: string
        }
        Relationships: DbRelationship[]
      }
      conversation_starters: {
        Row: {
          id: string
          question: string
          created_by: string | null
          posted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          question: string
          created_by?: string | null
          posted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          question?: string
          created_by?: string | null
          posted_at?: string | null
          created_at?: string
        }
        Relationships: DbRelationship[]
      }
    }
    // No Supabase Views / Functions / Enums exist in this schema.
    // IMPORTANT: use `{ [_ in never]: never }` (the supabase-CLI generated
    // shape), NOT `Record<string, never>` and NOT `{}`.
    //  * `Record<string, never>`: supabase-js's QueryBuilder types tables as
    //    `Tables & Views`; intersecting a real table object with
    //    `Record<string, never>` collapses every key to `never` and breaks
    //    `.insert` / `.eq` / `.single`.
    //  * `{}`: TypeScript's `no-empty-object-type` rule rejects it because
    //    `{}` is `NonNullable<unknown>` (allows `0`, `""`, etc.), not a
    //    truly empty object.
    // `{ [_ in never]: never }` is a mapped type with no keys — the same
    // shape the Supabase CLI emits — and is accepted by both the linter
    // and supabase-js.
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type Inserts<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type Updates<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
