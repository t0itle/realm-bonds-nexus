import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
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

export interface BuildingInfo {
  name: string;
  icon: string;
  description: string;
  baseCost: Resources;
  baseProduction?: Partial<Resources>;
  maxLevel: number;
}

export const BUILDING_INFO: Record<Exclude<BuildingType, 'empty'>, BuildingInfo> = {
  townhall: { name: 'Town Hall', icon: '🏰', description: 'The heart of your village. Upgrade to unlock new buildings.', baseCost: { gold: 100, wood: 50, stone: 50, food: 0 }, maxLevel: 10 },
  farm: { name: 'Farm', icon: '🌾', description: 'Produces food to sustain your population and army.', baseCost: { gold: 30, wood: 40, stone: 10, food: 0 }, baseProduction: { food: 5 }, maxLevel: 10 },
  lumbermill: { name: 'Lumber Mill', icon: '🪓', description: 'Harvests wood from the surrounding forests.', baseCost: { gold: 30, wood: 10, stone: 20, food: 0 }, baseProduction: { wood: 5 }, maxLevel: 10 },
  quarry: { name: 'Quarry', icon: '⛏️', description: 'Mines stone from the nearby mountains.', baseCost: { gold: 40, wood: 20, stone: 10, food: 0 }, baseProduction: { stone: 4 }, maxLevel: 10 },
  goldmine: { name: 'Gold Mine', icon: '💰', description: 'Extracts precious gold from deep within the earth.', baseCost: { gold: 10, wood: 30, stone: 40, food: 0 }, baseProduction: { gold: 3 }, maxLevel: 10 },
  barracks: { name: 'Barracks', icon: '⚔️', description: 'Train warriors to defend your village and conquer your enemies.', baseCost: { gold: 80, wood: 60, stone: 40, food: 20 }, maxLevel: 8 },
  wall: { name: 'Wall', icon: '🧱', description: 'Fortify your village against invaders.', baseCost: { gold: 20, wood: 10, stone: 60, food: 0 }, maxLevel: 10 },
  watchtower: { name: 'Watchtower', icon: '🗼', description: 'Spots incoming threats from afar.', baseCost: { gold: 50, wood: 40, stone: 30, food: 0 }, maxLevel: 5 },
};

export function getUpgradeCost(type: Exclude<BuildingType, 'empty'>, level: number): Resources {
  const info = BUILDING_INFO[type];
  const mult = Math.pow(1.5, level);
  return { gold: Math.floor(info.baseCost.gold * mult), wood: Math.floor(info.baseCost.wood * mult), stone: Math.floor(info.baseCost.stone * mult), food: Math.floor(info.baseCost.food * mult) };
}

export function getProduction(type: Exclude<BuildingType, 'empty'>, level: number): Partial<Resources> {
  const info = BUILDING_INFO[type];
  if (!info.baseProduction) return {};
  const result: Partial<Resources> = {};
  for (const [key, val] of Object.entries(info.baseProduction)) {
    result[key as keyof Resources] = Math.floor(val * level * 1.2);
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
  trainTime: number; // seconds
  requiredBarracksLevel: number;
  foodUpkeep: number;
}

export const TROOP_INFO: Record<TroopType, TroopInfo> = {
  militia: { name: 'Militia', emoji: '🗡️', description: 'Basic foot soldiers. Cheap and fast to train.', attack: 5, defense: 3, speed: 10, cost: { gold: 20, wood: 10, stone: 0, food: 10 }, trainTime: 15, requiredBarracksLevel: 1, foodUpkeep: 1 },
  archer: { name: 'Archer', emoji: '🏹', description: 'Ranged units dealing damage from afar.', attack: 8, defense: 2, speed: 8, cost: { gold: 35, wood: 25, stone: 0, food: 15 }, trainTime: 25, requiredBarracksLevel: 2, foodUpkeep: 2 },
  knight: { name: 'Knight', emoji: '🛡️', description: 'Heavily armored warriors with great defense.', attack: 10, defense: 12, speed: 6, cost: { gold: 60, wood: 10, stone: 30, food: 25 }, trainTime: 40, requiredBarracksLevel: 3, foodUpkeep: 3 },
  cavalry: { name: 'Cavalry', emoji: '🐴', description: 'Fast mounted warriors for raids and flanking.', attack: 14, defense: 6, speed: 18, cost: { gold: 80, wood: 20, stone: 0, food: 40 }, trainTime: 50, requiredBarracksLevel: 4, foodUpkeep: 4 },
  siege: { name: 'Siege Ram', emoji: '🏗️', description: 'Devastating against walls and fortifications.', attack: 25, defense: 4, speed: 3, cost: { gold: 120, wood: 80, stone: 50, food: 30 }, trainTime: 90, requiredBarracksLevel: 5, foodUpkeep: 5 },
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

interface GameContextType {
  resources: Resources;
  buildings: Building[];
  villageName: string;
  villageId: string | null;
  playerLevel: number;
  displayName: string;
  buildAt: (position: number, type: Exclude<BuildingType, 'empty'>) => Promise<boolean>;
  upgradeBuilding: (id: string) => Promise<boolean>;
  canAfford: (cost: Resources) => boolean;
  totalProduction: Resources;
  allVillages: PlayerVillage[];
  loading: boolean;
  // Troop system
  army: Army;
  trainingQueue: TrainingQueue[];
  battleLogs: BattleLog[];
  trainTroops: (type: TroopType, count: number) => boolean;
  getBarracksLevel: () => number;
  totalArmyPower: () => { attack: number; defense: number };
  addResources: (r: Partial<Resources>) => void;
  attackTarget: (targetName: string, targetPower: number) => BattleLog;
}

const GameContext = createContext<GameContextType | null>(null);

const EMPTY_ARMY: Army = { militia: 0, archer: 0, knight: 0, cavalry: 0, siege: 0 };

export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resources>({ gold: 0, wood: 0, stone: 0, food: 0 });
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
        // Load persisted army
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

  const totalProduction = buildings.reduce<Resources>(
    (acc, b) => {
      if (b.type === 'empty') return acc;
      const prod = getProduction(b.type, b.level);
      return { gold: acc.gold + (prod.gold || 0), wood: acc.wood + (prod.wood || 0), stone: acc.stone + (prod.stone || 0), food: acc.food + (prod.food || 0) };
    },
    { gold: 0, wood: 0, stone: 0, food: 0 }
  );

  // Calculate army upkeep per tick (food & gold cost)
  const armyUpkeep = useCallback(() => {
    let foodCost = 0, goldCost = 0;
    for (const [type, count] of Object.entries(army)) {
      const info = TROOP_INFO[type as TroopType];
      foodCost += info.foodUpkeep * count;
      goldCost += Math.ceil(info.foodUpkeep * 0.5) * count;
    }
    // Upkeep per tick (every 3s = 1/20 of a minute)
    return { food: Math.ceil(foodCost / 20), gold: Math.ceil(goldCost / 20) };
  }, [army]);

  // Resource tick with upkeep
  useEffect(() => {
    if (!villageId || !user) return;
    const tickInterval = setInterval(() => {
      const upkeep = armyUpkeep();
      setResources(prev => {
        const newFood = prev.food + Math.max(1, Math.floor(totalProduction.food / 20)) - upkeep.food;
        const newGold = prev.gold + Math.max(1, Math.floor(totalProduction.gold / 20)) - upkeep.gold;
        // If food goes negative, troops desert
        if (newFood < 0) {
          setArmy(prevArmy => {
            const updated = { ...prevArmy };
            // Remove 1 of the most expensive troop type
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
    }, 3000);
    const saveInterval = setInterval(() => {
      setResources(current => {
        setArmy(currentArmy => {
          supabase.from('villages').update({
            gold: current.gold, wood: current.wood, stone: current.stone, food: current.food,
            army_militia: currentArmy.militia, army_archer: currentArmy.archer,
            army_knight: currentArmy.knight, army_cavalry: currentArmy.cavalry, army_siege: currentArmy.siege,
          } as any).eq('id', villageId).then();
          return currentArmy;
        });
        return current;
      });
    }, 30000);
    return () => { clearInterval(tickInterval); clearInterval(saveInterval); };
  }, [villageId, user, totalProduction, armyUpkeep]);

  useEffect(() => {
    if (!villageId) return;
    const save = () => {
      supabase.from('villages').update({ gold: resources.gold, wood: resources.wood, stone: resources.stone, food: resources.food }).eq('id', villageId).then();
    };
    window.addEventListener('beforeunload', save);
    return () => window.removeEventListener('beforeunload', save);
  }, [villageId, resources]);

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
    if (!canAfford(totalCost)) return false;
    setResources(prev => ({
      gold: prev.gold - totalCost.gold, wood: prev.wood - totalCost.wood,
      stone: prev.stone - totalCost.stone, food: prev.food - totalCost.food,
    }));
    const finishTime = Date.now() + info.trainTime * 1000 * count;
    setTrainingQueue(prev => [...prev, { type, count, finishTime }]);
    return true;
  }, [canAfford, getBarracksLevel]);

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

  const attackTarget = useCallback((targetName: string, targetPower: number) => {
    const myPower = totalArmyPower();
    const totalAttack = myPower.attack;
    const roll = Math.random() * 0.4 + 0.8; // 0.8-1.2 variance
    const effectiveAttack = totalAttack * roll;
    const victory = effectiveAttack > targetPower;
    
    // Calculate losses
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

    const log: BattleLog = {
      id: Date.now().toString(),
      target: targetName,
      result: victory ? 'victory' : 'defeat',
      troopsLost,
      resourcesGained,
      timestamp: Date.now(),
    };
    setBattleLogs(prev => [log, ...prev].slice(0, 20));
    return log;
  }, [army, totalArmyPower, addResources]);

  const buildAt = useCallback(async (position: number, type: Exclude<BuildingType, 'empty'>) => {
    if (!villageId || !user) return false;
    const cost = getUpgradeCost(type, 0);
    if (!canAfford(cost)) return false;
    const newResources = { gold: resources.gold - cost.gold, wood: resources.wood - cost.wood, stone: resources.stone - cost.stone, food: resources.food - cost.food };
    const { data, error } = await supabase.from('buildings').insert({ village_id: villageId, user_id: user.id, type, level: 1, position }).select().single();
    if (error) return false;
    await supabase.from('villages').update(newResources).eq('id', villageId);
    setResources(newResources);
    setBuildings(prev => [...prev, { id: data.id, type: type as BuildingType, level: 1, position, village_id: villageId }]);
    return true;
  }, [villageId, user, resources, canAfford]);

  const upgradeBuilding = useCallback(async (id: string) => {
    if (!villageId || !user) return false;
    const building = buildings.find(b => b.id === id);
    if (!building || building.type === 'empty') return false;
    const info = BUILDING_INFO[building.type];
    if (building.level >= info.maxLevel) return false;
    const cost = getUpgradeCost(building.type, building.level);
    if (!canAfford(cost)) return false;
    const newResources = { gold: resources.gold - cost.gold, wood: resources.wood - cost.wood, stone: resources.stone - cost.stone, food: resources.food - cost.food };
    const newLevel = building.level + 1;
    const { error } = await supabase.from('buildings').update({ level: newLevel }).eq('id', id);
    if (error) return false;
    await supabase.from('villages').update(newResources).eq('id', villageId);
    setResources(newResources);
    setBuildings(prev => prev.map(b => b.id === id ? { ...b, level: newLevel } : b));
    return true;
  }, [buildings, villageId, user, resources, canAfford]);

  return (
    <GameContext.Provider value={{
      resources, buildings, villageName, villageId, playerLevel, displayName,
      buildAt, upgradeBuilding, canAfford, totalProduction, allVillages, loading,
      army, trainingQueue, battleLogs, trainTroops, getBarracksLevel, totalArmyPower, addResources, attackTarget,
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
