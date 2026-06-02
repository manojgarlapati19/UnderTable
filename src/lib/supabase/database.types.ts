export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          anonymous_name: string
          role: 'user' | 'admin'
          status: 'pending' | 'approved' | 'banned'
          avatar_color: string
          ghost_mode: boolean
          hide_from_leaderboard: boolean
          identity_reset_at: string | null
          created_at: string
        }
        Insert: {
          id: string
          anonymous_name: string
          role?: 'user' | 'admin'
          status?: 'pending' | 'approved' | 'banned'
          avatar_color: string
          ghost_mode?: boolean
          hide_from_leaderboard?: boolean
          identity_reset_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          anonymous_name?: string
          role?: 'user' | 'admin'
          status?: 'pending' | 'approved' | 'banned'
          avatar_color?: string
          ghost_mode?: boolean
          hide_from_leaderboard?: boolean
          identity_reset_at?: string | null
          created_at?: string
        }
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
          slow_mode_seconds: number
          is_readonly: boolean
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
          slow_mode_seconds?: number
          is_readonly?: boolean
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
          slow_mode_seconds?: number
          is_readonly?: boolean
          created_by?: string
          created_at?: string
        }
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
      }
      reports: {
        Row: {
          id: string
          message_id: string
          reported_by: string
          reason: string
          status: 'pending' | 'reviewed' | 'dismissed'
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          reported_by: string
          reason: string
          status?: 'pending' | 'reviewed' | 'dismissed'
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          reported_by?: string
          reason?: string
          status?: 'pending' | 'reviewed' | 'dismissed'
          created_at?: string
        }
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
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
