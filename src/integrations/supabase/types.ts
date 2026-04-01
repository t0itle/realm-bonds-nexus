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
      active_marches: {
        Row: {
          arrives_at: string
          created_at: string
          id: string
          march_type: string
          player_name: string
          sent_army: Json
          start_x: number
          start_y: number
          started_at: string
          target_name: string
          target_user_id: string | null
          target_x: number
          target_y: number
          user_id: string
        }
        Insert: {
          arrives_at: string
          created_at?: string
          id?: string
          march_type?: string
          player_name?: string
          sent_army?: Json
          start_x: number
          start_y: number
          started_at?: string
          target_name?: string
          target_user_id?: string | null
          target_x: number
          target_y: number
          user_id: string
        }
        Update: {
          arrives_at?: string
          created_at?: string
          id?: string
          march_type?: string
          player_name?: string
          sent_army?: Json
          start_x?: number
          start_y?: number
          started_at?: string
          target_name?: string
          target_user_id?: string | null
          target_x?: number
          target_y?: number
          user_id?: string
        }
        Relationships: []
      }
      active_reinforcements: {
        Row: {
          created_at: string
          expires_at: string | null
          host_village_id: string
          id: string
          owner_id: string
          troops: Json
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          host_village_id: string
          id?: string
          owner_id: string
          troops?: Json
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          host_village_id?: string
          id?: string
          owner_id?: string
          troops?: Json
        }
        Relationships: [
          {
            foreignKeyName: "active_reinforcements_host_village_id_fkey"
            columns: ["host_village_id"]
            isOneToOne: false
            referencedRelation: "villages"
            referencedColumns: ["id"]
          },
        ]
      }
      active_spy_missions: {
        Row: {
          arrival_time: string
          created_at: string
          depart_time: string
          id: string
          mission: string
          spies_count: number
          target_id: string
          target_name: string
          target_x: number
          target_y: number
          user_id: string
        }
        Insert: {
          arrival_time: string
          created_at?: string
          depart_time: string
          id?: string
          mission: string
          spies_count?: number
          target_id: string
          target_name: string
          target_x?: number
          target_y?: number
          user_id: string
        }
        Update: {
          arrival_time?: string
          created_at?: string
          depart_time?: string
          id?: string
          mission?: string
          spies_count?: number
          target_id?: string
          target_name?: string
          target_x?: number
          target_y?: number
          user_id?: string
        }
        Relationships: []
      }
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
      build_queue: {
        Row: {
          building_id: string
          building_type: string
          created_at: string
          finish_time: string
          id: string
          target_level: number
          user_id: string
        }
        Insert: {
          building_id: string
          building_type: string
          created_at?: string
          finish_time: string
          id?: string
          target_level: number
          user_id: string
        }
        Update: {
          building_id?: string
          building_type?: string
          created_at?: string
          finish_time?: string
          id?: string
          target_level?: number
          user_id?: string
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
      caravans: {
        Row: {
          arrives_at: string
          created_at: string
          departed_at: string
          food: number
          from_village_id: string
          gold: number
          id: string
          raided_by: string | null
          status: string
          steel: number
          stone: number
          to_village_id: string
          user_id: string
          wood: number
        }
        Insert: {
          arrives_at: string
          created_at?: string
          departed_at?: string
          food?: number
          from_village_id: string
          gold?: number
          id?: string
          raided_by?: string | null
          status?: string
          steel?: number
          stone?: number
          to_village_id: string
          user_id: string
          wood?: number
        }
        Update: {
          arrives_at?: string
          created_at?: string
          departed_at?: string
          food?: number
          from_village_id?: string
          gold?: number
          id?: string
          raided_by?: string | null
          status?: string
          steel?: number
          stone?: number
          to_village_id?: string
          user_id?: string
          wood?: number
        }
        Relationships: [
          {
            foreignKeyName: "caravans_from_village_id_fkey"
            columns: ["from_village_id"]
            isOneToOne: false
            referencedRelation: "villages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caravans_to_village_id_fkey"
            columns: ["to_village_id"]
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
      intel_reports: {
        Row: {
          created_at: string
          data: Json
          id: string
          mission: string
          spies_lost: number
          success: boolean
          target_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          mission: string
          spies_lost?: number
          success?: boolean
          target_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          mission?: string
          spies_lost?: number
          success?: boolean
          target_name?: string
          user_id?: string
        }
        Relationships: []
      }
      npc_mercenary_contracts: {
        Row: {
          created_at: string
          expires_at: string
          gold_paid: number
          id: string
          npc_town_id: string
          troops_hired: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          gold_paid?: number
          id?: string
          npc_town_id: string
          troops_hired?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          gold_paid?: number
          id?: string
          npc_town_id?: string
          troops_hired?: Json
          user_id?: string
        }
        Relationships: []
      }
      npc_player_relations: {
        Row: {
          created_at: string
          id: string
          last_interaction: string | null
          npc_town_id: string
          sentiment: number
          status: string
          trades_completed: number
          tribute_rate: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_interaction?: string | null
          npc_town_id: string
          sentiment?: number
          status?: string
          trades_completed?: number
          tribute_rate?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_interaction?: string | null
          npc_town_id?: string
          sentiment?: number
          status?: string
          trades_completed?: number
          tribute_rate?: number
          user_id?: string
        }
        Relationships: []
      }
      npc_town_relations: {
        Row: {
          created_at: string
          id: string
          last_event: string | null
          relation_type: string
          strength: number
          town_a_id: string
          town_b_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_event?: string | null
          relation_type?: string
          strength?: number
          town_a_id: string
          town_b_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_event?: string | null
          relation_type?: string
          strength?: number
          town_a_id?: string
          town_b_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      npc_town_state: {
        Row: {
          available_mercenaries: Json
          claimed_regions: Json
          created_at: string
          current_power: number
          id: string
          last_action: string | null
          last_action_at: string | null
          last_regen_at: string
          npc_town_id: string
          stock_food: number
          stock_gold: number
          stock_steel: number
          stock_stone: number
          stock_wood: number
          updated_at: string
        }
        Insert: {
          available_mercenaries?: Json
          claimed_regions?: Json
          created_at?: string
          current_power?: number
          id?: string
          last_action?: string | null
          last_action_at?: string | null
          last_regen_at?: string
          npc_town_id: string
          stock_food?: number
          stock_gold?: number
          stock_steel?: number
          stock_stone?: number
          stock_wood?: number
          updated_at?: string
        }
        Update: {
          available_mercenaries?: Json
          claimed_regions?: Json
          created_at?: string
          current_power?: number
          id?: string
          last_action?: string | null
          last_action_at?: string | null
          last_regen_at?: string
          npc_town_id?: string
          stock_food?: number
          stock_gold?: number
          stock_steel?: number
          stock_stone?: number
          stock_wood?: number
          updated_at?: string
        }
        Relationships: []
      }
      outposts: {
        Row: {
          created_at: string
          garrison_power: number
          has_wall: boolean
          id: string
          level: number
          name: string
          outpost_type: string
          territory_radius: number
          user_id: string
          wall_level: number
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          garrison_power?: number
          has_wall?: boolean
          id?: string
          level?: number
          name?: string
          outpost_type?: string
          territory_radius?: number
          user_id: string
          wall_level?: number
          x: number
          y: number
        }
        Update: {
          created_at?: string
          garrison_power?: number
          has_wall?: boolean
          id?: string
          level?: number
          name?: string
          outpost_type?: string
          territory_radius?: number
          user_id?: string
          wall_level?: number
          x?: number
          y?: number
        }
        Relationships: []
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
      player_skins: {
        Row: {
          id: string
          is_active: boolean
          purchased_at: string
          skin_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          purchased_at?: string
          skin_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_active?: boolean
          purchased_at?: string
          skin_id?: string
          user_id?: string
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
      spy_training_queue: {
        Row: {
          count: number
          created_at: string
          finish_time: string
          id: string
          user_id: string
        }
        Insert: {
          count: number
          created_at?: string
          finish_time: string
          id?: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          finish_time?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      training_queue: {
        Row: {
          count: number
          created_at: string
          finish_time: string
          id: string
          troop_type: string
          user_id: string
        }
        Insert: {
          count: number
          created_at?: string
          finish_time: string
          id?: string
          troop_type: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          finish_time?: string
          id?: string
          troop_type?: string
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
          injured_archer: number
          injured_cavalry: number
          injured_knight: number
          injured_militia: number
          injured_scout: number
          injured_siege: number
          last_resource_tick: string
          level: number
          map_x: number
          map_y: number
          max_population: number
          name: string
          poisons: number
          pop_tax_rate: number
          population: number
          rations: string
          settlement_type: string
          spies: number
          steel: number
          stone: number
          storage_capacity: number
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
          injured_archer?: number
          injured_cavalry?: number
          injured_knight?: number
          injured_militia?: number
          injured_scout?: number
          injured_siege?: number
          last_resource_tick?: string
          level?: number
          map_x?: number
          map_y?: number
          max_population?: number
          name?: string
          poisons?: number
          pop_tax_rate?: number
          population?: number
          rations?: string
          settlement_type?: string
          spies?: number
          steel?: number
          stone?: number
          storage_capacity?: number
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
          injured_archer?: number
          injured_cavalry?: number
          injured_knight?: number
          injured_militia?: number
          injured_scout?: number
          injured_siege?: number
          last_resource_tick?: string
          level?: number
          map_x?: number
          map_y?: number
          max_population?: number
          name?: string
          poisons?: number
          pop_tax_rate?: number
          population?: number
          rations?: string
          settlement_type?: string
          spies?: number
          steel?: number
          stone?: number
          storage_capacity?: number
          updated_at?: string
          user_id?: string
          wood?: number
        }
        Relationships: []
      }
      wall_segments: {
        Row: {
          created_at: string
          health: number
          id: string
          max_health: number
          outpost_a_id: string
          outpost_b_id: string
          user_id: string
          wall_level: number
        }
        Insert: {
          created_at?: string
          health?: number
          id?: string
          max_health?: number
          outpost_a_id: string
          outpost_b_id: string
          user_id: string
          wall_level?: number
        }
        Update: {
          created_at?: string
          health?: number
          id?: string
          max_health?: number
          outpost_a_id?: string
          outpost_b_id?: string
          user_id?: string
          wall_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "wall_segments_outpost_a_id_fkey"
            columns: ["outpost_a_id"]
            isOneToOne: false
            referencedRelation: "outposts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wall_segments_outpost_b_id_fkey"
            columns: ["outpost_b_id"]
            isOneToOne: false
            referencedRelation: "outposts"
            referencedColumns: ["id"]
          },
        ]
      }
      world_events: {
        Row: {
          created_at: string
          description: string
          effects: Json
          event_type: string
          expires_at: string
          id: string
          resolved_at: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          effects?: Json
          event_type?: string
          expires_at?: string
          id?: string
          resolved_at?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          effects?: Json
          event_type?: string
          expires_at?: string
          id?: string
          resolved_at?: string | null
          status?: string
          title?: string
          user_id?: string
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
      raze_outpost: { Args: { p_outpost_id: string }; Returns: undefined }
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
