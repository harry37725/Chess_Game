export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      active_games: {
        Row: {
          black_user: string
          black_username: string | null
          room_id: string
          started_at: string
          white_user: string
          white_username: string | null
        }
        Insert: {
          black_user: string
          black_username?: string | null
          room_id: string
          started_at?: string
          white_user: string
          white_username?: string | null
        }
        Update: {
          black_user?: string
          black_username?: string | null
          room_id?: string
          started_at?: string
          white_user?: string
          white_username?: string | null
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          from_user: string
          id: string
          status: string
          to_user: string
        }
        Insert: {
          created_at?: string
          from_user: string
          id?: string
          status?: string
          to_user: string
        }
        Update: {
          created_at?: string
          from_user?: string
          id?: string
          status?: string
          to_user?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          user_id?: string
        }
        Relationships: []
      }
      game_history: {
        Row: {
          id: string
          mode: string
          opponent: string
          played_at: string
          result: string
          user_id: string
        }
        Insert: {
          id?: string
          mode: string
          opponent: string
          played_at?: string
          result: string
          user_id: string
        }
        Update: {
          id?: string
          mode?: string
          opponent?: string
          played_at?: string
          result?: string
          user_id?: string
        }
        Relationships: []
      }
      game_invites: {
        Row: {
          created_at: string
          from_user: string
          id: string
          room_id: string
          status: string
          to_user: string
        }
        Insert: {
          created_at?: string
          from_user: string
          id?: string
          room_id: string
          status?: string
          to_user: string
        }
        Update: {
          created_at?: string
          from_user?: string
          id?: string
          room_id?: string
          status?: string
          to_user?: string
        }
        Relationships: []
      }
      matchmaking_queue: {
        Row: {
          color: string | null
          created_at: string
          max_rating: number
          min_rating: number
          opponent_id: string | null
          rating: number
          room_id: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          max_rating?: number
          min_rating?: number
          opponent_id?: string | null
          rating?: number
          room_id?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          max_rating?: number
          min_rating?: number
          opponent_id?: string | null
          rating?: number
          room_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      minigame_personal_bests: {
        Row: {
          best_stars: number
          best_time_seconds: number | null
          game_type: string
          last_played_at: string
          losses: number
          total_plays: number
          user_id: string
          wins: number
        }
        Insert: {
          best_stars?: number
          best_time_seconds?: number | null
          game_type: string
          last_played_at?: string
          losses?: number
          total_plays?: number
          user_id: string
          wins?: number
        }
        Update: {
          best_stars?: number
          best_time_seconds?: number | null
          game_type?: string
          last_played_at?: string
          losses?: number
          total_plays?: number
          user_id?: string
          wins?: number
        }
        Relationships: []
      }
      minigame_queue: {
        Row: {
          difficulty: string
          game_type: string
          joined_at: string
          matched: boolean
          opponent_id: string | null
          rating: number
          room_code: string | null
          user_id: string
        }
        Insert: {
          difficulty?: string
          game_type: string
          joined_at?: string
          matched?: boolean
          opponent_id?: string | null
          rating?: number
          room_code?: string | null
          user_id: string
        }
        Update: {
          difficulty?: string
          game_type?: string
          joined_at?: string
          matched?: boolean
          opponent_id?: string | null
          rating?: number
          room_code?: string | null
          user_id?: string
        }
        Relationships: []
      }
      minigame_rooms: {
        Row: {
          config: Json
          created_at: string
          difficulty: string
          game_type: string
          guest_role: string | null
          guest_user_id: string | null
          host_role: string | null
          host_user_id: string
          last_activity_at: string
          room_code: string
          status: string
        }
        Insert: {
          config?: Json
          created_at?: string
          difficulty?: string
          game_type: string
          guest_role?: string | null
          guest_user_id?: string | null
          host_role?: string | null
          host_user_id: string
          last_activity_at?: string
          room_code: string
          status?: string
        }
        Update: {
          config?: Json
          created_at?: string
          difficulty?: string
          game_type?: string
          guest_role?: string | null
          guest_user_id?: string | null
          host_role?: string | null
          host_user_id?: string
          last_activity_at?: string
          room_code?: string
          status?: string
        }
        Relationships: []
      }
      minigame_scores: {
        Row: {
          completion_time_seconds: number | null
          difficulty: string
          game_type: string
          id: string
          mode: string
          played_at: string
          stars: number
          user_id: string
          won: boolean
        }
        Insert: {
          completion_time_seconds?: number | null
          difficulty: string
          game_type: string
          id?: string
          mode: string
          played_at?: string
          stars?: number
          user_id: string
          won?: boolean
        }
        Update: {
          completion_time_seconds?: number | null
          difficulty?: string
          game_type?: string
          id?: string
          mode?: string
          played_at?: string
          stars?: number
          user_id?: string
          won?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          friend_code: string | null
          id: string
          minigame_rating: number
          rating: number
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          friend_code?: string | null
          id: string
          minigame_rating?: number
          rating?: number
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          friend_code?: string | null
          id?: string
          minigame_rating?: number
          rating?: number
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      training_levels: {
        Row: {
          coach_hint: string | null
          created_at: string
          difficulty: number
          fen: string
          goal: string
          id: string
          level_number: number
          move_limit: number | null
          solution_uci: string | null
          title: string
          type: string
          world: number
        }
        Insert: {
          coach_hint?: string | null
          created_at?: string
          difficulty?: number
          fen: string
          goal: string
          id?: string
          level_number: number
          move_limit?: number | null
          solution_uci?: string | null
          title: string
          type: string
          world: number
        }
        Update: {
          coach_hint?: string | null
          created_at?: string
          difficulty?: number
          fen?: string
          goal?: string
          id?: string
          level_number?: number
          move_limit?: number | null
          solution_uci?: string | null
          title?: string
          type?: string
          world?: number
        }
        Relationships: []
      }
      training_streak_days: {
        Row: {
          date: string
          user_id: string
        }
        Insert: {
          date: string
          user_id: string
        }
        Update: {
          date?: string
          user_id?: string
        }
        Relationships: []
      }
      user_level_progress: {
        Row: {
          attempts: number
          completed_at: string | null
          level_id: string
          stars: number
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          level_id: string
          stars?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          level_id?: string
          stars?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_level_progress_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "training_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      user_training_stats: {
        Row: {
          coins: number
          current_level_number: number
          current_world: number
          last_life_lost_at: string | null
          last_played_at: string | null
          lives: number
          streak: number
          total_stars: number
          updated_at: string
          user_id: string
        }
        Insert: {
          coins?: number
          current_level_number?: number
          current_world?: number
          last_life_lost_at?: string | null
          last_played_at?: string | null
          lives?: number
          streak?: number
          total_stars?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          coins?: number
          current_level_number?: number
          current_world?: number
          last_life_lost_at?: string | null
          last_played_at?: string | null
          lives?: number
          streak?: number
          total_stars?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_friendship_for_user: {
        Args: { p_friend_id: string; p_user_id: string }
        Returns: undefined
      }
      apply_match_result: {
        Args: { p_black: string; p_result: number; p_white: string }
        Returns: undefined
      }
      generate_friend_code: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
