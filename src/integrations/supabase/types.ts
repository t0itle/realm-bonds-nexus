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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      alliance_contracts: {
        Row: {
          alliance_id: string
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          reward_food: number
          reward_gold: number
          reward_stone: number
          reward_wood: number
          status: string
          title: string
        }
        Insert: {
          alliance_id: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          reward_food?: number
          reward_gold?: number
          reward_stone?: number
          reward_wood?: number
          status?: string
          title: string
        }
        Update: {
          alliance_id?: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          reward_food?: number
          reward_gold?: number
          reward_stone?: number
          reward_wood?: number
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alliance_contracts_alliance_id_fkey"
            columns: ["alliance_id"]
            isOneToOne: false
            referencedRelation: "alliances"
            referencedColumns: ["id"]
          },
        ]
      }
      alliance_members: {
        Row: {
          alliance_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          alliance_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          alliance_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alliance_members_alliance_id_fkey"
            columns: ["alliance_id"]
            isOneToOne: false
            referencedRelation: "alliances"
            referencedColumns: ["id"]
          },
        ]
      }
      alliance_messages: {
        Row: {
          alliance_id: string
          content: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          alliance_id: string
          content: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          alliance_id?: string
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alliance_messages_alliance_id_fkey"
            columns: ["alliance_id"]
            isOneToOne: false
            referencedRelation: "alliances"
            referencedColumns: ["id"]
          },
        ]
      }
      alliance_resource_transfers: {
        Row: {
          alliance_id: string
          created_at: string
          food: number
          gold: number
          id: string
          message: string | null
          receiver_id: string
          sender_id: string
          stone: number
          wood: number
        }
        Insert: {
          alliance_id: string
          created_at?: string
          food?: number
          gold?: number
          id?: string
          message?: string | null
          receiver_id: string
          sender_id: string
          stone?: number
          wood?: number
        }
        Update: {
          alliance_id?: string
          created_at?: string
          food?: number
          gold?: number
          id?: string
          message?: string | null
          receiver_id?: string
          sender_id?: string
          stone?: number
          wood?: number
        }
        Relationships: [
          {
            foreignKeyName: "alliance_resource_transfers_alliance_id_fkey"
            columns: ["alliance_id"]
            isOneToOne: false
            referencedRelation: "alliances"
            referencedColumns: ["id"]
          },
        ]
      }
      alliances: {
        Row: {
          created_at: string
          description: string | null
          id: string
          leader_id: string
          name: string
          tag: string
          tax_rate: number
          treasury_food: number
          treasury_gold: number
          treasury_stone: number
          treasury_wood: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          leader_id: string
          name: string
          tag: string
          tax_rate?: number
          treasury_food?: number
          treasury_gold?: number
          treasury_stone?: number
          treasury_wood?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          leader_id?: string
          name?: string
          tag?: string
          tax_rate?: number
          treasury_food?: number
          treasury_gold?: number
          treasury_stone?: number
          treasury_wood?: number
          updated_at?: string
        }
        Relationships: []
      }
      battle_reports: {
        Row: {
          attacker_id: string
          attacker_name: string
          attacker_troops_lost: Json
          attacker_troops_sent: Json
          building_damage_levels: number | null
          building_damaged: string | null
          created_at: string
          defender_id: string
          defender_name: string
          defender_troops_lost: Json
          id: string
          resources_raided: Json
          result: string
          vassalized: boolean | null
        }
        Insert: {
          attacker_id: string
          attacker_name?: string
          attacker_troops_lost?: Json
          attacker_troops_sent?: Json
          building_damage_levels?: number | null
          building_damaged?: string | null
          created_at?: string
          defender_id: string
          defender_name?: string
          defender_troops_lost?: Json
          id?: string
          resources_raided?: Json
          result?: string
          vassalized?: boolean | null
        }
        Update: {
          attacker_id?: string
          attacker_name?: string
          attacker_troops_lost?: Json
          attacker_troops_sent?: Json
          building_damage_levels?: number | null
          building_damaged?: string | null
          created_at?: string
          defender_id?: string
          defender_name?: string
          defender_troops_lost?: Json
          id?: string
          resources_raided?: Json
          result?: string
          vassalized?: boolean | null
        }
        Relationships: []
      }
      buildings: {
        Row: {
          created_at: string
          id: string
          level: number
          position: number
          type: string
          updated_at: string
          user_id: string
          village_id: string
          workers: number
        }
        Insert: {
          created_at?: string
          id?: string
          level?: number
          position: number
          type: string
          updated_at?: string
          user_id: string
          village_id: string
          workers?: number
        }
        Update: {
          created_at?: string
          id?: string
          level?: number
          position?: number
          type?: string
          updated_at?: string
          user_id?: string
          village_id?: string
          workers?: number
        }
        Relationships: [
          {
            foreignKeyName: "buildings_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "villages"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_proposals: {
        Row: {
          alliance_id: string
          created_at: string
          description: string | null
          expires_at: string
          id: string
          payload: Json
          proposed_by: string
          status: string
          title: string
          type: string
          votes_against: number
          votes_for: number
        }
        Insert: {
          alliance_id: string
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          payload?: Json
          proposed_by: string
          status?: string
          title: string
          type: string
          votes_against?: number
          votes_for?: number
        }
        Update: {
          alliance_id?: string
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          payload?: Json
          proposed_by?: string
          status?: string
          title?: string
          type?: string
          votes_against?: number
          votes_for?: number
        }
        Relationships: [
          {
            foreignKeyName: "guild_proposals_alliance_id_fkey"
            columns: ["alliance_id"]
            isOneToOne: false
            referencedRelation: "alliances"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_votes: {
        Row: {
          created_at: string
          id: string
          proposal_id: string
          user_id: string
          vote: string
        }
        Insert: {
          created_at?: string
          id?: string
          proposal_id: string
          user_id: string
          vote: string
        }
        Update: {
          created_at?: string
          id?: string
          proposal_id?: string
          user_id?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "guild_votes_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "guild_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      player_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read: boolean
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read?: boolean
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_emoji: string
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_emoji?: string
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_emoji?: string
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      vassalages: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          lord_id: string
          ransom_gold: number
          rebellion_available_at: string
          status: string
          tribute_rate: number
          vassal_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          lord_id: string
          ransom_gold?: number
          rebellion_available_at?: string
          status?: string
          tribute_rate?: number
          vassal_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          lord_id?: string
          ransom_gold?: number
          rebellion_available_at?: string
          status?: string
          tribute_rate?: number
          vassal_id?: string
        }
        Relationships: []
      }
      villages: {
        Row: {
          army_archer: number
          army_cavalry: number
          army_knight: number
          army_militia: number
          army_scout: number
          army_siege: number
          created_at: string
          food: number
          gold: number
          happiness: number
          id: string
          last_resource_tick: string
          level: number
          max_population: number
          name: string
          pop_tax_rate: number
          population: number
          rations: string
          steel: number
          stone: number
          updated_at: string
          user_id: string
          wood: number
        }
        Insert: {
          army_archer?: number
          army_cavalry?: number
          army_knight?: number
          army_militia?: number
          army_scout?: number
          army_siege?: number
          created_at?: string
          food?: number
          gold?: number
          happiness?: number
          id?: string
          last_resource_tick?: string
          level?: number
          max_population?: number
          name?: string
          pop_tax_rate?: number
          population?: number
          rations?: string
          steel?: number
          stone?: number
          updated_at?: string
          user_id: string
          wood?: number
        }
        Update: {
          army_archer?: number
          army_cavalry?: number
          army_knight?: number
          army_militia?: number
          army_scout?: number
          army_siege?: number
          created_at?: string
          food?: number
          gold?: number
          happiness?: number
          id?: string
          last_resource_tick?: string
          level?: number
          max_population?: number
          name?: string
          pop_tax_rate?: number
          population?: number
          rations?: string
          steel?: number
          stone?: number
          updated_at?: string
          user_id?: string
          wood?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_to_alliance_treasury: {
        Args: {
          p_alliance_id: string
          p_food: number
          p_gold: number
          p_stone: number
          p_wood: number
        }
        Returns: undefined
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
