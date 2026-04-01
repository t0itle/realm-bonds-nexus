import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Army, Resources, Vassalage, TroopType, InjuredArmy } from '@/lib/gameTypes';
import { TROOP_INFO, resolveCombat } from '@/lib/gameConstants';

interface UseVassalageParams {
  vassalages: Vassalage[];
  setVassalages: React.Dispatch<React.SetStateAction<Vassalage[]>>;
  army: Army;
  setArmy: React.Dispatch<React.SetStateAction<Army>>;
  resources: Resources;
  setResources: React.Dispatch<React.SetStateAction<Resources>>;
  user: { id: string } | null;
  villageId: string | null;
  displayName: string;
  persistArmyToVillage: (nextArmy: Army) => void;
  setInjuredTroops: React.Dispatch<React.SetStateAction<InjuredArmy>>;
  setPopulationBase: React.Dispatch<React.SetStateAction<number>>;
  getApothecaryLevel: () => number;
}

export function useVassalage({
  vassalages,
  setVassalages,
  army,
  setArmy,
  resources,
  setResources,
  user,
  persistArmyToVillage,
  setInjuredTroops,
  setPopulationBase,
  getApothecaryLevel,
}: UseVassalageParams) {
  const payRansom = useCallback(async (vassalageId: string): Promise<boolean> => {
    const v = vassalages.find(va => va.id === vassalageId);
    if (!v || v.vassal_id !== user?.id) return false;
    if (resources.gold < v.ransom_gold) return false;
    setResources(prev => ({ ...prev, gold: prev.gold - v.ransom_gold }));
    await supabase.from('vassalages').update({ status: 'ended', ended_at: new Date().toISOString() } as any).eq('id', vassalageId);
    setVassalages(prev => prev.filter(va => va.id !== vassalageId));
    return true;
  }, [vassalages, user, resources, setResources, setVassalages]);

  const attemptRebellion = useCallback(async (vassalageId: string): Promise<boolean> => {
    const v = vassalages.find(va => va.id === vassalageId);
    if (!v || v.vassal_id !== user?.id) return false;
    if (new Date(v.rebellion_available_at) > new Date()) return false;

    const { data: lordVillage } = await supabase.from('villages').select('*').eq('user_id', v.lord_id).single();
    if (!lordVillage) return false;

    const lordArmy: Army = {
      militia: (lordVillage as any).army_militia ?? 0,
      archer: (lordVillage as any).army_archer ?? 0,
      knight: (lordVillage as any).army_knight ?? 0,
      cavalry: (lordVillage as any).army_cavalry ?? 0,
      siege: (lordVillage as any).army_siege ?? 0,
      scout: (lordVillage as any).army_scout ?? 0,
    };

    const reducedLordArmy: Army = {
      militia: Math.floor(lordArmy.militia * 0.5),
      archer: Math.floor(lordArmy.archer * 0.5),
      knight: Math.floor(lordArmy.knight * 0.5),
      cavalry: Math.floor(lordArmy.cavalry * 0.5),
      siege: Math.floor(lordArmy.siege * 0.5),
      scout: Math.floor(lordArmy.scout * 0.5),
    };

    const result = resolveCombat(army, reducedLordArmy, 0, 0);

    const newArmy = { ...army };
    let rebelPopLost = 0;
    const rebelApothLvl = getApothecaryLevel();
    const rebelInjuryRate = rebelApothLvl > 0 ? Math.min(0.6, 0.2 + rebelApothLvl * 0.08) : 0;
    const rebelInjured: Partial<Army> = {};
    for (const [type, lost] of Object.entries(result.attackerLosses) as [TroopType, number][]) {
      const actualLost = Math.min(lost, newArmy[type] || 0);
      const injured = Math.floor(actualLost * rebelInjuryRate);
      const dead = actualLost - injured;
      newArmy[type] = Math.max(0, (newArmy[type] || 0) - actualLost);
      if (injured > 0) rebelInjured[type] = injured;
      rebelPopLost += TROOP_INFO[type].popCost * dead;
    }
    setArmy(newArmy);
    persistArmyToVillage(newArmy);
    if (Object.keys(rebelInjured).length > 0) setInjuredTroops(prev => {
      const u = { ...prev };
      for (const [t, c] of Object.entries(rebelInjured) as [TroopType, number][]) u[t] += c;
      return u;
    });
    if (rebelPopLost > 0) setPopulationBase(prev => Math.max(1, prev - rebelPopLost));

    if (result.victory) {
      await supabase.from('vassalages').update({ status: 'ended', ended_at: new Date().toISOString() } as any).eq('id', vassalageId);
      setVassalages(prev => prev.filter(va => va.id !== vassalageId));
      return true;
    } else {
      const newTimer = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('vassalages').update({ rebellion_available_at: newTimer } as any).eq('id', vassalageId);
      setVassalages(prev => prev.map(va => va.id === vassalageId ? { ...va, rebellion_available_at: newTimer } : va));
      return false;
    }
  }, [vassalages, user, army, persistArmyToVillage, setArmy, setInjuredTroops, setPopulationBase, getApothecaryLevel, setVassalages]);

  const setVassalTributeRate = useCallback(async (vassalageId: string, rate: number): Promise<boolean> => {
    const v = vassalages.find(va => va.id === vassalageId);
    if (!v || v.lord_id !== user?.id) return false;
    const clampedRate = Math.max(0, Math.min(50, rate));
    await supabase.from('vassalages').update({ tribute_rate: clampedRate } as any).eq('id', vassalageId);
    setVassalages(prev => prev.map(va => va.id === vassalageId ? { ...va, tribute_rate: clampedRate } : va));
    return true;
  }, [vassalages, user, setVassalages]);

  const releaseVassal = useCallback(async (vassalageId: string): Promise<boolean> => {
    const v = vassalages.find(va => va.id === vassalageId);
    if (!v || v.lord_id !== user?.id) return false;
    await supabase.from('vassalages').update({ status: 'ended', ended_at: new Date().toISOString() } as any).eq('id', vassalageId);
    setVassalages(prev => prev.filter(va => va.id !== vassalageId));
    return true;
  }, [vassalages, user, setVassalages]);

  return { payRansom, attemptRebellion, setVassalTributeRate, releaseVassal };
}
