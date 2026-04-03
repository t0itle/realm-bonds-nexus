import { useEffect, useRef } from 'react';
import type { Building, BuildQueue, Resources } from '@/lib/gameTypes';
import { getUpgradeCost } from '@/lib/gameConstants';

interface UseAdministratorParams {
  buildings: Building[];
  buildQueue: BuildQueue[];
  resources: Resources;
  canAfford: (cost: Resources) => boolean;
  canAffordSteel: (amount: number) => boolean;
  buildAt: (position: number, type: 'farm' | 'house') => Promise<boolean>;
  currentHouses: number;
  maxHouses: number;
  population: { current: number; housingCapacity: number; happiness: number };
  villageId: string | null;
}

/**
 * Auto-management hook: when an Administrator building exists (level 1),
 * periodically checks if the settlement needs more food or housing
 * and queues farms/houses automatically at 3× slower pace.
 */
export function useAdministrator({
  buildings,
  buildQueue,
  resources,
  canAfford,
  canAffordSteel,
  buildAt,
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

  const hasAdministrator = buildings.some(b => b.type === 'administrator' && b.level >= 1);

  useEffect(() => {
    if (!hasAdministrator || !villageId) return;

    // Check every 45 seconds (slower pace)
    const interval = setInterval(async () => {
      const currentBuildings = buildingsRef.current;
      const queue = buildQueueRef.current;

      // Don't auto-build if there's already something in the queue
      if (queue.length >= 2) return;

      const pop = populationRef.current;
      const houses = currentHousesRef.current;
      const maxH = maxHousesRef.current;

      // Find an empty slot
      const occupiedPositions = new Set(currentBuildings.map(b => b.position));
      let emptySlot = -1;
      for (let i = 0; i < 25; i++) {
        if (!occupiedPositions.has(i)) {
          emptySlot = i;
          break;
        }
      }
      if (emptySlot === -1) return;

      // Priority 1: Need housing (population near capacity)
      if (pop.current >= pop.housingCapacity * 0.85 && houses < maxH) {
        const cost = getUpgradeCost('house', 0);
        if (canAfford(cost) && (cost.steel <= 0 || canAffordSteel(cost.steel))) {
          await buildAt(emptySlot, 'house');
          return;
        }
      }

      // Priority 2: Need more food (check if food production is low)
      const farms = currentBuildings.filter(b => b.type === 'farm').length;
      if (farms < 3 || pop.current > farms * 8) {
        const cost = getUpgradeCost('farm', 0);
        if (canAfford(cost) && (cost.steel <= 0 || canAffordSteel(cost.steel))) {
          await buildAt(emptySlot, 'farm');
          return;
        }
      }
    }, 45000); // 45 seconds between checks

    return () => clearInterval(interval);
  }, [hasAdministrator, villageId, canAfford, canAffordSteel, buildAt]);
}
