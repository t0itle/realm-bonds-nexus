import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Army, TroopType } from '@/lib/gameTypes';
import { TROOP_INFO } from '@/lib/gameConstants';

interface UseTroopManagementParams {
  villageId: string | null;
  user: { id: string } | null;
  army: Army;
  setArmy: React.Dispatch<React.SetStateAction<Army>>;
  populationBase: number;
  setPopulationBase: React.Dispatch<React.SetStateAction<number>>;
}

export function useTroopManagement({
  villageId,
  user,
  army,
  setArmy,
  populationBase,
  setPopulationBase,
}: UseTroopManagementParams) {
  const armyRef = useRef(army);
  armyRef.current = army;

  const persistArmyToVillage = useCallback((nextArmy: Army) => {
    if (!villageId) return;
    supabase.from('villages').update({
      army_militia: nextArmy.militia,
      army_archer: nextArmy.archer,
      army_knight: nextArmy.knight,
      army_cavalry: nextArmy.cavalry,
      army_siege: nextArmy.siege,
      army_scout: nextArmy.scout,
    } as any).eq('id', villageId).then();
  }, [villageId]);

  const deployTroops = useCallback((sentArmy: Partial<Army>) => {
    setArmy(prev => {
      const next = { ...prev };
      for (const [type, count] of Object.entries(sentArmy) as [TroopType, number][]) {
        if (count > 0) next[type] = Math.max(0, (next[type] || 0) - count);
      }
      persistArmyToVillage(next);
      return next;
    });
  }, [persistArmyToVillage, setArmy]);

  const disbandTroops = useCallback((type: TroopType, count: number): boolean => {
    const current = armyRef.current[type] || 0;
    if (count <= 0 || count > current) return false;
    const popToReturn = TROOP_INFO[type].popCost * count;
    setArmy(prev => {
      const next = { ...prev, [type]: prev[type] - count };
      persistArmyToVillage(next);
      return next;
    });
    setPopulationBase(prev => {
      const newPop = prev + popToReturn;
      if (villageId) supabase.from('villages').update({ population: newPop } as any).eq('id', villageId).then();
      return newPop;
    });
    toast.success(`Disbanded ${count} ${TROOP_INFO[type].name}${count > 1 ? 's' : ''} → +${popToReturn} civilians`);
    return true;
  }, [persistArmyToVillage, villageId, setArmy, setPopulationBase]);

  const returnTroops = useCallback((survivors: Partial<Army>) => {
    setArmy(prev => {
      const next = { ...prev };
      for (const [type, count] of Object.entries(survivors) as [TroopType, number][]) {
        if (count > 0) next[type] = (next[type] || 0) + count;
      }
      persistArmyToVillage(next);
      return next;
    });
  }, [persistArmyToVillage, setArmy]);

  return { persistArmyToVillage, deployTroops, disbandTroops, returnTroops };
}
