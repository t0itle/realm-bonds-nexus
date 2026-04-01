import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Building, Army, InjuredArmy, Resources, TroopType, TrainingQueue } from '@/lib/gameTypes';
import { TROOP_INFO } from '@/lib/gameConstants';

interface UseApothecaryParams {
  buildings: Building[];
  injuredTroops: InjuredArmy;
  setInjuredTroops: React.Dispatch<React.SetStateAction<InjuredArmy>>;
  army: Army;
  setArmy: React.Dispatch<React.SetStateAction<Army>>;
  resources: Resources;
  setResources: React.Dispatch<React.SetStateAction<Resources>>;
  poisons: number;
  setPoisons: React.Dispatch<React.SetStateAction<number>>;
  setTrainingQueue: React.Dispatch<React.SetStateAction<TrainingQueue[]>>;
  villageId: string | null;
  user: { id: string } | null;
  canAfford: (cost: Resources) => boolean;
}

export function useApothecary({
  buildings,
  injuredTroops,
  setInjuredTroops,
  resources,
  setResources,
  setPoisons,
  setTrainingQueue,
  villageId,
  user,
  canAfford,
}: UseApothecaryParams) {
  const getApothecaryLevel = useCallback(() => {
    const apoth = buildings.find(b => b.type === 'apothecary');
    return apoth?.level || 0;
  }, [buildings]);

  const healTroops = useCallback((type: TroopType, count: number) => {
    const apothLvl = getApothecaryLevel();
    if (apothLvl === 0) return false;
    const available = injuredTroops[type];
    const toHeal = Math.min(count, available);
    if (toHeal <= 0) return false;
    const costMult = Math.max(0.4, 1 - apothLvl * 0.1);
    const info = TROOP_INFO[type];
    const healCost = { gold: Math.floor(info.cost.gold * 0.3 * costMult * toHeal), wood: 0, stone: 0, food: Math.floor(info.cost.food * 0.5 * costMult * toHeal) };
    if (!canAfford(healCost)) return false;
    const newResources = { gold: resources.gold - healCost.gold, wood: resources.wood, stone: resources.stone, food: resources.food - healCost.food };
    setResources(newResources);
    const newInjured = { ...injuredTroops, [type]: injuredTroops[type] - toHeal };
    setInjuredTroops(newInjured);
    const healTime = Math.max(5, Math.floor(15 / apothLvl)) * toHeal;
    const finishTime = Date.now() + healTime * 1000;
    setTrainingQueue(prev => [...prev, { type, count: toHeal, finishTime }]);
    if (villageId) {
      const injuredKey = `injured_${type}` as string;
      supabase.from('villages').update({ ...newResources, [injuredKey]: newInjured[type] } as any).eq('id', villageId).then();
    }
    if (user) {
      supabase.from('training_queue').insert({ user_id: user.id, troop_type: type, count: toHeal, finish_time: new Date(finishTime).toISOString() } as any).then();
    }
    return true;
  }, [getApothecaryLevel, injuredTroops, canAfford, resources, villageId, user, setResources, setInjuredTroops, setTrainingQueue]);

  const craftPoison = useCallback((count: number) => {
    const apothLvl = getApothecaryLevel();
    if (apothLvl < 2) return false;
    const cost = { gold: 60 * count, wood: 0, stone: 0, food: 30 * count };
    if (!canAfford(cost)) return false;
    setResources(prev => ({ gold: prev.gold - cost.gold, wood: prev.wood, stone: prev.stone, food: prev.food - cost.food }));
    setTimeout(() => setPoisons(prev => prev + count), 15000 * count);
    return true;
  }, [getApothecaryLevel, canAfford, setResources, setPoisons]);

  return { getApothecaryLevel, healTroops, craftPoison };
}
