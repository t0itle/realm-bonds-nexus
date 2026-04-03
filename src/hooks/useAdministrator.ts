import { useEffect, useRef } from 'react';
import type { Building, BuildQueue, BuildingType, Resources } from '@/lib/gameTypes';
import { getUpgradeCost, getMaxBuildingLevel } from '@/lib/gameConstants';

interface UseAdministratorParams {
  buildings: Building[];
  buildQueue: BuildQueue[];
  resources: Resources;
  canAfford: (cost: Resources) => boolean;
  canAffordSteel: (amount: number) => boolean;
  buildAt: (position: number, type: Exclude<BuildingType, 'empty'>) => Promise<boolean>;
  upgradeBuilding: (id: string) => Promise<boolean>;
  currentHouses: number;
  maxHouses: number;
  population: { current: number; housingCapacity: number; happiness: number };
  villageId: string | null;
}

/**
 * Auto-management hook: when an Administrator building exists (level 1),
 * periodically builds farms/houses and upgrades existing buildings.
 */
export function useAdministrator({
  buildings,
  buildQueue,
  resources,
  canAfford,
  canAffordSteel,
  buildAt,
  upgradeBuilding,
  currentHouses,
  maxHouses,
  population,
  villageId,
}: UseAdministratorParams) {
  const buildingsRef = useRef(buildings);
  buildingsRef.current = buildings;
  const buildQueueRef = useRef(buildQueue);
  buildQueueRef.current = buildQueue;
  const resourcesRef = useRef(resources);
  resourcesRef.current = resources;
  const populationRef = useRef(population);
  populationRef.current = population;
  const currentHousesRef = useRef(currentHouses);
  currentHousesRef.current = currentHouses;
  const maxHousesRef = useRef(maxHouses);
  maxHousesRef.current = maxHouses;
  const canAffordRef = useRef(canAfford);
  canAffordRef.current = canAfford;
  const canAffordSteelRef = useRef(canAffordSteel);
  canAffordSteelRef.current = canAffordSteel;
  const buildAtRef = useRef(buildAt);
  buildAtRef.current = buildAt;
  const upgradeBuildingRef = useRef(upgradeBuilding);
  upgradeBuildingRef.current = upgradeBuilding;

  const hasAdministrator = buildings.some(b => b.type === 'administrator' && b.level >= 1);

  useEffect(() => {
    if (!hasAdministrator || !villageId) return;

    const interval = setInterval(async () => {
      const currentBuildings = buildingsRef.current;
      const queue = buildQueueRef.current;

      // Don't auto-act if there's already 2+ items in queue
      if (queue.length >= 2) return;

      const pop = populationRef.current;
      const houses = currentHousesRef.current;
      const maxH = maxHousesRef.current;
      const queuedIds = new Set(queue.map(q => q.buildingId));

      // Priority 1: Need housing — build new house
      const occupiedPositions = new Set(currentBuildings.map(b => b.position));
      let emptySlot = -1;
      for (let i = 0; i < 25; i++) {
        if (!occupiedPositions.has(i)) { emptySlot = i; break; }
      }

      if (pop.current >= pop.housingCapacity * 0.85 && houses < maxH && emptySlot !== -1) {
        const cost = getUpgradeCost('house', 0);
        if (canAffordRef.current(cost) && (cost.steel <= 0 || canAffordSteelRef.current(cost.steel))) {
          await buildAtRef.current(emptySlot, 'house');
          return;
        }
      }

      // Priority 2: Need food — build new farm
      const farms = currentBuildings.filter(b => b.type === 'farm').length;
      if ((farms < 3 || pop.current > farms * 8) && emptySlot !== -1) {
        const cost = getUpgradeCost('farm', 0);
        if (canAffordRef.current(cost) && (cost.steel <= 0 || canAffordSteelRef.current(cost.steel))) {
          await buildAtRef.current(emptySlot, 'farm');
          return;
        }
      }

      // Priority 3: Upgrade existing buildings (lowest level first)
      const townhallLevel = currentBuildings.find(b => b.type === 'townhall')?.level || 1;
      const upgradeable = currentBuildings
        .filter(b => b.type !== 'empty' && b.type !== 'administrator' && !queuedIds.has(b.id))
        .filter(b => {
          const maxLvl = getMaxBuildingLevel(b.type as Exclude<BuildingType, 'empty'>, townhallLevel);
          return b.level < maxLvl;
        })
        .sort((a, b) => a.level - b.level);

      for (const building of upgradeable) {
        const cost = getUpgradeCost(building.type as Exclude<BuildingType, 'empty'>, building.level);
        if (canAffordRef.current(cost) && (cost.steel <= 0 || canAffordSteelRef.current(cost.steel))) {
          const success = await upgradeBuildingRef.current(building.id);
          if (success) return;
        }
      }
    }, 45000);

    return () => clearInterval(interval);
  }, [hasAdministrator, villageId]);
}
