import { useMemo, useCallback } from 'react';
import type { Building, Resources, Army, TroopType, WorkerAssignments } from '@/lib/gameTypes';
import { getProduction, getSteelProduction, TROOP_INFO } from '@/lib/gameConstants';
import { getMineSteelPerMinuteFromMineIds, getMineSteelPerTickFromMineId } from '@/lib/mineProduction';

interface UseProductionParams {
  buildings: Building[];
  workerAssignments: WorkerAssignments;
  army: Army;
  allianceId: string | null;
  allianceTaxRate: number;
  ownedMineIds: string[];
  popFoodCost: number;
  popTaxIncome: number;
}

export function useProduction({
  buildings,
  workerAssignments,
  army,
  allianceId,
  allianceTaxRate,
  ownedMineIds,
  popFoodCost,
  popTaxIncome,
}: UseProductionParams) {
  const grossProduction = useMemo(() => {
    return buildings.reduce<Resources>(
      (acc, b) => {
        if (b.type === 'empty') return acc;
        const workers = workerAssignments[b.id] || 0;
        const prod = getProduction(b.type, b.level, workers);
        return { gold: acc.gold + (prod.gold || 0), wood: acc.wood + (prod.wood || 0), stone: acc.stone + (prod.stone || 0), food: acc.food + (prod.food || 0) };
      },
      { gold: 0, wood: 0, stone: 0, food: 0 }
    );
  }, [buildings, workerAssignments]);

  const buildingSteelProduction = useMemo(() => {
    return buildings.reduce((acc, b) => {
      if (b.type === 'empty') return acc;
      const workers = workerAssignments[b.id] || 0;
      return acc + getSteelProduction(b.type, b.level, workers);
    }, 0);
  }, [buildings, workerAssignments]);

  const mineSteelPerTick = useMemo(() => ownedMineIds.reduce((acc, mineId) => acc + getMineSteelPerTickFromMineId(mineId), 0), [ownedMineIds]);

  const steelProduction = useMemo(() => {
    return buildingSteelProduction + getMineSteelPerMinuteFromMineIds(ownedMineIds);
  }, [buildingSteelProduction, ownedMineIds]);

  const totalProduction = useMemo(() => {
    let foodCost = 0, goldCost = 0;
    for (const [type, count] of Object.entries(army)) {
      const info = TROOP_INFO[type as TroopType];
      foodCost += info.foodUpkeep * count;
      goldCost += info.goldUpkeep * count;
    }

    const taxFraction = allianceId ? allianceTaxRate / 100 : 0;
    const taxedGrossGold = Math.floor(grossProduction.gold * (1 - taxFraction));
    const taxedGrossWood = Math.floor(grossProduction.wood * (1 - taxFraction));
    const taxedGrossStone = Math.floor(grossProduction.stone * (1 - taxFraction));
    const taxedGrossFood = Math.floor(grossProduction.food * (1 - taxFraction));

    return {
      gold: taxedGrossGold - goldCost + popTaxIncome,
      wood: taxedGrossWood,
      stone: taxedGrossStone,
      food: taxedGrossFood - foodCost - popFoodCost,
    };
  }, [grossProduction, army, popTaxIncome, popFoodCost, allianceId, allianceTaxRate]);

  const armyUpkeep = useCallback(() => {
    let foodCost = 0, goldCost = 0;
    for (const [type, count] of Object.entries(army)) {
      const info = TROOP_INFO[type as TroopType];
      foodCost += info.foodUpkeep * count;
      goldCost += info.goldUpkeep * count;
    }
    return { food: foodCost, gold: goldCost };
  }, [army]);

  const storageCapacity = useMemo(() => {
    const villageLevel = buildings.find(b => b.type === 'townhall')?.level || 1;
    const warehouseLevels = buildings.filter(b => b.type === 'warehouse').reduce((sum, b) => sum + b.level, 0);
    return 2000 + (villageLevel - 1) * 500 + warehouseLevels * 500;
  }, [buildings]);

  return {
    grossProduction,
    buildingSteelProduction,
    mineSteelPerTick,
    steelProduction,
    totalProduction,
    armyUpkeep,
    storageCapacity,
  };
}
