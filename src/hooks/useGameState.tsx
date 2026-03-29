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

export type BuildingType = 'townhall' | 'farm' | 'lumbermill' | 'quarry' | 'goldmine' | 'barracks' | 'wall' | 'watchtower' | 'house' | 'temple' | 'empty';

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
  steelCost?: number;
  baseProduction?: Partial<Resources>;
  maxLevel: number;
  workersPerLevel: number;
  housingPerLevel?: number;
  buildTime: number; // base seconds to build/upgrade
}

export const BUILDING_INFO: Record<Exclude<BuildingType, 'empty'>, BuildingInfo> = {
  townhall: { name: 'Town Hall', icon: '🏰', description: 'Heart of your village. Determines max houses you can build.', baseCost: { gold: 100, wood: 50, stone: 50, food: 0 }, steelCost: 5, maxLevel: 10, workersPerLevel: 0, buildTime: 60 },
  house: { name: 'House', icon: '🏠', description: 'Provides housing for civilians. Max houses = Town Hall level × 2.', baseCost: { gold: 20, wood: 40, stone: 20, food: 0 }, maxLevel: 5, workersPerLevel: 0, housingPerLevel: 8, buildTime: 20 },
  temple: { name: 'Temple', icon: '⛪', description: 'Increases happiness through religion.', baseCost: { gold: 60, wood: 30, stone: 50, food: 0 }, steelCost: 2, maxLevel: 5, workersPerLevel: 1, buildTime: 45 },
  farm: { name: 'Farm', icon: '🌾', description: 'Produces food. Each worker boosts output.', baseCost: { gold: 30, wood: 40, stone: 10, food: 0 }, baseProduction: { food: 5 }, maxLevel: 10, workersPerLevel: 1, buildTime: 15 },
  lumbermill: { name: 'Lumber Mill', icon: '🪓', description: 'Harvests wood. Workers increase yield.', baseCost: { gold: 30, wood: 10, stone: 20, food: 0 }, baseProduction: { wood: 5 }, maxLevel: 10, workersPerLevel: 1, buildTime: 15 },
  quarry: { name: 'Quarry', icon: '⛏️', description: 'Mines stone. Assign workers for more output.', baseCost: { gold: 40, wood: 20, stone: 10, food: 0 }, baseProduction: { stone: 4 }, maxLevel: 10, workersPerLevel: 1, buildTime: 20 },
  goldmine: { name: 'Gold Mine', icon: '💰', description: 'Extracts gold. Workers boost production.', baseCost: { gold: 10, wood: 30, stone: 40, food: 0 }, steelCost: 3, baseProduction: { gold: 3 }, maxLevel: 10, workersPerLevel: 1, buildTime: 25 },
  barracks: { name: 'Barracks', icon: '⚔️', description: 'Train warriors. Workers here increase army cap.', baseCost: { gold: 80, wood: 60, stone: 40, food: 20 }, steelCost: 8, maxLevel: 8, workersPerLevel: 2, buildTime: 40 },
  wall: { name: 'Wall', icon: '🧱', description: 'Fortify your village against invaders.', baseCost: { gold: 20, wood: 10, stone: 60, food: 0 }, steelCost: 4, maxLevel: 10, workersPerLevel: 0, buildTime: 30 },
  watchtower: { name: 'Watchtower', icon: '🗼', description: 'Spots incoming threats from afar.', baseCost: { gold: 50, wood: 40, stone: 30, food: 0 }, maxLevel: 5, workersPerLevel: 1, buildTime: 25 },
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
  const workerBonus = 1 + workers * 0.15;
  for (const [key, val] of Object.entries(info.baseProduction)) {
    result[key as keyof Resources] = Math.floor(val * level * 1.2 * workerBonus);
  }
  return result;
}

// === RATIONS SYSTEM ===
export type RationsLevel = 'scarce' | 'normal' | 'generous';

export const RATIONS_INFO: Record<RationsLevel, { label: string; foodMultiplier: number; happinessBonus: number; description: string }> = {
  scarce: { label: 'Scarce', foodMultiplier: 0.5, happinessBonus: -15, description: 'Half rations. Saves food but lowers happiness.' },
  normal: { label: 'Normal', foodMultiplier: 1.0, happinessBonus: 0, description: 'Standard rations. No bonus or penalty.' },
  generous: { label: 'Generous', foodMultiplier: 2.0, happinessBonus: 15, description: 'Double rations. Costs more food but boosts happiness.' },
};

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
  popCost: number;
}

export const TROOP_INFO: Record<TroopType, TroopInfo> = {
  militia: { name: 'Militia', emoji: '🗡️', description: 'Basic foot soldiers.', attack: 5, defense: 3, speed: 10, cost: { gold: 20, wood: 10, stone: 0, food: 10 }, steelCost: 0, trainTime: 15, requiredBarracksLevel: 1, foodUpkeep: 2, goldUpkeep: 0, popCost: 1 },
  archer: { name: 'Archer', emoji: '🏹', description: 'Ranged units.', attack: 8, defense: 2, speed: 8, cost: { gold: 35, wood: 25, stone: 0, food: 15 }, steelCost: 0, trainTime: 25, requiredBarracksLevel: 2, foodUpkeep: 3, goldUpkeep: 0, popCost: 1 },
  knight: { name: 'Knight', emoji: '🛡️', description: 'Heavily armored. Requires steel.', attack: 10, defense: 12, speed: 6, cost: { gold: 60, wood: 10, stone: 30, food: 25 }, steelCost: 5, trainTime: 40, requiredBarracksLevel: 3, foodUpkeep: 5, goldUpkeep: 1, popCost: 2 },
  cavalry: { name: 'Cavalry', emoji: '🐴', description: 'Fast mounted warriors. Requires steel.', attack: 14, defense: 6, speed: 18, cost: { gold: 80, wood: 20, stone: 0, food: 40 }, steelCost: 8, trainTime: 50, requiredBarracksLevel: 4, foodUpkeep: 6, goldUpkeep: 1, popCost: 2 },
  siege: { name: 'Siege Ram', emoji: '🏗️', description: 'Devastating siege engine.', attack: 25, defense: 4, speed: 3, cost: { gold: 120, wood: 80, stone: 50, food: 30 }, steelCost: 15, trainTime: 90, requiredBarracksLevel: 5, foodUpkeep: 8, goldUpkeep: 2, popCost: 3 },
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

export interface BuildQueue {
  buildingId: string;
  buildingType: BuildingType;
  targetLevel: number;
  finishTime: number;
}

// === ESPIONAGE SYSTEM ===
export type SpyMission = 'scout' | 'sabotage' | 'demoralize';

export interface SpyMissionInfo {
  name: string;
  emoji: string;
  description: string;
  goldCost: number;
  baseSuccessRate: number; // 0-1
  spiesRequired: number;
}

export const SPY_MISSION_INFO: Record<SpyMission, SpyMissionInfo> = {
  scout: { name: 'Scout', emoji: '🔍', description: 'Gather intel on a target. Reveals troops, resources, and defenses.', goldCost: 50, baseSuccessRate: 0.75, spiesRequired: 1 },
  sabotage: { name: 'Sabotage', emoji: '💣', description: 'Destroy resources and damage buildings. High risk.', goldCost: 120, baseSuccessRate: 0.45, spiesRequired: 2 },
  demoralize: { name: 'Demoralize', emoji: '😈', description: 'Spread propaganda to decrease target happiness.', goldCost: 80, baseSuccessRate: 0.55, spiesRequired: 1 },
};

export interface IntelReport {
  id: string;
  targetName: string;
  targetId: string;
  mission: SpyMission;
  result: 'success' | 'failure' | 'caught';
  timestamp: number;
  data?: {
    troops?: Partial<Army>;
    resources?: Partial<Resources>;
    defenses?: number;
    happinessDrop?: number;
    resourcesDestroyed?: Partial<Resources>;
  };
}

export interface ActiveSpyMission {
  id: string;
  mission: SpyMission;
  targetName: string;
  targetId: string;
  spiesCount: number;
  departTime: number;
  arrivalTime: number;
  returnTime: number;
  phase: 'traveling' | 'operating' | 'returning';
}

export interface BattleLog {
  id: string;
  target: string;
  targetUserId?: string;
  result: 'victory' | 'defeat';
  troopsLost: Partial<Army>;
  defenderTroopsLost?: Partial<Army>;
  resourcesGained?: Partial<Resources>;
  buildingDamaged?: string;
  buildingDamageLevels?: number;
  vassalized?: boolean;
  timestamp: number;
}

// Troop-type counter system: each type has advantages
// cavalry > archer, archer > militia, militia > cavalry (triangle)
// knight is defensive all-rounder, siege bypasses defenses
export const TROOP_COUNTERS: Record<TroopType, { strongVs: TroopType[]; weakVs: TroopType[] }> = {
  militia: { strongVs: ['cavalry'], weakVs: ['archer'] },
  archer: { strongVs: ['militia'], weakVs: ['cavalry'] },
  knight: { strongVs: ['militia', 'archer'], weakVs: ['siege'] },
  cavalry: { strongVs: ['archer', 'siege'], weakVs: ['militia', 'knight'] },
  siege: { strongVs: ['knight'], weakVs: ['cavalry'] },
};

export interface Vassalage {
  id: string;
  lord_id: string;
  vassal_id: string;
  tribute_rate: number;
  rebellion_available_at: string;
  ransom_gold: number;
  status: string;
  created_at: string;
}

export function resolveCombat(
  attackerArmy: Army,
  defenderArmy: Army,
  attackerWallLevel: number = 0,
  defenderWallLevel: number = 0,
): {
  victory: boolean;
  attackerLosses: Partial<Army>;
  defenderLosses: Partial<Army>;
  powerRatio: number;
} {
  // Calculate effective power with counter bonuses
  const calcEffectivePower = (army: Army, enemyArmy: Army, isDefender: boolean, wallLevel: number) => {
    let totalAtk = 0;
    let totalDef = 0;
    for (const [type, count] of Object.entries(army) as [TroopType, number][]) {
      if (count <= 0) continue;
      const info = TROOP_INFO[type];
      let atk = info.attack * count;
      let def = info.defense * count;
      
      // Counter bonuses
      const counters = TROOP_COUNTERS[type];
      for (const [enemyType, enemyCount] of Object.entries(enemyArmy) as [TroopType, number][]) {
        if (enemyCount <= 0) continue;
        if (counters.strongVs.includes(enemyType)) {
          atk += info.attack * count * 0.3; // 30% bonus vs countered types
        }
        if (counters.weakVs.includes(enemyType)) {
          atk -= info.attack * count * 0.15; // 15% penalty vs counter types
        }
      }
      totalAtk += Math.max(0, atk);
      totalDef += def;
    }
    // Wall bonus for defender
    if (isDefender) {
      totalDef += wallLevel * 20;
    }
    return { attack: totalAtk, defense: totalDef };
  };

  const atkPower = calcEffectivePower(attackerArmy, defenderArmy, false, 0);
  const defPower = calcEffectivePower(defenderArmy, attackerArmy, true, defenderWallLevel);
  
  const attackerScore = atkPower.attack * (0.85 + Math.random() * 0.3); // ±15% randomness
  const defenderScore = defPower.attack + defPower.defense * 0.5;
  
  const victory = attackerScore > defenderScore;
  const powerRatio = attackerScore / Math.max(1, defenderScore);
  
  // Calculate losses based on power ratio
  const attackerLossRate = victory 
    ? Math.min(0.4, 1 / (powerRatio * 2))
    : Math.min(0.8, 0.3 + 1 / (powerRatio * 3));
  const defenderLossRate = victory 
    ? Math.min(0.7, powerRatio * 0.3)
    : Math.min(0.3, powerRatio * 0.15);
  
  const attackerLosses: Partial<Army> = {};
  const defenderLosses: Partial<Army> = {};
  
  for (const [type, count] of Object.entries(attackerArmy) as [TroopType, number][]) {
    if (count > 0) {
      attackerLosses[type] = Math.max(1, Math.floor(count * attackerLossRate));
    }
  }
  for (const [type, count] of Object.entries(defenderArmy) as [TroopType, number][]) {
    if (count > 0) {
      defenderLosses[type] = Math.max(1, Math.floor(count * defenderLossRate));
    }
  }
  
  return { victory, attackerLosses, defenderLosses, powerRatio };
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

export type WorkerAssignments = Record<string, number>;

export interface PopulationStats {
  current: number;
  max: number;
  civilians: number;
  workers: number;
  soldiers: number;
  armyCap: number;
  happiness: number;
  housingCapacity: number;
  maxHouses: number;
  currentHouses: number;
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
  buildQueue: BuildQueue[];
  battleLogs: BattleLog[];
  trainTroops: (type: TroopType, count: number) => boolean;
  getBarracksLevel: () => number;
  totalArmyPower: () => { attack: number; defense: number };
  addResources: (r: Partial<Resources>) => void;
  addSteel: (amount: number) => void;
  attackTarget: (targetName: string, targetPower: number) => BattleLog;
  attackPlayer: (targetUserId: string, targetName: string, targetVillageId: string) => Promise<BattleLog | null>;
  vassalages: Vassalage[];
  payRansom: (vassalageId: string) => Promise<boolean>;
  attemptRebellion: (vassalageId: string) => Promise<boolean>;
  getWallLevel: () => number;
  armyUpkeep: () => { food: number; gold: number };
  population: PopulationStats;
  workerAssignments: WorkerAssignments;
  assignWorker: (buildingId: string) => boolean;
  unassignWorker: (buildingId: string) => boolean;
  getMaxWorkers: (building: Building) => number;
  rations: RationsLevel;
  setRations: (r: RationsLevel) => void;
  popTaxRate: number;
  setPopTaxRate: (r: number) => void;
  popFoodCost: number;
  popTaxIncome: number;
  isBuildingUpgrading: (buildingId: string) => BuildQueue | undefined;
  getBuildTime: (type: Exclude<BuildingType, 'empty'>, level: number) => number;
  // Espionage
  spies: number;
  trainSpies: (count: number) => boolean;
  sendSpyMission: (mission: SpyMission, targetName: string, targetId: string, targetX: number, targetY: number, spiesCount: number) => boolean;
  activeSpyMissions: ActiveSpyMission[];
  intelReports: IntelReport[];
  getWatchtowerLevel: () => number;
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
  const [buildQueue, setBuildQueue] = useState<BuildQueue[]>([]);
  const [workerAssignments, setWorkerAssignments] = useState<WorkerAssignments>({});
  const [populationBase, setPopulationBase] = useState(10);
  const [maxPopBase, setMaxPopBase] = useState(20);
  const [happinessBase, setHappinessBase] = useState(50);
  const [rations, setRationsLocal] = useState<RationsLevel>('normal');
  const [popTaxRate, setPopTaxRateLocal] = useState(5);
  const [spies, setSpies] = useState(0);
  const [activeSpyMissions, setActiveSpyMissions] = useState<ActiveSpyMission[]>([]);
  const [intelReports, setIntelReports] = useState<IntelReport[]>([]);
  const [vassalages, setVassalages] = useState<Vassalage[]>([]);

  // Wrap setRations and setPopTaxRate to immediately persist to DB
  const setRations = useCallback((r: RationsLevel) => {
    setRationsLocal(r);
    if (villageId) {
      supabase.from('villages').update({ rations: r } as any).eq('id', villageId).then();
    }
  }, [villageId]);

  const setPopTaxRate = useCallback((rate: number) => {
    setPopTaxRateLocal(rate);
    if (villageId) {
      supabase.from('villages').update({ pop_tax_rate: rate } as any).eq('id', villageId).then();
    }
  }, [villageId]);

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
        setHappinessBase((village as any).happiness ?? 50);
        setRations(((village as any).rations as RationsLevel) ?? 'normal');
        setPopTaxRate((village as any).pop_tax_rate ?? 5);
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
        setSteel((v as any).steel ?? 0);
        setPopulationBase((v as any).population ?? 10);
        setMaxPopBase((v as any).max_population ?? 20);
        setHappinessBase((v as any).happiness ?? 50);
        setRationsLocal(((v as any).rations as RationsLevel) ?? 'normal');
        setPopTaxRateLocal((v as any).pop_tax_rate ?? 5);
      }).subscribe();

    return () => { supabase.removeChannel(villageChannel); };
  }, [user]);

  const canAfford = useCallback((cost: Resources) => {
    return resources.gold >= cost.gold && resources.wood >= cost.wood && resources.stone >= cost.stone && resources.food >= cost.food;
  }, [resources]);

  const canAffordSteel = useCallback((amount: number) => steel >= amount, [steel]);

  // === HOUSING ===
  // Max houses you can build = townhall level * 2
  const townhallLevel = useMemo(() => {
    const th = buildings.find(b => b.type === 'townhall');
    return th?.level || 1;
  }, [buildings]);

  const maxHouses = useMemo(() => townhallLevel * 2, [townhallLevel]);

  const currentHouses = useMemo(() => buildings.filter(b => b.type === 'house').length, [buildings]);

  // Housing capacity = sum of all house levels * housingPerLevel
  const housingCapacity = useMemo(() => {
    let cap = 10; // base housing from townhall
    for (const b of buildings) {
      if (b.type === 'house') {
        cap += (BUILDING_INFO.house.housingPerLevel || 0) * b.level;
      }
      if (b.type === 'townhall') {
        cap += b.level * 5; // townhall also provides some housing
      }
    }
    return cap;
  }, [buildings]);

  // === HAPPINESS ===
  // Base 50 + temple bonus + rations bonus - overcrowding penalty - high tax penalty
  const happiness = useMemo(() => {
    let h = 50;
    // Temple bonus: +10 per temple level, +5 per worker assigned to temple
    for (const b of buildings) {
      if (b.type === 'temple') {
        h += b.level * 10;
        h += (workerAssignments[b.id] || 0) * 5;
      }
    }
    // Rations bonus
    h += RATIONS_INFO[rations].happinessBonus;
    // Overcrowding penalty: if pop > housing * 0.9
    if (populationBase > housingCapacity * 0.9) {
      h -= Math.floor((populationBase - housingCapacity * 0.9) * 2);
    }
    // Tax penalty: -1 per % above 10
    if (popTaxRate > 10) {
      h -= (popTaxRate - 10) * 2;
    }
    return Math.max(0, Math.min(100, h));
  }, [buildings, workerAssignments, rations, populationBase, housingCapacity, popTaxRate]);

  // Population soldiers
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

  // Max population = housing capacity (not the old townhall + farm system)
  const maxPopulation = housingCapacity;

  // Army cap
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

  // Food cost of population = civilians * rations multiplier
  const popFoodCost = useMemo(() => {
    const civilians = Math.max(0, populationBase - totalWorkers - totalSoldiers);
    return Math.floor(civilians * RATIONS_INFO[rations].foodMultiplier);
  }, [populationBase, totalWorkers, totalSoldiers, rations]);

  // Tax income from population
  const popTaxIncome = useMemo(() => {
    const civilians = Math.max(0, populationBase - totalWorkers - totalSoldiers);
    return Math.floor(civilians * popTaxRate / 100 * 2); // 2 gold base per taxable civilian scaled by rate
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

  // Gross production from buildings (with worker bonuses)
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

  // Net production: gross - army upkeep - pop food cost + pop tax income
  const totalProduction = useMemo(() => {
    let foodCost = 0, goldCost = 0;
    for (const [type, count] of Object.entries(army)) {
      const info = TROOP_INFO[type as TroopType];
      foodCost += info.foodUpkeep * count;
      goldCost += info.goldUpkeep * count;
    }
    return {
      gold: grossProduction.gold - goldCost + popTaxIncome,
      wood: grossProduction.wood,
      stone: grossProduction.stone,
      food: grossProduction.food - foodCost - popFoodCost,
    };
  }, [grossProduction, army, popTaxIncome, popFoodCost]);

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
      // Civilian food consumption based on rations
      const civFoodCost = Math.floor(popFoodCost / 20);

      setResources(prev => {
        const foodProd = Math.max(0, Math.floor(grossProduction.food / 20));
        const woodProd = Math.max(1, Math.floor(grossProduction.wood / 20));
        const stoneProd = Math.max(1, Math.floor(grossProduction.stone / 20));
        const goldProd = Math.max(0, Math.floor(grossProduction.gold / 20));
        const taxGold = Math.floor(popTaxIncome / 20);
        
        const newFood = prev.food + foodProd - upkeep.food - civFoodCost;
        const newGold = prev.gold + goldProd - upkeep.gold + taxGold;
        
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
          wood: prev.wood + woodProd,
          stone: prev.stone + stoneProd,
          food: Math.max(0, newFood),
        };
      });

      // Population growth: based on available housing + happiness
      setPopulationBase(prev => {
        if (prev >= maxPopulation) return prev; // at housing cap
        if (resources.food < 50) return prev; // need food to attract settlers
        // Growth rate based on happiness: 0 at 0 happiness, faster at high happiness
        const growthChance = happiness / 100;
        // Housing availability bonus
        const housingRoom = maxPopulation - prev;
        if (housingRoom <= 0) return prev;
        if (Math.random() < growthChance * 0.5) {
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
            happiness, rations, pop_tax_rate: popTaxRate,
            army_militia: currentArmy.militia, army_archer: currentArmy.archer,
            army_knight: currentArmy.knight, army_cavalry: currentArmy.cavalry, army_siege: currentArmy.siege,
          } as any).eq('id', villageId).then();
          return currentArmy;
        });
        return current;
      });
    }, 30000);
    return () => { clearInterval(tickInterval); clearInterval(saveInterval); };
  }, [villageId, user, grossProduction, armyUpkeep, popFoodCost, popTaxIncome, maxPopulation, steel, populationBase, happiness, rations, popTaxRate]);

  useEffect(() => {
    if (!villageId) return;
    const save = () => {
      supabase.from('villages').update({
        gold: resources.gold, wood: resources.wood, stone: resources.stone, food: resources.food,
        steel, population: populationBase, max_population: maxPopulation,
        happiness, rations, pop_tax_rate: popTaxRate,
        army_militia: army.militia, army_archer: army.archer,
        army_knight: army.knight, army_cavalry: army.cavalry, army_siege: army.siege,
      } as any).eq('id', villageId).then();
    };
    window.addEventListener('beforeunload', save);
    return () => window.removeEventListener('beforeunload', save);
  }, [villageId, resources, army, steel, populationBase, maxPopulation, happiness, rations, popTaxRate]);

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

  // Build queue processing
  useEffect(() => {
    if (buildQueue.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setBuildQueue(prev => {
        const completed = prev.filter(q => q.finishTime <= now);
        const remaining = prev.filter(q => q.finishTime > now);
        if (completed.length > 0) {
          completed.forEach(q => {
            // Apply the level upgrade
            supabase.from('buildings').update({ level: q.targetLevel }).eq('id', q.buildingId).then();
            setBuildings(prevB => prevB.map(b => b.id === q.buildingId ? { ...b, level: q.targetLevel } : b));
          });
        }
        return remaining;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [buildQueue.length]);

  const getBuildTime = useCallback((type: Exclude<BuildingType, 'empty'>, level: number) => {
    const info = BUILDING_INFO[type];
    return Math.floor(info.buildTime * Math.pow(1.3, level)); // scales with level
  }, []);

  const isBuildingUpgrading = useCallback((buildingId: string) => {
    return buildQueue.find(q => q.buildingId === buildingId);
  }, [buildQueue]);

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
    const popNeeded = info.popCost * count;
    if (totalSoldiers + popNeeded > armyCap) return false;
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
    if (type === 'house' && currentHouses >= maxHouses) return false;
    const cost = getUpgradeCost(type, 0);
    if (!canAfford(cost)) return false;
    if (cost.steel > 0 && !canAffordSteel(cost.steel)) return false;
    const newResources = { gold: resources.gold - cost.gold, wood: resources.wood - cost.wood, stone: resources.stone - cost.stone, food: resources.food - cost.food };
    // Insert building at level 0 (under construction), queue will set it to 1
    const { data, error } = await supabase.from('buildings').insert({ village_id: villageId, user_id: user.id, type, level: 0, position }).select().single();
    if (error) return false;
    await supabase.from('villages').update(newResources).eq('id', villageId);
    setResources(newResources);
    if (cost.steel > 0) setSteel(prev => prev - cost.steel);
    setBuildings(prev => [...prev, { id: data.id, type: type as BuildingType, level: 0, position, village_id: villageId }]);
    const buildTime = getBuildTime(type, 0);
    setBuildQueue(prev => [...prev, { buildingId: data.id, buildingType: type as BuildingType, targetLevel: 1, finishTime: Date.now() + buildTime * 1000 }]);
    return true;
  }, [villageId, user, resources, canAfford, canAffordSteel, currentHouses, maxHouses, getBuildTime]);

  const upgradeBuilding = useCallback(async (id: string) => {
    if (!villageId || !user) return false;
    const building = buildings.find(b => b.id === id);
    if (!building || building.type === 'empty') return false;
    // Check if already upgrading
    if (buildQueue.some(q => q.buildingId === id)) return false;
    const info = BUILDING_INFO[building.type];
    if (building.level >= info.maxLevel) return false;
    const cost = getUpgradeCost(building.type, building.level);
    if (!canAfford(cost)) return false;
    if (cost.steel > 0 && !canAffordSteel(cost.steel)) return false;
    const newResources = { gold: resources.gold - cost.gold, wood: resources.wood - cost.wood, stone: resources.stone - cost.stone, food: resources.food - cost.food };
    await supabase.from('villages').update(newResources).eq('id', villageId);
    setResources(newResources);
    if (cost.steel > 0) setSteel(prev => prev - cost.steel);
    const newLevel = building.level + 1;
    const buildTime = getBuildTime(building.type, building.level);
    setBuildQueue(prev => [...prev, { buildingId: id, buildingType: building.type as BuildingType, targetLevel: newLevel, finishTime: Date.now() + buildTime * 1000 }]);
    return true;
  }, [buildings, villageId, user, resources, canAfford, canAffordSteel, buildQueue, getBuildTime]);

  // Watchtower level (for espionage defense)
  const getWatchtowerLevel = useCallback(() => {
    const wt = buildings.find(b => b.type === 'watchtower');
    return wt?.level || 0;
  }, [buildings]);

  // Train spies (requires barracks lvl 2+, costs gold + food + 1 pop each)
  const trainSpies = useCallback((count: number) => {
    if (getBarracksLevel() < 2) return false;
    const cost = { gold: 40 * count, wood: 0, stone: 0, food: 20 * count };
    if (!canAfford(cost)) return false;
    if (population.civilians < count) return false;
    setResources(prev => ({ gold: prev.gold - cost.gold, wood: prev.wood, stone: prev.stone, food: prev.food - cost.food }));
    // Spies train over time
    const finishTime = Date.now() + 20000 * count;
    setTrainingQueue(prev => [...prev, { type: 'militia' as TroopType, count: 0, finishTime }]); // placeholder
    setTimeout(() => setSpies(prev => prev + count), 20000 * count);
    return true;
  }, [canAfford, getBarracksLevel, population.civilians]);

  // Send spy mission
  const sendSpyMission = useCallback((mission: SpyMission, targetName: string, targetId: string, targetX: number, targetY: number, spiesCount: number) => {
    const info = SPY_MISSION_INFO[mission];
    if (spies < info.spiesRequired * spiesCount) return false;
    const goldCost = info.goldCost * spiesCount;
    if (resources.gold < goldCost) return false;

    setSpies(prev => prev - info.spiesRequired * spiesCount);
    setResources(prev => ({ ...prev, gold: prev.gold - goldCost }));

    // Travel time based on distance
    const dist = Math.sqrt(Math.pow(targetX - 100000, 2) + Math.pow(targetY - 100000, 2));
    const travelSec = Math.max(5, Math.floor(dist / 3000)); // spies are stealthier, travel a bit faster
    const operateSec = mission === 'scout' ? 5 : mission === 'sabotage' ? 10 : 8;
    const now = Date.now();

    const missionObj: ActiveSpyMission = {
      id: `spy-${now}-${Math.random().toString(36).slice(2, 6)}`,
      mission,
      targetName,
      targetId,
      spiesCount: info.spiesRequired * spiesCount,
      departTime: now,
      arrivalTime: now + travelSec * 1000,
      returnTime: now + (travelSec * 2 + operateSec) * 1000,
      phase: 'traveling',
    };
    setActiveSpyMissions(prev => [...prev, missionObj]);
    return true;
  }, [spies, resources.gold]);

  // Process spy missions
  useEffect(() => {
    if (activeSpyMissions.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveSpyMissions(prev => {
        const updated: ActiveSpyMission[] = [];
        const completed: ActiveSpyMission[] = [];
        for (const m of prev) {
          if (m.returnTime <= now) {
            completed.push(m);
          } else if (m.arrivalTime <= now && m.phase === 'traveling') {
            updated.push({ ...m, phase: 'operating' });
          } else if (m.arrivalTime + 10000 <= now && m.phase === 'operating') {
            updated.push({ ...m, phase: 'returning' });
          } else {
            updated.push(m);
          }
        }
        if (completed.length > 0) {
          completed.forEach(m => {
            const info = SPY_MISSION_INFO[m.mission];
            // Success roll: base rate + spy count bonus - target watchtower penalty
            const wtLevel = getWatchtowerLevel(); // own watchtower doesn't matter for offense, but we use it for flavor
            const roll = Math.random();
            const successRate = Math.min(0.95, info.baseSuccessRate + m.spiesCount * 0.05);
            const caught = roll > successRate + 0.15; // if fail badly, spy is caught
            const success = roll <= successRate;

            const report: IntelReport = {
              id: m.id,
              targetName: m.targetName,
              targetId: m.targetId,
              mission: m.mission,
              result: success ? 'success' : caught ? 'caught' : 'failure',
              timestamp: now,
            };

            if (success) {
              if (m.mission === 'scout') {
                // Generate fake intel based on target
                report.data = {
                  troops: {
                    militia: Math.floor(Math.random() * 20),
                    archer: Math.floor(Math.random() * 15),
                    knight: Math.floor(Math.random() * 8),
                    cavalry: Math.floor(Math.random() * 5),
                    siege: Math.floor(Math.random() * 2),
                  },
                  resources: {
                    gold: Math.floor(Math.random() * 2000),
                    wood: Math.floor(Math.random() * 1500),
                    stone: Math.floor(Math.random() * 1000),
                    food: Math.floor(Math.random() * 800),
                  },
                  defenses: Math.floor(Math.random() * 5),
                };
              } else if (m.mission === 'sabotage') {
                const destroyed = {
                  gold: Math.floor(50 + Math.random() * 200),
                  wood: Math.floor(30 + Math.random() * 150),
                  stone: Math.floor(20 + Math.random() * 100),
                  food: Math.floor(40 + Math.random() * 120),
                };
                report.data = { resourcesDestroyed: destroyed };
              } else if (m.mission === 'demoralize') {
                report.data = { happinessDrop: Math.floor(10 + Math.random() * 20) };
              }
            }

            // Return surviving spies (caught = lost)
            if (!caught) {
              setSpies(p => p + m.spiesCount);
            }

            setIntelReports(prev => [report, ...prev].slice(0, 30));
          });
        }
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSpyMissions.length, getWatchtowerLevel]);

  return (
    <GameContext.Provider value={{
      resources, steel, buildings, villageName, villageId, playerLevel, displayName,
      buildAt, upgradeBuilding, canAfford, canAffordSteel, totalProduction, allVillages, loading,
      army, trainingQueue, buildQueue, battleLogs, trainTroops, getBarracksLevel, totalArmyPower, addResources, addSteel, attackTarget, armyUpkeep,
      population, workerAssignments, assignWorker, unassignWorker, getMaxWorkers,
      rations, setRations, popTaxRate, setPopTaxRate, popFoodCost, popTaxIncome,
      isBuildingUpgrading, getBuildTime,
      spies, trainSpies, sendSpyMission, activeSpyMissions, intelReports, getWatchtowerLevel,
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
