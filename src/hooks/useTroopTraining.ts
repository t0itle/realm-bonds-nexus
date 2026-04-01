import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Army, Resources, TroopType, TrainingQueue, PopulationStats } from '@/lib/gameTypes';
import { TROOP_INFO } from '@/lib/gameConstants';

interface UseTroopTrainingParams {
  trainingQueue: TrainingQueue[];
  setTrainingQueue: React.Dispatch<React.SetStateAction<TrainingQueue[]>>;
  army: Army;
  resources: Resources;
  setResources: React.Dispatch<React.SetStateAction<Resources>>;
  steel: number;
  setSteel: React.Dispatch<React.SetStateAction<number>>;
  villageId: string | null;
  user: { id: string } | null;
  canAfford: (cost: Resources) => boolean;
  canAffordSteel: (amount: number) => boolean;
  getBarracksLevel: () => number;
  totalSoldiers: number;
  armyCap: number;
  population: PopulationStats;
}

export function useTroopTraining({
  trainingQueue,
  setTrainingQueue,
  army,
  resources,
  setResources,
  steel,
  setSteel,
  villageId,
  user,
  canAfford,
  canAffordSteel,
  getBarracksLevel,
  totalSoldiers,
  armyCap,
  population,
}: UseTroopTrainingParams) {
  const trainTroops = useCallback((type: TroopType, count: number) => {
    const info = TROOP_INFO[type];
    const barracksLvl = getBarracksLevel();
    
    const queuedSoldiers = trainingQueue.reduce((sum, q) => sum + TROOP_INFO[q.type].popCost * q.count, 0);
    
    console.log('[trainTroops]', { type, count, barracksLvl, required: info.requiredBarracksLevel, totalSoldiers, queuedSoldiers, armyCap, civilians: population.civilians, resources, steel });
    if (barracksLvl < info.requiredBarracksLevel) { console.log('[trainTroops] FAIL: barracks too low'); return false; }
    const totalCost: Resources = {
      gold: info.cost.gold * count, wood: info.cost.wood * count,
      stone: info.cost.stone * count, food: info.cost.food * count,
    };
    const totalSteelCost = info.steelCost * count;
    if (!canAfford(totalCost) || !canAffordSteel(totalSteelCost)) { console.log('[trainTroops] FAIL: cant afford', { totalCost, totalSteelCost }); return false; }
    const popNeeded = info.popCost * count;
    if (totalSoldiers + queuedSoldiers + popNeeded > armyCap) { console.log('[trainTroops] FAIL: over army cap (including queued)', { totalSoldiers, queuedSoldiers, popNeeded, armyCap }); return false; }
    if (population.civilians < popNeeded) { console.log('[trainTroops] FAIL: not enough civilians', { civilians: population.civilians, popNeeded }); return false; }

    const newResources = {
      gold: resources.gold - totalCost.gold, wood: resources.wood - totalCost.wood,
      stone: resources.stone - totalCost.stone, food: resources.food - totalCost.food,
    };
    setResources(newResources);
    const newSteel = totalSteelCost > 0 ? steel - totalSteelCost : steel;
    if (totalSteelCost > 0) setSteel(newSteel);
    if (villageId) {
      supabase.from('villages').update({ ...newResources, steel: newSteel }).eq('id', villageId).then();
    }
    const finishTime = Date.now() + info.trainTime * 1000 * count;
    setTrainingQueue(prev => [...prev, { type, count, finishTime }]);
    if (user) supabase.from('training_queue').insert({ user_id: user.id, troop_type: type, count, finish_time: new Date(finishTime).toISOString() } as any).then();
    return true;
  }, [canAfford, canAffordSteel, getBarracksLevel, totalSoldiers, armyCap, population.civilians, resources, steel, villageId, user, trainingQueue, setResources, setSteel, setTrainingQueue]);

  const totalArmyPower = useCallback(() => {
    let attack = 0, defense = 0;
    for (const [type, count] of Object.entries(army)) {
      const info = TROOP_INFO[type as TroopType];
      attack += info.attack * count;
      defense += info.defense * count;
    }
    return { attack, defense };
  }, [army]);

  return { trainTroops, totalArmyPower };
}
