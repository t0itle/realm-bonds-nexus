import { useMemo } from 'react';
import type { Building, Army, RationsLevel, PopulationStats, TroopType, WorkerAssignments } from '@/lib/gameTypes';
import { getRationsEffect, TROOP_INFO } from '@/lib/gameConstants';
import { useHousing } from './useHousing';

interface UsePopulationParams {
  buildings: Building[];
  workerAssignments: WorkerAssignments;
  army: Army;
  rations: RationsLevel;
  populationBase: number;
  popTaxRate: number;
}

export function usePopulation({
  buildings,
  workerAssignments,
  army,
  rations,
  populationBase,
  popTaxRate,
}: UsePopulationParams) {
  const { townhallLevel, maxHouses, currentHouses, housingCapacity } = useHousing(buildings);

  const happiness = useMemo(() => {
    let h = 50;
    for (const b of buildings) {
      if (b.type === 'temple') {
        h += b.level * 10;
        h += (workerAssignments[b.id] || 0) * 5;
      }
    }
    h += RATIONS_INFO[rations].happinessBonus;
    if (populationBase > housingCapacity * 0.9) {
      h -= Math.floor((populationBase - housingCapacity * 0.9) * 2);
    }
    if (popTaxRate > 10) {
      h -= (popTaxRate - 10) * 2;
    }
    return Math.max(0, Math.min(100, h));
  }, [buildings, workerAssignments, rations, populationBase, housingCapacity, popTaxRate]);

  const totalSoldiers = useMemo(() => {
    let s = 0;
    for (const [type, count] of Object.entries(army)) {
      s += TROOP_INFO[type as TroopType].popCost * count;
    }
    return s;
  }, [army]);

  const totalWorkers = useMemo(() => {
    return Object.values(workerAssignments).reduce((s, v) => s + v, 0);
  }, [workerAssignments]);

  const maxPopulation = housingCapacity;

  const armyCap = useMemo(() => {
    let cap = 5;
    for (const b of buildings) {
      if (b.type === 'barracks') {
        const workers = workerAssignments[b.id] || 0;
        cap += b.level * 5 + workers * 3;
      }
    }
    return cap;
  }, [buildings, workerAssignments]);

  const popFoodCost = useMemo(() => {
    const nonSoldiers = Math.max(0, populationBase - totalSoldiers);
    return Math.floor(nonSoldiers * RATIONS_INFO[rations].foodMultiplier);
  }, [populationBase, totalSoldiers, rations]);

  const popTaxIncome = useMemo(() => {
    const civilians = Math.max(0, populationBase - totalWorkers - totalSoldiers);
    const rawIncome = civilians * 0.5 * (popTaxRate / 10);
    return Math.max(civilians > 0 && popTaxRate > 0 ? 1 : 0, Math.floor(rawIncome));
  }, [populationBase, totalWorkers, totalSoldiers, popTaxRate]);

  const population: PopulationStats = useMemo(() => ({
    current: populationBase,
    max: maxPopulation,
    civilians: Math.max(0, populationBase - totalWorkers - totalSoldiers),
    workers: totalWorkers,
    soldiers: totalSoldiers,
    armyCap,
    happiness,
    housingCapacity,
    maxHouses,
    currentHouses,
  }), [populationBase, maxPopulation, totalWorkers, totalSoldiers, armyCap, happiness, housingCapacity, maxHouses, currentHouses]);

  return {
    townhallLevel,
    maxHouses,
    currentHouses,
    housingCapacity,
    happiness,
    totalSoldiers,
    totalWorkers,
    maxPopulation,
    armyCap,
    popFoodCost,
    popTaxIncome,
    population,
  };
}
