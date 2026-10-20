// Generated from the Supabase schema (supabase gen types), trimmed to what the app uses.
// Regenerate after schema changes.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      families: {
        Row: {
          created_at: string
          id: string
          key: string
          name: string
          numbers: string
          user_id: string
          vibe: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          name: string
          numbers: string
          user_id?: string
          vibe?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          name?: string
          numbers?: string
          user_id?: string
          vibe?: string | null
        }
        Relationships: []
      }
      session_songs: {
        Row: {
          session_id: string
          song_id: string
        }
        Insert: {
          session_id: string
          song_id: string
        }
        Update: {
          session_id?: string
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_songs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          date: string
          focus: string | null
          how_it_went: string | null
          id: string
          minutes: number
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          focus?: string | null
          how_it_went?: string | null
          id?: string
          minutes: number
          notes?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          date?: string
          focus?: string | null
          how_it_went?: string | null
          id?: string
          minutes?: number
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sets: {
        Row: {
          created_at: string
          id: string
          name: string | null
          notes: string | null
          room: string | null
          song_ids: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          notes?: string | null
          room?: string | null
          song_ids: string[]
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          notes?: string | null
          room?: string | null
          song_ids?: string[]
          user_id?: string
        }
        Relationships: []
      }
      skills: {
        Row: {
          area: string
          id: string
          is_focus: boolean
          level: string
          name: string
          user_id: string
        }
        Insert: {
          area: string
          id?: string
          is_focus?: boolean
          level: string
          name: string
          user_id?: string
        }
        Update: {
          area?: string
          id?: string
          is_focus?: boolean
          level?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      songs: {
        Row: {
          artist: string | null
          chords: string | null
          created_at: string
          difficulty: string | null
          family_id: string | null
          first_line_hint: string | null
          id: string
          key_capo: string | null
          last_practised: string | null
          lyrics: string | null
          my_capo: number | null
          my_transpose: number
          needs_verify: boolean
          notes: string | null
          status: string
          style: string | null
          tab_link: string | null
          title: string
          user_id: string
        }
        Insert: {
          artist?: string | null
          chords?: string | null
          created_at?: string
          difficulty?: string | null
          family_id?: string | null
          first_line_hint?: string | null
          id?: string
          key_capo?: string | null
          last_practised?: string | null
          lyrics?: string | null
          my_capo?: number | null
          my_transpose?: number
          needs_verify?: boolean
          notes?: string | null
          status: string
          style?: string | null
          tab_link?: string | null
          title: string
          user_id?: string
        }
        Update: {
          artist?: string | null
          chords?: string | null
          created_at?: string
          difficulty?: string | null
          family_id?: string | null
          first_line_hint?: string | null
          id?: string
          key_capo?: string | null
          last_practised?: string | null
          lyrics?: string | null
          my_capo?: number | null
          my_transpose?: number
          needs_verify?: boolean
          notes?: string | null
          status?: string
          style?: string | null
          tab_link?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "songs_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      log_session: {
        Args: {
          p_minutes: number
          p_date?: string | null
          p_focus?: string | null
          p_how_it_went?: string | null
          p_notes?: string | null
          p_song_ids?: string[]
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicTables = Database["public"]["Tables"]

export type Tables<T extends keyof PublicTables> = PublicTables[T]["Row"]
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]["Insert"]
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]["Update"]
