import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface NPCPlayerRelation {
  npc_town_id: string;
  sentiment: number; // -100 to 100
  status: 'neutral' | 'friendly' | 'vassal' | 'allied';
  tribute_rate: number;
  trades_completed: number;
}

export interface NPCTownRelation {
  town_a_id: string;
  town_b_id: string;
  relation_type: 'neutral' | 'allied' | 'hostile' | 'war' | 'vassal';
  strength: number;
  last_event: string | null;
}

export interface NPCTownState {
  npc_town_id: string;
  current_power: number;
  claimed_regions: string[];
  available_mercenaries: Record<string, number>;
  last_action: string | null;
  last_action_at: string | null;
  // Finite trade resources
  stock_gold: number;
  stock_wood: number;
  stock_stone: number;
  stock_food: number;
  stock_steel: number;
}

export interface MercenaryContract {
  id: string;
  npc_town_id: string;
  troops_hired: Record<string, number>;
  gold_paid: number;
  expires_at: string;
}

export function useNPCState() {
  const { user } = useAuth();
  const [playerRelations, setPlayerRelations] = useState<Map<string, NPCPlayerRelation>>(new Map());
  const [townRelations, setTownRelations] = useState<NPCTownRelation[]>([]);
  const [townStates, setTownStates] = useState<Map<string, NPCTownState>>(new Map());
  const [mercContracts, setMercContracts] = useState<MercenaryContract[]>([]);
  const [scoutedNPCs, setScoutedNPCs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load all NPC data
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const [relRes, townRelRes, stateRes, mercRes, intelRes] = await Promise.all([
        supabase.from('npc_player_relations').select('*').eq('user_id', user.id),
        supabase.from('npc_town_relations').select('*'),
        supabase.from('npc_town_state').select('*'),
        supabase.from('npc_mercenary_contracts').select('*').eq('user_id', user.id),
        supabase.from('intel_reports').select('target_name').eq('user_id', user.id),
      ]);

      if (relRes.data) {
        const map = new Map<string, NPCPlayerRelation>();
        for (const r of relRes.data) {
          map.set(r.npc_town_id, {
            npc_town_id: r.npc_town_id,
            sentiment: r.sentiment,
            status: r.status as NPCPlayerRelation['status'],
            tribute_rate: r.tribute_rate,
            trades_completed: r.trades_completed,
          });
        }
        setPlayerRelations(map);
      }

      if (townRelRes.data) {
        setTownRelations(townRelRes.data.map(r => ({
          town_a_id: r.town_a_id,
          town_b_id: r.town_b_id,
          relation_type: r.relation_type as NPCTownRelation['relation_type'],
          strength: r.strength,
          last_event: r.last_event,
        })));
      }

      if (stateRes.data) {
        const map = new Map<string, NPCTownState>();
        for (const s of stateRes.data) {
          map.set(s.npc_town_id, {
            npc_town_id: s.npc_town_id,
            current_power: s.current_power,
            claimed_regions: (s.claimed_regions as string[]) || [],
            available_mercenaries: (s.available_mercenaries as Record<string, number>) || {},
            last_action: s.last_action,
            last_action_at: s.last_action_at,
            stock_gold: (s as any).stock_gold ?? 1000,
            stock_wood: (s as any).stock_wood ?? 800,
            stock_stone: (s as any).stock_stone ?? 600,
            stock_food: (s as any).stock_food ?? 900,
            stock_steel: (s as any).stock_steel ?? 50,
          });
        }
        setTownStates(map);
      }

      if (mercRes.data) {
        setMercContracts(mercRes.data.map(m => ({
          id: m.id,
          npc_town_id: m.npc_town_id,
          troops_hired: (m.troops_hired as Record<string, number>) || {},
          gold_paid: m.gold_paid,
          expires_at: m.expires_at,
        })));
      }

      setLoading(false);
    };
    load();
  }, [user]);

  // Update player-NPC sentiment
  const updateSentiment = useCallback(async (npcTownId: string, delta: number, newStatus?: NPCPlayerRelation['status']) => {
    if (!user) return;
    const existing = playerRelations.get(npcTownId);
    const newSentiment = Math.max(-100, Math.min(100, (existing?.sentiment || 0) + delta));
    const status = newStatus || existing?.status || 'neutral';
    const trades = (existing?.trades_completed || 0) + (delta > 0 ? 1 : 0);

    // Upsert
    const { error } = await supabase.from('npc_player_relations').upsert({
      user_id: user.id,
      npc_town_id: npcTownId,
      sentiment: newSentiment,
      status,
      tribute_rate: existing?.tribute_rate || 0,
      trades_completed: trades,
      last_interaction: new Date().toISOString(),
    }, { onConflict: 'user_id,npc_town_id' });

    if (!error) {
      setPlayerRelations(prev => {
        const next = new Map(prev);
        next.set(npcTownId, {
          npc_town_id: npcTownId,
          sentiment: newSentiment,
          status,
          tribute_rate: existing?.tribute_rate || 0,
          trades_completed: trades,
        });
        return next;
      });
    }
  }, [user, playerRelations]);

  // Set relation status directly (e.g. vassalize)
  const setRelationStatus = useCallback(async (npcTownId: string, status: NPCPlayerRelation['status'], tributeRate?: number) => {
    if (!user) return;
    const existing = playerRelations.get(npcTownId);
    const { error } = await supabase.from('npc_player_relations').upsert({
      user_id: user.id,
      npc_town_id: npcTownId,
      sentiment: existing?.sentiment || 0,
      status,
      tribute_rate: tributeRate ?? existing?.tribute_rate ?? 0,
      trades_completed: existing?.trades_completed || 0,
      last_interaction: new Date().toISOString(),
    }, { onConflict: 'user_id,npc_town_id' });

    if (!error) {
      setPlayerRelations(prev => {
        const next = new Map(prev);
        next.set(npcTownId, {
          npc_town_id: npcTownId,
          sentiment: existing?.sentiment || 0,
          status,
          tribute_rate: tributeRate ?? existing?.tribute_rate ?? 0,
          trades_completed: existing?.trades_completed || 0,
        });
        return next;
      });
    }
  }, [user, playerRelations]);

  // Hire mercenaries from NPC town
  const hireMercenaries = useCallback(async (npcTownId: string, troops: Record<string, number>, goldCost: number) => {
    if (!user) return false;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min contract

    const { error } = await supabase.from('npc_mercenary_contracts').insert({
      user_id: user.id,
      npc_town_id: npcTownId,
      troops_hired: troops,
      gold_paid: goldCost,
      expires_at: expiresAt,
    });

    if (!error) {
      setMercContracts(prev => [...prev, {
        id: crypto.randomUUID(),
        npc_town_id: npcTownId,
        troops_hired: troops,
        gold_paid: goldCost,
        expires_at: expiresAt,
      }]);
      // Increase sentiment for hiring
      await updateSentiment(npcTownId, 5);
      return true;
    }
    return false;
  }, [user, updateSentiment]);

  // Get NPC-to-NPC relation between two towns
  const getTownRelation = useCallback((townAId: string, townBId: string): NPCTownRelation | null => {
    return townRelations.find(r =>
      (r.town_a_id === townAId && r.town_b_id === townBId) ||
      (r.town_a_id === townBId && r.town_b_id === townAId)
    ) || null;
  }, [townRelations]);

  // Deduct resources from NPC town stock after a trade
  const deductNPCStock = useCallback(async (npcTownId: string, resource: string, amount: number) => {
    const state = townStates.get(npcTownId);
    if (!state) return;
    const stockKey = `stock_${resource}` as keyof NPCTownState;
    const current = (state[stockKey] as number) || 0;
    const newVal = Math.max(0, current - amount);

    await supabase.from('npc_town_state').update({
      [stockKey]: newVal,
      updated_at: new Date().toISOString(),
    } as any).eq('npc_town_id', npcTownId);

    setTownStates(prev => {
      const next = new Map(prev);
      const existing = next.get(npcTownId);
      if (existing) {
        next.set(npcTownId, { ...existing, [stockKey]: newVal });
      }
      return next;
    });
  }, [townStates]);

  // Check if player has scouted this NPC (has intel report for it)
  const hasScoutedNPC = useCallback((npcTownId: string): boolean => {
    // Check intel_reports loaded in the game state — we'll track scouted NPCs here
    return scoutedNPCs.has(npcTownId);
  }, []);

  // Get total hired mercenary power
  const getMercenaryPower = useCallback(() => {
    const MERC_POWER: Record<string, number> = { militia: 5, archer: 8, knight: 15, cavalry: 14, siege: 25 };
    let total = 0;
    const now = new Date();
    for (const contract of mercContracts) {
      if (new Date(contract.expires_at) > now) {
        for (const [type, count] of Object.entries(contract.troops_hired)) {
          total += (MERC_POWER[type] || 5) * (count as number);
        }
      }
    }
    return total;
  }, [mercContracts]);

  return {
    playerRelations,
    townRelations,
    townStates,
    mercContracts,
    loading,
    updateSentiment,
    setRelationStatus,
    hireMercenaries,
    getTownRelation,
    getMercenaryPower,
    deductNPCStock,
    scoutedNPCs,
  };
}
