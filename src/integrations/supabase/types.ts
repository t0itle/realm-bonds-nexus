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
      goods: {
        Row: {
          base_price: number
          category: string
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          origin_realm_id: string | null
          rarity: number
          slug: string
          weight: number
        }
        Insert: {
          base_price: number
          category: string
          created_at?: string
          description: string
          icon?: string
          id?: string
          name: string
          origin_realm_id?: string | null
          rarity?: number
          slug: string
          weight?: number
        }
        Update: {
          base_price?: number
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          origin_realm_id?: string | null
          rarity?: number
          slug?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_origin_realm_id_fkey"
            columns: ["origin_realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
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
      realm_reputation: {
        Row: {
          id: string
          realm_id: string
          reputation: number
          trades_in_realm: number
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          realm_id: string
          reputation?: number
          trades_in_realm?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          realm_id?: string
          reputation?: number
          trades_in_realm?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "realm_reputation_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_towns: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          population: number
          realm_id: string
          town_type: string
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          population?: number
          realm_id: string
          town_type?: string
          x: number
          y: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          population?: number
          realm_id?: string
          town_type?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "realm_towns_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
        ]
      }
      realms: {
        Row: {
          aether: string
          arc_index: number
          capital_x: number
          capital_y: number
          color: string
          created_at: string
          culture: string
          epithet: string
          id: string
          is_central: boolean
          lore: string
          name: string
          ruler_name: string
          ruler_title: string
          sigil: string
          slug: string
        }
        Insert: {
          aether: string
          arc_index: number
          capital_x: number
          capital_y: number
          color?: string
          created_at?: string
          culture: string
          epithet: string
          id?: string
          is_central?: boolean
          lore: string
          name: string
          ruler_name: string
          ruler_title: string
          sigil?: string
          slug: string
        }
        Update: {
          aether?: string
          arc_index?: number
          capital_x?: number
          capital_y?: number
          color?: string
          created_at?: string
          culture?: string
          epithet?: string
          id?: string
          is_central?: boolean
          lore?: string
          name?: string
          ruler_name?: string
          ruler_title?: string
          sigil?: string
          slug?: string
        }
        Relationships: []
      }
      town_market: {
        Row: {
          buy_price: number
          demand: number
          good_id: string
          id: string
          sell_price: number
          stock: number
          town_id: string
          updated_at: string
        }
        Insert: {
          buy_price: number
          demand?: number
          good_id: string
          id?: string
          sell_price: number
          stock?: number
          town_id: string
          updated_at?: string
        }
        Update: {
          buy_price?: number
          demand?: number
          good_id?: string
          id?: string
          sell_price?: number
          stock?: number
          town_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "town_market_good_id_fkey"
            columns: ["good_id"]
            isOneToOne: false
            referencedRelation: "goods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "town_market_town_id_fkey"
            columns: ["town_id"]
            isOneToOne: false
            referencedRelation: "realm_towns"
            referencedColumns: ["id"]
          },
        ]
      }
      trader_caravans: {
        Row: {
          arrives_at: string
          cargo: Json
          created_at: string
          departed_at: string
          destination_town_id: string
          guards: number
          id: string
          origin_town_id: string
          risk: number
          status: string
          user_id: string
        }
        Insert: {
          arrives_at: string
          cargo?: Json
          created_at?: string
          departed_at?: string
          destination_town_id: string
          guards?: number
          id?: string
          origin_town_id: string
          risk?: number
          status?: string
          user_id: string
        }
        Update: {
          arrives_at?: string
          cargo?: Json
          created_at?: string
          departed_at?: string
          destination_town_id?: string
          guards?: number
          id?: string
          origin_town_id?: string
          risk?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trader_caravans_destination_town_id_fkey"
            columns: ["destination_town_id"]
            isOneToOne: false
            referencedRelation: "realm_towns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trader_caravans_origin_town_id_fkey"
            columns: ["origin_town_id"]
            isOneToOne: false
            referencedRelation: "realm_towns"
            referencedColumns: ["id"]
          },
        ]
      }
      trader_contracts: {
        Row: {
          created_at: string
          deliver_to_town_id: string | null
          description: string
          expires_at: string | null
          id: string
          issuer_realm_id: string | null
          required_good_id: string | null
          required_quantity: number
          reward_gold: number
          reward_reputation: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deliver_to_town_id?: string | null
          description: string
          expires_at?: string | null
          id?: string
          issuer_realm_id?: string | null
          required_good_id?: string | null
          required_quantity?: number
          reward_gold?: number
          reward_reputation?: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deliver_to_town_id?: string | null
          description?: string
          expires_at?: string | null
          id?: string
          issuer_realm_id?: string | null
          required_good_id?: string | null
          required_quantity?: number
          reward_gold?: number
          reward_reputation?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trader_contracts_deliver_to_town_id_fkey"
            columns: ["deliver_to_town_id"]
            isOneToOne: false
            referencedRelation: "realm_towns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trader_contracts_issuer_realm_id_fkey"
            columns: ["issuer_realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trader_contracts_required_good_id_fkey"
            columns: ["required_good_id"]
            isOneToOne: false
            referencedRelation: "goods"
            referencedColumns: ["id"]
          },
        ]
      }
      trader_inventory: {
        Row: {
          avg_cost: number
          good_id: string
          id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_cost?: number
          good_id: string
          id?: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_cost?: number
          good_id?: string
          id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trader_inventory_good_id_fkey"
            columns: ["good_id"]
            isOneToOne: false
            referencedRelation: "goods"
            referencedColumns: ["id"]
          },
        ]
      }
      trader_profiles: {
        Row: {
          caravan_slots: number
          cart_capacity: number
          created_at: string
          current_town_id: string | null
          gold: number
          guild_standing: number
          home_realm_id: string | null
          id: string
          tier: string
          total_profit: number
          trader_name: string
          trades_completed: number
          updated_at: string
          user_id: string
        }
        Insert: {
          caravan_slots?: number
          cart_capacity?: number
          created_at?: string
          current_town_id?: string | null
          gold?: number
          guild_standing?: number
          home_realm_id?: string | null
          id?: string
          tier?: string
          total_profit?: number
          trader_name: string
          trades_completed?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          caravan_slots?: number
          cart_capacity?: number
          created_at?: string
          current_town_id?: string | null
          gold?: number
          guild_standing?: number
          home_realm_id?: string | null
          id?: string
          tier?: string
          total_profit?: number
          trader_name?: string
          trades_completed?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trader_profiles_current_town_id_fkey"
            columns: ["current_town_id"]
            isOneToOne: false
            referencedRelation: "realm_towns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trader_profiles_home_realm_id_fkey"
            columns: ["home_realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
        ]
      }
      trader_warehouses: {
        Row: {
          capacity: number
          created_at: string
          id: string
          town_id: string
          user_id: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          id?: string
          town_id: string
          user_id: string
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
          town_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trader_warehouses_town_id_fkey"
            columns: ["town_id"]
            isOneToOne: false
            referencedRelation: "realm_towns"
            referencedColumns: ["id"]
          },
        ]
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
