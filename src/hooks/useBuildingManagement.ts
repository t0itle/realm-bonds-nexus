import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Building, BuildingType, BuildQueue, Resources, WorkerAssignments } from '@/lib/gameTypes';
import { BUILDING_INFO, getUpgradeCost, getMaxBuildingLevel } from '@/lib/gameConstants';

interface UseBuildingManagementParams {
  buildings: Building[];
  setBuildings: React.Dispatch<React.SetStateAction<Building[]>>;
  buildQueue: BuildQueue[];
  setBuildQueue: React.Dispatch<React.SetStateAction<BuildQueue[]>>;
  resources: Resources;
  setResources: React.Dispatch<React.SetStateAction<Resources>>;
  steel: number;
  setSteel: React.Dispatch<React.SetStateAction<number>>;
  villageId: string | null;
  user: { id: string } | null;
  canAfford: (cost: Resources) => boolean;
  canAffordSteel: (amount: number) => boolean;
  storageCapacity: number;
  currentHouses: number;
  maxHouses: number;
  setWorkerAssignments: React.Dispatch<React.SetStateAction<WorkerAssignments>>;
}

export function useBuildingManagement({
  buildings,
  setBuildings,
  buildQueue,
  setBuildQueue,
  resources,
  setResources,
  steel,
  setSteel,
  villageId,
  user,
  canAfford,
  canAffordSteel,
  storageCapacity,
  currentHouses,
  maxHouses,
  setWorkerAssignments,
}: UseBuildingManagementParams) {
  const getBuildTime = useCallback((type: Exclude<BuildingType, 'empty'>, level: number) => {
    const info = BUILDING_INFO[type];
    return Math.floor(info.buildTime * 3 * Math.pow(1.3, level));
  }, []);

  const isBuildingUpgrading = useCallback((buildingId: string) => {
    return buildQueue.find(q => q.buildingId === buildingId);
  }, [buildQueue]);

  const getBarracksLevel = useCallback(() => {
    const barracks = buildings.find(b => b.type === 'barracks');
    return barracks?.level || 0;
  }, [buildings]);



  const addResources = useCallback((r: Partial<Resources>) => {
    setResources(prev => ({
      gold: prev.gold + (r.gold || 0), wood: prev.wood + (r.wood || 0),
      stone: prev.stone + (r.stone || 0), food: prev.food + (r.food || 0),
    }));
  }, [setResources]);

  const addSteel = useCallback((amount: number) => {
    setSteel(prev => {
      const newVal = prev + amount;
      if (villageId) {
        supabase.from('villages').update({ steel: newVal } as any).eq('id', villageId).then();
      }
      return newVal;
    });
  }, [villageId, setSteel]);

  const buildAt = useCallback(async (position: number, type: Exclude<BuildingType, 'empty'>) => {
    if (!villageId || !user) return false;
    if (type === 'house' && currentHouses >= maxHouses) return false;
    const cost = getUpgradeCost(type, 0);
    if (!canAfford(cost)) return false;
    if (cost.steel > 0 && !canAffordSteel(cost.steel)) return false;
    const newResources = { gold: resources.gold - cost.gold, wood: resources.wood - cost.wood, stone: resources.stone - cost.stone, food: resources.food - cost.food };
    const { data, error } = await supabase.from('buildings').insert({ village_id: villageId, user_id: user.id, type, level: 0, position }).select().single();
    if (error) return false;
    await supabase.from('villages').update(newResources).eq('id', villageId);
    setResources(newResources);
    if (cost.steel > 0) setSteel(prev => prev - cost.steel);
    setBuildings(prev => [...prev, { id: data.id, type: type as BuildingType, level: 0, position, village_id: villageId }]);
    const buildTime = getBuildTime(type, 0);
    const finishTime = Date.now() + buildTime * 1000;
    setBuildQueue(prev => [...prev, { buildingId: data.id, buildingType: type as BuildingType, targetLevel: 1, finishTime }]);
    supabase.from('build_queue').insert({ user_id: user.id, building_id: data.id, building_type: type, target_level: 1, finish_time: new Date(finishTime).toISOString(), village_id: villageId } as any).then();
    return true;
  }, [villageId, user, resources, canAfford, canAffordSteel, currentHouses, maxHouses, getBuildTime, setResources, setSteel, setBuildings, setBuildQueue]);

  const upgradeBuilding = useCallback(async (id: string) => {
    if (!villageId || !user) return false;
    const building = buildings.find(b => b.id === id);
    if (!building || building.type === 'empty') return false;
    if (buildQueue.some(q => q.buildingId === id)) return false;
    const townhallLevel = buildings.find(b => b.type === 'townhall')?.level || 1;
    if (building.level >= getMaxBuildingLevel(building.type as Exclude<BuildingType, 'empty'>, townhallLevel)) return false;
    const cost = getUpgradeCost(building.type, building.level);
    if (!canAfford(cost)) return false;
    if (cost.steel > 0 && !canAffordSteel(cost.steel)) return false;
    const newResources = { gold: resources.gold - cost.gold, wood: resources.wood - cost.wood, stone: resources.stone - cost.stone, food: resources.food - cost.food };
    await supabase.from('villages').update(newResources).eq('id', villageId);
    setResources(newResources);
    if (cost.steel > 0) setSteel(prev => prev - cost.steel);
    const newLevel = building.level + 1;
    const buildTime = getBuildTime(building.type, building.level);
    const finishTime = Date.now() + buildTime * 1000;
    setBuildQueue(prev => [...prev, { buildingId: id, buildingType: building.type as BuildingType, targetLevel: newLevel, finishTime }]);
    supabase.from('build_queue').insert({ user_id: user.id, building_id: id, building_type: building.type, target_level: newLevel, finish_time: new Date(finishTime).toISOString(), village_id: villageId } as any).then();
    return true;
  }, [buildings, villageId, user, resources, canAfford, canAffordSteel, buildQueue, getBuildTime, setResources, setSteel, setBuildQueue]);

  const demolishBuilding = useCallback(async (id: string) => {
    if (!villageId || !user) return false;
    const building = buildings.find(b => b.id === id);
    if (!building || building.type === 'empty' || building.type === 'townhall') return false;
    if (buildQueue.some(q => q.buildingId === id)) return false;
    const type = building.type as Exclude<BuildingType, 'empty'>;
    let refund = { gold: 0, wood: 0, stone: 0, food: 0 };
    for (let lvl = 0; lvl < building.level; lvl++) {
      const c = getUpgradeCost(type, lvl);
      refund.gold += c.gold; refund.wood += c.wood; refund.stone += c.stone; refund.food += c.food;
    }
    refund = { gold: Math.floor(refund.gold * 0.3), wood: Math.floor(refund.wood * 0.3), stone: Math.floor(refund.stone * 0.3), food: Math.floor(refund.food * 0.3) };
    setWorkerAssignments(prev => { const n = { ...prev }; delete n[id]; return n; });
    await supabase.from('buildings').delete().eq('id', id);
    setBuildings(prev => prev.filter(b => b.id !== id));
    setResources(prev => ({ gold: prev.gold + refund.gold, wood: prev.wood + refund.wood, stone: prev.stone + refund.stone, food: prev.food + refund.food }));
    await supabase.from('villages').update({ gold: resources.gold + refund.gold, wood: resources.wood + refund.wood, stone: resources.stone + refund.stone, food: resources.food + refund.food }).eq('id', villageId);
    return true;
  }, [buildings, villageId, user, buildQueue, resources, setWorkerAssignments, setBuildings, setResources]);

  return {
    getBuildTime,
    isBuildingUpgrading,
    getBarracksLevel,
    buildAt,
    upgradeBuilding,
    demolishBuilding,
    addResources,
    addSteel,
  };
}
