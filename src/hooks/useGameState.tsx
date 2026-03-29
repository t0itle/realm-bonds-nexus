import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Building {
  id: string;
  type: BuildingType;
  level: number;
  position: number;
  village_id: string;
}

export type BuildingType = 'townhall' | 'farm' | 'lumbermill' | 'quarry' | 'goldmine' | 'barracks' | 'wall' | 'watchtower' | 'empty';

export interface Resources {
  gold: number;
  wood: number;
  stone: number;
  food: number;
}

export interface ExtendedResources extends Resources {
  steel: number;
}

export interface BuildingInfo {
  name: string;
  icon: string;
  description: string;
  baseCost: Resources;
  steelCost?: number; // steel required at higher levels
  baseProduction?: Partial<Resources>;
  maxLevel: number;
  workersPerLevel: number; // population slots per level
  housingPerLevel?: number; // max_population increase per level (townhall, farm)
}

export const BUILDING_INFO: Record<Exclude<BuildingType, 'empty'>, BuildingInfo> = {
  townhall: { name: 'Town Hall', icon: '🏰', description: 'The heart of your village. Increases max population.', baseCost: { gold: 100, wood: 50, stone: 50, food: 0 }, steelCost: 5, maxLevel: 10, workersPerLevel: 0, housingPerLevel: 10 },
  farm: { name: 'Farm', icon: '🌾', description: 'Produces food. Each worker boosts output.', baseCost: { gold: 30, wood: 40, stone: 10, food: 0 }, baseProduction: { food: 5 }, maxLevel: 10, workersPerLevel: 1, housingPerLevel: 3 },
  lumbermill: { name: 'Lumber Mill', icon: '🪓', description: 'Harvests wood. Workers increase yield.', baseCost: { gold: 30, wood: 10, stone: 20, food: 0 }, baseProduction: { wood: 5 }, maxLevel: 10, workersPerLevel: 1 },
  quarry: { name: 'Quarry', icon: '⛏️', description: 'Mines stone. Assign workers for more output.', baseCost: { gold: 40, wood: 20, stone: 10, food: 0 }, baseProduction: { stone: 4 }, maxLevel: 10, workersPerLevel: 1 },
  goldmine: { name: 'Gold Mine', icon: '💰', description: 'Extracts gold. Workers boost production.', baseCost: { gold: 10, wood: 30, stone: 40, food: 0 }, steelCost: 3, baseProduction: { gold: 3 }, maxLevel: 10, workersPerLevel: 1 },
  barracks: { name: 'Barracks', icon: '⚔️', description: 'Train warriors. Workers here increase army cap.', baseCost: { gold: 80, wood: 60, stone: 40, food: 20 }, steelCost: 8, maxLevel: 8, workersPerLevel: 2 },
  wall: { name: 'Wall', icon: '🧱', description: 'Fortify your village against invaders.', baseCost: { gold: 20, wood: 10, stone: 60, food: 0 }, steelCost: 4, maxLevel: 10, workersPerLevel: 0 },
  watchtower: { name: 'Watchtower', icon: '🗼', description: 'Spots incoming threats from afar.', baseCost: { gold: 50, wood: 40, stone: 30, food: 0 }, maxLevel: 5, workersPerLevel: 1 },
};

export function getUpgradeCost(type: Exclude<BuildingType, 'empty'>, level: number): Resources & { steel: number } {
  const info = BUILDING_INFO[type];
  const mult = Math.pow(1.5, level);
  return {
    gold: Math.floor(info.baseCost.gold * mult),
    wood: Math.floor(info.baseCost.wood * mult),
    stone: Math.floor(info.baseCost.stone * mult),
    food: Math.floor(info.baseCost.food * mult),
    steel: level >= 3 && info.steelCost ? Math.floor(info.steelCost * (level - 2)) : 0,
  };
}

export function getProduction(type: Exclude<BuildingType, 'empty'>, level: number, workers: number = 0): Partial<Resources> {
  const info = BUILDING_INFO[type];
  if (!info.baseProduction) return {};
  const result: Partial<Resources> = {};
  const workerBonus = 1 + workers * 0.15; // each worker adds 15% production
  for (const [key, val] of Object.entries(info.baseProduction)) {
    result[key as keyof Resources] = Math.floor(val * level * 1.2 * workerBonus);
  }
  return result;
}

// === TROOP SYSTEM ===
export type TroopType = 'militia' | 'archer' | 'knight' | 'cavalry' | 'siege';

export interface TroopInfo {
  name: string;
  emoji: string;
  description: string;
  attack: number;
  defense: number;
  speed: number;
  cost: Resources;
  steelCost: number;
  trainTime: number;
  requiredBarracksLevel: number;
  foodUpkeep: number;
  goldUpkeep: number;
  popCost: number; // population consumed per troop
}

export const TROOP_INFO: Record<TroopType, TroopInfo> = {
  militia: { name: 'Militia', emoji: '🗡️', description: 'Basic foot soldiers. Cheap and fast to train.', attack: 5, defense: 3, speed: 10, cost: { gold: 20, wood: 10, stone: 0, food: 10 }, steelCost: 0, trainTime: 15, requiredBarracksLevel: 1, foodUpkeep: 2, goldUpkeep: 0, popCost: 1 },
  archer: { name: 'Archer', emoji: '🏹', description: 'Ranged units dealing damage from afar.', attack: 8, defense: 2, speed: 8, cost: { gold: 35, wood: 25, stone: 0, food: 15 }, steelCost: 0, trainTime: 25, requiredBarracksLevel: 2, foodUpkeep: 3, goldUpkeep: 0, popCost: 1 },
  knight: { name: 'Knight', emoji: '🛡️', description: 'Heavily armored warriors. Requires steel.', attack: 10, defense: 12, speed: 6, cost: { gold: 60, wood: 10, stone: 30, food: 25 }, steelCost: 5, trainTime: 40, requiredBarracksLevel: 3, foodUpkeep: 5, goldUpkeep: 1, popCost: 2 },
  cavalry: { name: 'Cavalry', emoji: '🐴', description: 'Fast mounted warriors. Requires steel.', attack: 14, defense: 6, speed: 18, cost: { gold: 80, wood: 20, stone: 0, food: 40 }, steelCost: 8, trainTime: 50, requiredBarracksLevel: 4, foodUpkeep: 6, goldUpkeep: 1, popCost: 2 },
  siege: { name: 'Siege Ram', emoji: '🏗️', description: 'Devastating siege engine. Requires steel.', attack: 25, defense: 4, speed: 3, cost: { gold: 120, wood: 80, stone: 50, food: 30 }, steelCost: 15, trainTime: 90, requiredBarracksLevel: 5, foodUpkeep: 8, goldUpkeep: 2, popCost: 3 },
};

export interface Army {
  militia: number;
  archer: number;
  knight: number;
  cavalry: number;
  siege: number;
}

export interface TrainingQueue {
  type: TroopType;
  count: number;
  finishTime: number;
}

export interface BattleLog {
  id: string;
  target: string;
  result: 'victory' | 'defeat';
  troopsLost: Partial<Army>;
  resourcesGained?: Partial<Resources>;
  timestamp: number;
}

export interface Village {
  id: string;
  user_id: string;
  name: string;
  gold: number;
  wood: number;
  stone: number;
  food: number;
  level: number;
}

export interface PlayerVillage {
  village: Village;
  profile: { display_name: string; avatar_emoji: string };
}

// Worker assignments per building ID
export type WorkerAssignments = Record<string, number>;

export interface PopulationStats {
  current: number;
  max: number;
  civilians: number; // unassigned population
  workers: number; // assigned to buildings
  soldiers: number; // in army
  armyCap: number; // max army size based on barracks workers
}

interface GameContextType {
  resources: Resources;
  steel: number;
  buildings: Building[];
  villageName: string;
  villageId: string | null;
  playerLevel: number;
  displayName: string;
  buildAt: (position: number, type: Exclude<BuildingType, 'empty'>) => Promise<boolean>;
  upgradeBuilding: (id: string) => Promise<boolean>;
  canAfford: (cost: Resources) => boolean;
  canAffordSteel: (amount: number) => boolean;
  totalProduction: Resources;
  allVillages: PlayerVillage[];
  loading: boolean;
  army: Army;
  trainingQueue: TrainingQueue[];
  battleLogs: BattleLog[];
  trainTroops: (type: TroopType, count: number) => boolean;
  getBarracksLevel: () => number;
  totalArmyPower: () => { attack: number; defense: number };
  addResources: (r: Partial<Resources>) => void;
  addSteel: (amount: number) => void;
  attackTarget: (targetName: string, targetPower: number) => BattleLog;
  armyUpkeep: () => { food: number; gold: number };
  // Population system
  population: PopulationStats;
  workerAssignments: WorkerAssignments;
  assignWorker: (buildingId: string) => boolean;
  unassignWorker: (buildingId: string) => boolean;
  getMaxWorkers: (building: Building) => number;
}

const GameContext = createContext<GameContextType | null>(null);

const EMPTY_ARMY: Army = { militia: 0, archer: 0, knight: 0, cavalry: 0, siege: 0 };

export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resources>({ gold: 0, wood: 0, stone: 0, food: 0 });
  const [steel, setSteel] = useState(0);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [villageName, setVillageName] = useState('');
  const [villageId, setVillageId] = useState<string | null>(null);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [displayName, setDisplayName] = useState('Wanderer');
  const [allVillages, setAllVillages] = useState<PlayerVillage[]>([]);
  const [loading, setLoading] = useState(true);
  const [army, setArmy] = useState<Army>({ ...EMPTY_ARMY });
  const [trainingQueue, setTrainingQueue] = useState<TrainingQueue[]>([]);
  const [battleLogs, setBattleLogs] = useState<BattleLog[]>([]);
  const [workerAssignments, setWorkerAssignments] = useState<WorkerAssignments>({});
  const [populationBase, setPopulationBase] = useState(10);
  const [maxPopBase, setMaxPopBase] = useState(20);

  // Load player data
  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      if (profile) setDisplayName(profile.display_name);

      const { data: village } = await supabase.from('villages').select('*').eq('user_id', user.id).single();
      if (village) {
        setVillageId(village.id);
        setVillageName(village.name);
        setPlayerLevel(village.level);
        setResources({ gold: Number(village.gold), wood: Number(village.wood), stone: Number(village.stone), food: Number(village.food) });
        setSteel((village as any).steel ?? 0);
        setPopulationBase((village as any).population ?? 10);
        setMaxPopBase((village as any).max_population ?? 20);
        setArmy({
          militia: (village as any).army_militia ?? 0,
          archer: (village as any).army_archer ?? 0,
          knight: (village as any).army_knight ?? 0,
          cavalry: (village as any).army_cavalry ?? 0,
          siege: (village as any).army_siege ?? 0,
        });

        const { data: blds } = await supabase.from('buildings').select('*').eq('village_id', village.id);
        if (blds) {
          setBuildings(blds.map(b => ({ id: b.id, type: b.type as BuildingType, level: b.level, position: b.position, village_id: b.village_id })));
        }
      }

      const { data: villages } = await supabase.from('villages').select('*').limit(50);
      if (villages) {
        const { data: profiles } = await supabase.from('profiles').select('*');
        const profileMap = new Map((profiles || []).map(p => [p.user_id, { display_name: p.display_name, avatar_emoji: p.avatar_emoji }]));
        setAllVillages(villages.map(v => ({
          village: { id: v.id, user_id: v.user_id, name: v.name, gold: Number(v.gold), wood: Number(v.wood), stone: Number(v.stone), food: Number(v.food), level: v.level },
          profile: profileMap.get(v.user_id) || { display_name: 'Unknown', avatar_emoji: '🛡️' },
        })));
      }
      setLoading(false);
    };
    loadData();

    const villageChannel = supabase.channel('village-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'villages', filter: `user_id=eq.${user.id}` }, (payload) => {
        const v = payload.new;
        setResources({ gold: Number(v.gold), wood: Number(v.wood), stone: Number(v.stone), food: Number(v.food) });
        setVillageName(v.name as string);
        setPlayerLevel(v.level as number);
      }).subscribe();

    return () => { supabase.removeChannel(villageChannel); };
  }, [user]);

  const canAfford = useCallback((cost: Resources) => {
    return resources.gold >= cost.gold && resources.wood >= cost.wood && resources.stone >= cost.stone && resources.food >= cost.food;
  }, [resources]);

  const canAffordSteel = useCallback((amount: number) => steel >= amount, [steel]);

  // Calculate population
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

  // Max population from townhall + farms
  const maxPopulation = useMemo(() => {
    let max = maxPopBase;
    for (const b of buildings) {
      if (b.type === 'townhall' || b.type === 'farm') {
        const info = BUILDING_INFO[b.type];
        max += (info.housingPerLevel || 0) * b.level;
      }
    }
    return max;
  }, [buildings, maxPopBase]);

  // Army cap: based on barracks level * workers assigned to barracks
  const armyCap = useMemo(() => {
    let cap = 5; // base cap
    for (const b of buildings) {
      if (b.type === 'barracks') {
        const workers = workerAssignments[b.id] || 0;
        cap += b.level * 5 + workers * 3;
      }
    }
    return cap;
  }, [buildings, workerAssignments]);

  const population: PopulationStats = useMemo(() => ({
    current: populationBase,
    max: maxPopulation,
    civilians: Math.max(0, populationBase - totalWorkers - totalSoldiers),
    workers: totalWorkers,
    soldiers: totalSoldiers,
    armyCap,
  }), [populationBase, maxPopulation, totalWorkers, totalSoldiers, armyCap]);

  // Production with worker bonuses
  const totalProduction = useMemo(() => {
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

  // Army upkeep
  const armyUpkeep = useCallback(() => {
    let foodCost = 0, goldCost = 0;
    for (const [type, count] of Object.entries(army)) {
      const info = TROOP_INFO[type as TroopType];
      foodCost += info.foodUpkeep * count;
      goldCost += info.goldUpkeep * count;
    }
    return { food: Math.max(0, Math.floor(foodCost / 60)), gold: Math.max(0, Math.floor(goldCost / 60)) };
  }, [army]);

  // Resource tick with upkeep + population growth
  useEffect(() => {
    if (!villageId || !user) return;
    const tickInterval = setInterval(() => {
      const upkeep = armyUpkeep();
      // Civilian food consumption: 0.5 per civilian per minute
      const civFoodCost = Math.floor(population.civilians * 0.5 / 20);

      setResources(prev => {
        const newFood = prev.food + Math.max(1, Math.floor(totalProduction.food / 20)) - upkeep.food - civFoodCost;
        const newGold = prev.gold + Math.max(1, Math.floor(totalProduction.gold / 20)) - upkeep.gold;
        if (newFood < 0) {
          setArmy(prevArmy => {
            const updated = { ...prevArmy };
            for (const t of ['siege', 'cavalry', 'knight', 'archer', 'militia'] as TroopType[]) {
              if (updated[t] > 0) { updated[t]--; break; }
            }
            return updated;
          });
        }
        return {
          gold: Math.max(0, newGold),
          wood: prev.wood + Math.max(1, Math.floor(totalProduction.wood / 20)),
          stone: prev.stone + Math.max(1, Math.floor(totalProduction.stone / 20)),
          food: Math.max(0, newFood),
        };
      });

      // Population growth: if food > 100 and pop < max, grow slowly
      setPopulationBase(prev => {
        if (prev < maxPopulation && resources.food > 100) {
          return prev + 1;
        }
        return prev;
      });
    }, 3000);

    const saveInterval = setInterval(() => {
      setResources(current => {
        setArmy(currentArmy => {
          supabase.from('villages').update({
            gold: current.gold, wood: current.wood, stone: current.stone, food: current.food,
            steel, population: populationBase, max_population: maxPopulation,
            army_militia: currentArmy.militia, army_archer: currentArmy.archer,
            army_knight: currentArmy.knight, army_cavalry: currentArmy.cavalry, army_siege: currentArmy.siege,
          } as any).eq('id', villageId).then();
          return currentArmy;
        });
        return current;
      });
    }, 30000);
    return () => { clearInterval(tickInterval); clearInterval(saveInterval); };
  }, [villageId, user, totalProduction, armyUpkeep, population.civilians, maxPopulation, steel, populationBase]);

  useEffect(() => {
    if (!villageId) return;
    const save = () => {
      supabase.from('villages').update({
        gold: resources.gold, wood: resources.wood, stone: resources.stone, food: resources.food,
        steel, population: populationBase, max_population: maxPopulation,
        army_militia: army.militia, army_archer: army.archer,
        army_knight: army.knight, army_cavalry: army.cavalry, army_siege: army.siege,
      } as any).eq('id', villageId).then();
    };
    window.addEventListener('beforeunload', save);
    return () => window.removeEventListener('beforeunload', save);
  }, [villageId, resources, army, steel, populationBase, maxPopulation]);

  // Training queue processing
  useEffect(() => {
    if (trainingQueue.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setTrainingQueue(prev => {
        const completed = prev.filter(q => q.finishTime <= now);
        const remaining = prev.filter(q => q.finishTime > now);
        if (completed.length > 0) {
          setArmy(prevArmy => {
            const newArmy = { ...prevArmy };
            completed.forEach(q => { newArmy[q.type] += q.count; });
            return newArmy;
          });
        }
        return remaining;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [trainingQueue.length]);

  const getBarracksLevel = useCallback(() => {
    const barracks = buildings.find(b => b.type === 'barracks');
    return barracks?.level || 0;
  }, [buildings]);

  const trainTroops = useCallback((type: TroopType, count: number) => {
    const info = TROOP_INFO[type];
    const barracksLvl = getBarracksLevel();
    if (barracksLvl < info.requiredBarracksLevel) return false;
    const totalCost: Resources = {
      gold: info.cost.gold * count, wood: info.cost.wood * count,
      stone: info.cost.stone * count, food: info.cost.food * count,
    };
    const totalSteelCost = info.steelCost * count;
    if (!canAfford(totalCost) || !canAffordSteel(totalSteelCost)) return false;
    // Check army cap
    const popNeeded = info.popCost * count;
    if (totalSoldiers + popNeeded > armyCap) return false;
    // Check available civilians
    if (population.civilians < popNeeded) return false;

    setResources(prev => ({
      gold: prev.gold - totalCost.gold, wood: prev.wood - totalCost.wood,
      stone: prev.stone - totalCost.stone, food: prev.food - totalCost.food,
    }));
    if (totalSteelCost > 0) setSteel(prev => prev - totalSteelCost);
    const finishTime = Date.now() + info.trainTime * 1000 * count;
    setTrainingQueue(prev => [...prev, { type, count, finishTime }]);
    return true;
  }, [canAfford, canAffordSteel, getBarracksLevel, totalSoldiers, armyCap, population.civilians]);

  const totalArmyPower = useCallback(() => {
    let attack = 0, defense = 0;
    for (const [type, count] of Object.entries(army)) {
      const info = TROOP_INFO[type as TroopType];
      attack += info.attack * count;
      defense += info.defense * count;
    }
    return { attack, defense };
  }, [army]);

  const addResources = useCallback((r: Partial<Resources>) => {
    setResources(prev => ({
      gold: prev.gold + (r.gold || 0), wood: prev.wood + (r.wood || 0),
      stone: prev.stone + (r.stone || 0), food: prev.food + (r.food || 0),
    }));
  }, []);

  const addSteel = useCallback((amount: number) => {
    setSteel(prev => prev + amount);
  }, []);

  const attackTarget = useCallback((targetName: string, targetPower: number) => {
    const myPower = totalArmyPower();
    const totalAttack = myPower.attack;
    const roll = Math.random() * 0.4 + 0.8;
    const effectiveAttack = totalAttack * roll;
    const victory = effectiveAttack > targetPower;
    const lossRatio = victory ? Math.min(0.3, targetPower / (totalAttack * 2)) : Math.min(0.7, 0.3 + targetPower / (totalAttack * 3));
    const troopsLost: Partial<Army> = {};
    const newArmy = { ...army };
    for (const [type, count] of Object.entries(army)) {
      if (count > 0) {
        const lost = Math.max(1, Math.floor(count * lossRatio));
        troopsLost[type as TroopType] = Math.min(lost, count);
        newArmy[type as TroopType] = Math.max(0, count - lost);
      }
    }
    setArmy(newArmy);
    const resourcesGained = victory ? {
      gold: Math.floor(targetPower * 0.5 + Math.random() * 200),
      wood: Math.floor(targetPower * 0.3 + Math.random() * 100),
      stone: Math.floor(targetPower * 0.2 + Math.random() * 80),
      food: Math.floor(targetPower * 0.1 + Math.random() * 50),
    } : undefined;
    if (resourcesGained) addResources(resourcesGained);
    const log: BattleLog = { id: Date.now().toString(), target: targetName, result: victory ? 'victory' : 'defeat', troopsLost, resourcesGained, timestamp: Date.now() };
    setBattleLogs(prev => [log, ...prev].slice(0, 20));
    return log;
  }, [army, totalArmyPower, addResources]);

  // Worker assignment system
  const getMaxWorkers = useCallback((building: Building) => {
    if (building.type === 'empty') return 0;
    const info = BUILDING_INFO[building.type];
    return info.workersPerLevel * building.level;
  }, []);

  const assignWorker = useCallback((buildingId: string) => {
    const building = buildings.find(b => b.id === buildingId);
    if (!building) return false;
    const maxW = getMaxWorkers(building);
    const current = workerAssignments[buildingId] || 0;
    if (current >= maxW) return false;
    if (population.civilians <= 0) return false;
    setWorkerAssignments(prev => ({ ...prev, [buildingId]: (prev[buildingId] || 0) + 1 }));
    return true;
  }, [buildings, workerAssignments, population.civilians, getMaxWorkers]);

  const unassignWorker = useCallback((buildingId: string) => {
    const current = workerAssignments[buildingId] || 0;
    if (current <= 0) return false;
    setWorkerAssignments(prev => ({ ...prev, [buildingId]: prev[buildingId] - 1 }));
    return true;
  }, [workerAssignments]);

  const buildAt = useCallback(async (position: number, type: Exclude<BuildingType, 'empty'>) => {
    if (!villageId || !user) return false;
    const cost = getUpgradeCost(type, 0);
    if (!canAfford(cost)) return false;
    if (cost.steel > 0 && !canAffordSteel(cost.steel)) return false;
    const newResources = { gold: resources.gold - cost.gold, wood: resources.wood - cost.wood, stone: resources.stone - cost.stone, food: resources.food - cost.food };
    const { data, error } = await supabase.from('buildings').insert({ village_id: villageId, user_id: user.id, type, level: 1, position }).select().single();
    if (error) return false;
    await supabase.from('villages').update(newResources).eq('id', villageId);
    setResources(newResources);
    if (cost.steel > 0) setSteel(prev => prev - cost.steel);
    setBuildings(prev => [...prev, { id: data.id, type: type as BuildingType, level: 1, position, village_id: villageId }]);
    return true;
  }, [villageId, user, resources, canAfford, canAffordSteel]);

  const upgradeBuilding = useCallback(async (id: string) => {
    if (!villageId || !user) return false;
    const building = buildings.find(b => b.id === id);
    if (!building || building.type === 'empty') return false;
    const info = BUILDING_INFO[building.type];
    if (building.level >= info.maxLevel) return false;
    const cost = getUpgradeCost(building.type, building.level);
    if (!canAfford(cost)) return false;
    if (cost.steel > 0 && !canAffordSteel(cost.steel)) return false;
    const newResources = { gold: resources.gold - cost.gold, wood: resources.wood - cost.wood, stone: resources.stone - cost.stone, food: resources.food - cost.food };
    const newLevel = building.level + 1;
    const { error } = await supabase.from('buildings').update({ level: newLevel }).eq('id', id);
    if (error) return false;
    await supabase.from('villages').update(newResources).eq('id', villageId);
    setResources(newResources);
    if (cost.steel > 0) setSteel(prev => prev - cost.steel);
    setBuildings(prev => prev.map(b => b.id === id ? { ...b, level: newLevel } : b));
    return true;
  }, [buildings, villageId, user, resources, canAfford, canAffordSteel]);

  return (
    <GameContext.Provider value={{
      resources, steel, buildings, villageName, villageId, playerLevel, displayName,
      buildAt, upgradeBuilding, canAfford, canAffordSteel, totalProduction, allVillages, loading,
      army, trainingQueue, battleLogs, trainTroops, getBarracksLevel, totalArmyPower, addResources, addSteel, attackTarget, armyUpkeep,
      population, workerAssignments, assignWorker, unassignWorker, getMaxWorkers,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
