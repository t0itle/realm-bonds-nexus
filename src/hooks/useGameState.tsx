import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

export interface Building {
  id: string;
  type: BuildingType;
  level: number;
  position: number;
  village_id: string;
}

export type BuildingType = 'townhall' | 'farm' | 'lumbermill' | 'quarry' | 'goldmine' | 'barracks' | 'wall' | 'watchtower' | 'house' | 'temple' | 'apothecary' | 'warehouse' | 'spyguild' | 'empty';

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
  townhall: { name: 'Town Hall', icon: '🏰', description: 'Heart of your village. Determines max houses you can build.', baseCost: { gold: 100, wood: 50, stone: 50, food: 0 }, steelCost: 5, maxLevel: 10, workersPerLevel: 0, buildTime: 120 },
  house: { name: 'House', icon: '🏠', description: 'Provides housing for civilians. Max houses = Town Hall level × 2.', baseCost: { gold: 20, wood: 40, stone: 20, food: 0 }, maxLevel: 5, workersPerLevel: 0, housingPerLevel: 8, buildTime: 40 },
  temple: { name: 'Temple', icon: '⛪', description: 'Increases happiness through religion.', baseCost: { gold: 60, wood: 30, stone: 50, food: 0 }, steelCost: 2, maxLevel: 5, workersPerLevel: 1, buildTime: 90 },
  farm: { name: 'Farm', icon: '🌾', description: 'Produces food. Each worker boosts output.', baseCost: { gold: 30, wood: 40, stone: 10, food: 0 }, baseProduction: { food: 2 }, maxLevel: 10, workersPerLevel: 1, buildTime: 30 },
  lumbermill: { name: 'Lumber Mill', icon: '🪓', description: 'Harvests wood. Workers increase yield.', baseCost: { gold: 30, wood: 10, stone: 20, food: 0 }, baseProduction: { wood: 2 }, maxLevel: 10, workersPerLevel: 1, buildTime: 30 },
  quarry: { name: 'Quarry', icon: '⛏️', description: 'Mines stone. Assign workers for more output.', baseCost: { gold: 40, wood: 20, stone: 10, food: 0 }, baseProduction: { stone: 1 }, maxLevel: 10, workersPerLevel: 1, buildTime: 40 },
  goldmine: { name: 'Gold Mine', icon: '💰', description: 'Extracts gold. Workers boost production.', baseCost: { gold: 10, wood: 30, stone: 40, food: 0 }, steelCost: 3, baseProduction: { gold: 1 }, maxLevel: 10, workersPerLevel: 1, buildTime: 50 },
  barracks: { name: 'Barracks', icon: '⚔️', description: 'Train warriors. Workers here increase army cap.', baseCost: { gold: 80, wood: 60, stone: 40, food: 20 }, steelCost: 8, maxLevel: 8, workersPerLevel: 2, buildTime: 80 },
  wall: { name: 'Wall', icon: '🧱', description: 'Fortify your village against invaders.', baseCost: { gold: 20, wood: 10, stone: 60, food: 0 }, steelCost: 4, maxLevel: 10, workersPerLevel: 0, buildTime: 60 },
  watchtower: { name: 'Watchtower', icon: '🗼', description: 'Spots incoming threats from afar.', baseCost: { gold: 50, wood: 40, stone: 30, food: 0 }, maxLevel: 5, workersPerLevel: 1, buildTime: 50 },
  apothecary: { name: 'Apothecary', icon: '⚗️', description: 'Heal injured troops and craft poisons for spies.', baseCost: { gold: 70, wood: 30, stone: 30, food: 20 }, steelCost: 2, maxLevel: 5, workersPerLevel: 1, buildTime: 70 },
  warehouse: { name: 'Warehouse', icon: '🏪', description: 'Increases storage capacity by 500 per level. Store more resources safely.', baseCost: { gold: 50, wood: 80, stone: 60, food: 0 }, maxLevel: 10, workersPerLevel: 0, buildTime: 50 },
  spyguild: { name: 'Spy Guild', icon: '🕵️', description: 'Train spies and unlock espionage missions against other players. Workers speed up spy training.', baseCost: { gold: 100, wood: 50, stone: 40, food: 30 }, steelCost: 5, maxLevel: 5, workersPerLevel: 2, buildTime: 90 },
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
  const workerBonus = 1 + workers * 0.35;
  for (const [key, val] of Object.entries(info.baseProduction)) {
    result[key as keyof Resources] = Math.floor(val * level * 1.2 * workerBonus * 0.8); // 20% nerf
  }
  return result;
}

/** Steel production: now comes only from captured iron mines on the map */
export function getSteelProduction(_type: Exclude<BuildingType, 'empty'>, _level: number, _workers: number = 0): number {
  return 0; // Steel is acquired from iron ore deposits on the world map
}

// === RATIONS SYSTEM ===
export type RationsLevel = 'scarce' | 'normal' | 'generous';

export const RATIONS_INFO: Record<RationsLevel, { label: string; foodMultiplier: number; happinessBonus: number; description: string }> = {
  scarce: { label: 'Scarce', foodMultiplier: 0.5, happinessBonus: -15, description: 'Half rations. Saves food but lowers happiness.' },
  normal: { label: 'Normal', foodMultiplier: 1.0, happinessBonus: 0, description: 'Standard rations. No bonus or penalty.' },
  generous: { label: 'Generous', foodMultiplier: 2.0, happinessBonus: 15, description: 'Double rations. Costs more food but boosts happiness.' },
};

// === TROOP SYSTEM ===
export type TroopType = 'militia' | 'archer' | 'knight' | 'cavalry' | 'siege' | 'scout';

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
  militia: { name: 'Militia', emoji: '🗡️', description: 'Basic foot soldiers.', attack: 5, defense: 3, speed: 10, cost: { gold: 20, wood: 10, stone: 0, food: 10 }, steelCost: 0, trainTime: 15, requiredBarracksLevel: 1, foodUpkeep: 1, goldUpkeep: 0, popCost: 1 },
  archer: { name: 'Archer', emoji: '🏹', description: 'Ranged units.', attack: 8, defense: 2, speed: 8, cost: { gold: 35, wood: 25, stone: 0, food: 15 }, steelCost: 0, trainTime: 25, requiredBarracksLevel: 2, foodUpkeep: 1, goldUpkeep: 0, popCost: 1 },
  knight: { name: 'Knight', emoji: '🛡️', description: 'Heavily armored. Requires steel.', attack: 10, defense: 12, speed: 6, cost: { gold: 60, wood: 10, stone: 30, food: 25 }, steelCost: 5, trainTime: 40, requiredBarracksLevel: 3, foodUpkeep: 2, goldUpkeep: 1, popCost: 2 },
  cavalry: { name: 'Cavalry', emoji: '🐴', description: 'Fast mounted warriors. Requires steel.', attack: 14, defense: 6, speed: 18, cost: { gold: 80, wood: 20, stone: 0, food: 40 }, steelCost: 8, trainTime: 50, requiredBarracksLevel: 4, foodUpkeep: 3, goldUpkeep: 1, popCost: 2 },
  siege: { name: 'Siege Ram', emoji: '🏗️', description: 'Devastating siege engine.', attack: 25, defense: 4, speed: 3, cost: { gold: 120, wood: 80, stone: 50, food: 30 }, steelCost: 15, trainTime: 90, requiredBarracksLevel: 5, foodUpkeep: 4, goldUpkeep: 1, popCost: 3 },
  scout: { name: 'Scout', emoji: '🏃', description: 'Fast recon unit. Extends march range.', attack: 2, defense: 1, speed: 25, cost: { gold: 15, wood: 5, stone: 0, food: 10 }, steelCost: 0, trainTime: 10, requiredBarracksLevel: 1, foodUpkeep: 1, goldUpkeep: 0, popCost: 1 },
};

export interface Army {
  militia: number;
  archer: number;
  knight: number;
  cavalry: number;
  siege: number;
  scout: number;
}

export type InjuredArmy = Army; // same shape, tracks injured counts

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
  scout: { strongVs: [], weakVs: ['militia', 'archer', 'knight', 'cavalry'] },
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
  map_x: number;
  map_y: number;
  settlement_type: string;
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
  avatarUrl: string | null;
  setDisplayName: (name: string) => Promise<boolean>;
  setVillageName: (name: string) => Promise<boolean>;
  setAvatarUrl: (url: string | null) => void;
  demolishBuilding: (id: string) => Promise<boolean>;
  buildAt: (position: number, type: Exclude<BuildingType, 'empty'>) => Promise<boolean>;
  upgradeBuilding: (id: string) => Promise<boolean>;
  canAfford: (cost: Resources) => boolean;
  canAffordSteel: (amount: number) => boolean;
  totalProduction: Resources;
  steelProduction: number;
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
  attackTarget: (targetName: string, targetPower: number, sentArmy?: Partial<Army>) => BattleLog;
  attackPlayer: (targetUserId: string, targetName: string, targetVillageId: string, sentArmy?: Partial<Army>) => Promise<BattleLog | null>;
  vassalages: Vassalage[];
  payRansom: (vassalageId: string) => Promise<boolean>;
  attemptRebellion: (vassalageId: string) => Promise<boolean>;
  setVassalTributeRate: (vassalageId: string, rate: number) => Promise<boolean>;
  releaseVassal: (vassalageId: string) => Promise<boolean>;
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
  spyTrainingQueue: { count: number; finishTime: number }[];
  intelReports: IntelReport[];
  getWatchtowerLevel: () => number;
  getSpyGuildLevel: () => number;
  // Apothecary
  injuredTroops: InjuredArmy;
  poisons: number;
  healTroops: (type: TroopType, count: number) => boolean;
  craftPoison: (count: number) => boolean;
  getApothecaryLevel: () => number;
  storageCapacity: number;
  myVillages: { id: string; name: string; settlement_type: string }[];
  switchVillage: (villageId: string) => void;
  refreshVillages: () => Promise<void>;
  abandonSettlement: (villageId: string) => Promise<boolean>;
  // Settlement upgrade
  settlementType: 'village' | 'town' | 'city';
  upgradeSettlement: () => Promise<boolean>;
  isSettlementUpgrading: boolean;
  settlementUpgradeFinishTime: number | null;
}

const GameContext = createContext<GameContextType | null>(null);

const EMPTY_ARMY: Army = { militia: 0, archer: 0, knight: 0, cavalry: 0, siege: 0, scout: 0 };
const EMPTY_INJURED: InjuredArmy = { militia: 0, archer: 0, knight: 0, cavalry: 0, siege: 0, scout: 0 };

// March range & speed constants
export const MAX_MARCH_RANGE = 30000; // base max range in world units
export const SCOUT_RANGE_BONUS = 5000; // extra range per scout sent

export function getSlowestTroopSpeed(army: Army): number {
  let slowest = Infinity;
  for (const [type, count] of Object.entries(army) as [TroopType, number][]) {
    if (count > 0) {
      slowest = Math.min(slowest, TROOP_INFO[type].speed);
    }
  }
  return slowest === Infinity ? 10 : slowest;
}

export function calcMarchTime(distance: number, army: Army): number {
  const speed = getSlowestTroopSpeed(army);
  // Higher speed = faster travel. Base: distance / (speed * 200) seconds
  return Math.max(5, Math.floor(distance / (speed * 200)));
}

export const WATCHTOWER_RANGE_BONUS = 3000; // extra range per watchtower level

export function getMaxRange(army: Army, watchtowerLevel: number = 0): number {
  const scoutCount = army.scout || 0;
  return MAX_MARCH_RANGE + scoutCount * SCOUT_RANGE_BONUS + watchtowerLevel * WATCHTOWER_RANGE_BONUS;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resources>({ gold: 0, wood: 0, stone: 0, food: 0 });
  const [steel, setSteel] = useState(0);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [villageNameLocal, setVillageNameLocal] = useState('');
  const [villageId, setVillageId] = useState<string | null>(null);
  const villageIdRef = useRef<string | null>(null);
  useEffect(() => { villageIdRef.current = villageId; }, [villageId]);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [displayNameLocal, setDisplayNameLocal] = useState('Wanderer');
  const [avatarUrl, setAvatarUrlLocal] = useState<string | null>(null);
  const [allVillages, setAllVillages] = useState<PlayerVillage[]>([]);
  const [myVillages, setMyVillages] = useState<{ id: string; name: string; settlement_type: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [army, setArmy] = useState<Army>({ ...EMPTY_ARMY });
  const [trainingQueue, setTrainingQueue] = useState<TrainingQueue[]>([]);
  const [battleLogs, setBattleLogs] = useState<BattleLog[]>([]);
  const [buildQueue, setBuildQueue] = useState<BuildQueue[]>([]);
  const [workerAssignments, setWorkerAssignmentsRaw] = useState<WorkerAssignments>({});
  const setWorkerAssignments = useCallback((updater: WorkerAssignments | ((prev: WorkerAssignments) => WorkerAssignments)) => {
    setWorkerAssignmentsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
  }, []);
  const [populationBase, setPopulationBase] = useState(10);
  const [maxPopBase, setMaxPopBase] = useState(20);
  const [happinessBase, setHappinessBase] = useState(50);
  const [rations, setRationsLocal] = useState<RationsLevel>('normal');
  const [popTaxRate, setPopTaxRateLocal] = useState(5);
  const [spies, setSpies] = useState(0);
  const [spyTrainingQueue, setSpyTrainingQueue] = useState<{ count: number; finishTime: number }[]>([]);
  const [activeSpyMissions, setActiveSpyMissions] = useState<ActiveSpyMission[]>([]);
  const [intelReports, setIntelReports] = useState<IntelReport[]>([]);
  const [vassalages, setVassalages] = useState<Vassalage[]>([]);
  const [injuredTroops, setInjuredTroops] = useState<InjuredArmy>({ ...EMPTY_INJURED });
  const [poisons, setPoisons] = useState(0);
  const [allianceTaxRate, setAllianceTaxRate] = useState(0);
  const [allianceId, setAllianceId] = useState<string | null>(null);
  const pendingTaxAccrualRef = useRef({ gold: 0, wood: 0, stone: 0, food: 0 });
  const pendingTreasuryFlushRef = useRef({ gold: 0, wood: 0, stone: 0, food: 0 });

  // Refs for state that changes inside tick but shouldn't restart the effect.
  // Refs for simple state vars (defined above) — assigned here.
  const steelRef = useRef(steel);
  steelRef.current = steel;
  const populationBaseRef = useRef(populationBase);
  populationBaseRef.current = populationBase;
  const rationsRef = useRef(rations);
  rationsRef.current = rations;
  const popTaxRateRef = useRef(popTaxRate);
  popTaxRateRef.current = popTaxRate;
  const allianceTaxRateRef = useRef(allianceTaxRate);
  allianceTaxRateRef.current = allianceTaxRate;
  const allianceIdRef = useRef(allianceId);
  allianceIdRef.current = allianceId;

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

  // Name & avatar update functions
  const villageName = villageNameLocal;
  const displayName = displayNameLocal;

  const setVillageName = useCallback(async (name: string) => {
    if (!villageId || !name.trim()) return false;
    const trimmed = name.trim().slice(0, 30);
    setVillageNameLocal(trimmed);
    await supabase.from('villages').update({ name: trimmed }).eq('id', villageId);
    return true;
  }, [villageId]);

  const setDisplayName = useCallback(async (name: string) => {
    if (!user || !name.trim()) return false;
    const trimmed = name.trim().slice(0, 20);
    setDisplayNameLocal(trimmed);
    await supabase.from('profiles').update({ display_name: trimmed }).eq('user_id', user.id);
    return true;
  }, [user]);

  const setAvatarUrl = useCallback((url: string | null) => {
    setAvatarUrlLocal(url);
    if (user) {
      supabase.from('profiles').update({ avatar_url: url } as any).eq('user_id', user.id).then();
    }
  }, [user]);

  const loadVillageData = useCallback(async (targetVillageId?: string) => {
    if (!user) return;
    const loadData = async () => {
      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      if (profile) {
        setDisplayNameLocal(profile.display_name);
        setAvatarUrlLocal((profile as any).avatar_url ?? null);
      }

      // Load all user's villages for switching
      const { data: userVillages } = await supabase.from('villages').select('id, name, settlement_type').eq('user_id', user.id).order('created_at', { ascending: true });
      if (userVillages) setMyVillages(userVillages as any);

      // Pick village: use targetVillageId if given, else current, else first
      let village: any = null;
      const pickId = targetVillageId || villageId;
      if (pickId) {
        const { data } = await supabase.from('villages').select('*').eq('id', pickId).eq('user_id', user.id).maybeSingle();
        village = data;
      }
      if (!village && userVillages && userVillages.length > 0) {
        const { data } = await supabase.from('villages').select('*').eq('id', userVillages[0].id).maybeSingle();
        village = data;
      }
      if (village) {
        setVillageId(village.id);
        setVillageNameLocal(village.name);
        setPlayerLevel(village.level);
        settlementTypeRef.current = ((village as any).settlement_type || 'village') as 'village' | 'town' | 'city';
        setSettlementType(settlementTypeRef.current);
        setResources({ gold: Number(village.gold), wood: Number(village.wood), stone: Number(village.stone), food: Number(village.food) });
        setSteel((village as any).steel ?? 0);
        setPopulationBase((village as any).population ?? 10);
        setMaxPopBase((village as any).max_population ?? 20);
        setHappinessBase((village as any).happiness ?? 50);
        setRations(((village as any).rations as RationsLevel) ?? 'normal');
        setPopTaxRate((village as any).pop_tax_rate ?? 5);
        setSpies((village as any).spies ?? 0);
        setPoisons((village as any).poisons ?? 0);
        setInjuredTroops({
          militia: (village as any).injured_militia ?? 0,
          archer: (village as any).injured_archer ?? 0,
          knight: (village as any).injured_knight ?? 0,
          cavalry: (village as any).injured_cavalry ?? 0,
          siege: (village as any).injured_siege ?? 0,
          scout: (village as any).injured_scout ?? 0,
        });
        setArmy({
          militia: (village as any).army_militia ?? 0,
          archer: (village as any).army_archer ?? 0,
          knight: (village as any).army_knight ?? 0,
          cavalry: (village as any).army_cavalry ?? 0,
          siege: (village as any).army_siege ?? 0,
          scout: (village as any).army_scout ?? 0,
        });

        const { data: blds } = await supabase.from('buildings').select('*').eq('village_id', village.id);
        if (blds) {
          // Fix stuck buildings: any building at level 0 means it was being built but the page refreshed before completion
          const stuckBuildings = blds.filter(b => b.level === 0);
          if (stuckBuildings.length > 0) {
            for (const sb of stuckBuildings) {
              await supabase.from('buildings').update({ level: 1 }).eq('id', sb.id);
              sb.level = 1;
            }
          }
          setBuildings(blds.map(b => ({ id: b.id, type: b.type as BuildingType, level: b.level, position: b.position, village_id: b.village_id })));
          // Load worker assignments from DB
          const wa: WorkerAssignments = {};
          for (const b of blds) {
            if ((b as any).workers > 0) wa[b.id] = (b as any).workers;
          }
          setWorkerAssignments(wa);
        }
      }

      // Load persisted queues and catch up on completed items
      const now = Date.now();

      // Build queue
      const { data: bqData } = await supabase.from('build_queue').select('*').eq('user_id', user.id);
      if (bqData && bqData.length > 0) {
        const villageBuilds = bqData.filter((q: any) => q.building_type !== 'outpost_upgrade' && q.building_type !== 'outpost_wall' && q.building_type !== 'settlement_upgrade');
        // Settlement upgrade
        const settlementUpgrade = bqData.find((q: any) => q.building_type === 'settlement_upgrade');
        if (settlementUpgrade) {
          const ft = new Date(settlementUpgrade.finish_time).getTime();
          if (ft > now) {
            setSettlementUpgradeFinishTime(ft);
          } else {
            // Complete it now
            const newType = settlementUpgrade.target_level === 2 ? 'town' : 'city';
            setSettlementType(newType as any);
            settlementTypeRef.current = newType as any;
            if (village) await supabase.from('villages').update({ settlement_type: newType } as any).eq('id', village.id);
            await supabase.from('build_queue').delete().eq('id', settlementUpgrade.id);
          }
        }
        const completed = villageBuilds.filter((q: any) => new Date(q.finish_time).getTime() <= now);
        const active = villageBuilds.filter((q: any) => new Date(q.finish_time).getTime() > now);
        // Process completed items
        for (const q of completed) {
          await supabase.from('buildings').update({ level: q.target_level }).eq('id', q.building_id);
          setBuildings(prev => prev.map(b => b.id === q.building_id ? { ...b, level: q.target_level } : b));
          await supabase.from('build_queue').delete().eq('id', q.id);
        }
        setBuildQueue(active.map((q: any) => ({
          buildingId: q.building_id,
          buildingType: q.building_type as BuildingType,
          targetLevel: q.target_level,
          finishTime: new Date(q.finish_time).getTime(),
        })));
      }

      // Training queue
      const { data: tqData } = await supabase.from('training_queue').select('*').eq('user_id', user.id);
      if (tqData && tqData.length > 0) {
        const completed = tqData.filter((q: any) => new Date(q.finish_time).getTime() <= now);
        const active = tqData.filter((q: any) => new Date(q.finish_time).getTime() > now);
        if (completed.length > 0) {
          const nextArmy = { ...EMPTY_ARMY };
          // Load current army first
          if (village) {
            nextArmy.militia = (village as any).army_militia ?? 0;
            nextArmy.archer = (village as any).army_archer ?? 0;
            nextArmy.knight = (village as any).army_knight ?? 0;
            nextArmy.cavalry = (village as any).army_cavalry ?? 0;
            nextArmy.siege = (village as any).army_siege ?? 0;
            nextArmy.scout = (village as any).army_scout ?? 0;
          }
          for (const q of completed) {
            nextArmy[q.troop_type as TroopType] += q.count;
            await supabase.from('training_queue').delete().eq('id', q.id);
          }
          setArmy(nextArmy);
          await supabase.from('villages').update({
            army_militia: nextArmy.militia, army_archer: nextArmy.archer,
            army_knight: nextArmy.knight, army_cavalry: nextArmy.cavalry,
            army_siege: nextArmy.siege, army_scout: nextArmy.scout,
          }).eq('id', village!.id);
        }
        setTrainingQueue(active.map((q: any) => ({
          type: q.troop_type as TroopType,
          count: q.count,
          finishTime: new Date(q.finish_time).getTime(),
        })));
      }

      // Spy training queue
      const { data: stqData } = await supabase.from('spy_training_queue').select('*').eq('user_id', user.id);
      if (stqData && stqData.length > 0) {
        const completed = stqData.filter((q: any) => new Date(q.finish_time).getTime() <= now);
        const active = stqData.filter((q: any) => new Date(q.finish_time).getTime() > now);
        if (completed.length > 0) {
          const totalNewSpies = completed.reduce((s: number, q: any) => s + q.count, 0);
          const currentSpies = (village as any)?.spies ?? 0;
          setSpies(currentSpies + totalNewSpies);
          await supabase.from('villages').update({ spies: currentSpies + totalNewSpies } as any).eq('id', village!.id);
          for (const q of completed) {
            await supabase.from('spy_training_queue').delete().eq('id', q.id);
          }
        }
        setSpyTrainingQueue(active.map((q: any) => ({
          count: q.count,
          finishTime: new Date(q.finish_time).getTime(),
        })));
      }

      // Active spy missions
      const { data: asmData } = await supabase.from('active_spy_missions').select('*').eq('user_id', user.id);
      if (asmData && asmData.length > 0) {
        setActiveSpyMissions(asmData.map((m: any) => ({
          id: m.id,
          mission: m.mission as SpyMission,
          targetName: m.target_name,
          targetId: m.target_id,
          spiesCount: m.spies_count,
          departTime: new Date(m.depart_time).getTime(),
          arrivalTime: new Date(m.arrival_time).getTime(),
          returnTime: new Date(m.arrival_time).getTime() + 15000, // reconstruct return time
          phase: new Date(m.arrival_time).getTime() <= now ? 'operating' : 'traveling',
        })));
      }

      // Intel reports
      const { data: irData } = await supabase.from('intel_reports').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30);
      if (irData && irData.length > 0) {
        setIntelReports(irData.map((r: any) => ({
          id: r.id,
          targetName: r.target_name,
          targetId: '',
          mission: r.mission as SpyMission,
          result: r.success ? 'success' : 'failure',
          timestamp: new Date(r.created_at).getTime(),
          data: r.data,
          spiesLost: r.spies_lost,
        })));
      }

      const { data: villages } = await supabase.from('villages').select('*').limit(50);
      if (villages) {
        const { data: profiles } = await supabase.from('profiles').select('*');
        const profileMap = new Map((profiles || []).map(p => [p.user_id, { display_name: p.display_name, avatar_emoji: p.avatar_emoji }]));
        setAllVillages(villages.map(v => ({
          village: { id: v.id, user_id: v.user_id, name: v.name, gold: Number(v.gold), wood: Number(v.wood), stone: Number(v.stone), food: Number(v.food), level: v.level, map_x: v.map_x, map_y: v.map_y, settlement_type: (v as any).settlement_type || 'village' },
          profile: profileMap.get(v.user_id) || { display_name: 'Unknown', avatar_emoji: '🛡️' },
        })));
      }

      const loadVassalages = async () => {
        const { data: vassals } = await supabase.from('vassalages')
          .select('*')
          .or(`lord_id.eq.${user.id},vassal_id.eq.${user.id}`)
          .eq('status', 'active');
        setVassalages((vassals || []) as any as Vassalage[]);
      };

      // Load vassalages
      await loadVassalages();

      // Load alliance membership & tax rate
      const { data: membership } = await supabase.from('alliance_members')
        .select('alliance_id')
        .eq('user_id', user.id)
        .limit(1);
      if (membership && membership.length > 0) {
        const aid = membership[0].alliance_id;
        setAllianceId(aid);
        const { data: alliance } = await supabase.from('alliances')
          .select('tax_rate')
          .eq('id', aid)
          .single();
        if (alliance) setAllianceTaxRate(alliance.tax_rate);
      } else {
        setAllianceId(null);
        setAllianceTaxRate(0);
      }

      setLoading(false);
    };
    loadData();
  }, [user, villageId]);

  // Initial load
  useEffect(() => {
    loadVillageData();
  }, [user]);

  const switchVillage = useCallback((newVillageId: string) => {
    if (newVillageId === villageId) return;
    setLoading(true);
    loadVillageData(newVillageId);
  }, [villageId, loadVillageData]);

  const refreshVillages = useCallback(async () => {
    if (!user) return;
    const { data: userVillages } = await supabase.from('villages').select('id, name, settlement_type').eq('user_id', user.id).order('created_at', { ascending: true });
    if (userVillages) setMyVillages(userVillages as any);
  }, [user]);

  const abandonSettlement = useCallback(async (abandonId: string) => {
    if (!user) return false;
    if (myVillages.length <= 1) {
      toast.error('Cannot abandon your last settlement!');
      return false;
    }
    // Delete buildings first, then village
    await supabase.from('buildings').delete().eq('village_id', abandonId);
    await supabase.from('build_queue').delete().eq('user_id', user.id);
    const { error } = await supabase.from('villages').delete().eq('id', abandonId).eq('user_id', user.id);
    if (error) {
      toast.error('Failed to abandon settlement');
      return false;
    }
    // Also remove matching outpost if exists
    await supabase.from('outposts').delete().eq('user_id', user.id).eq('outpost_type', 'settlement');
    const remaining = myVillages.filter(v => v.id !== abandonId);
    setMyVillages(remaining);
    if (villageId === abandonId && remaining.length > 0) {
      loadVillageData(remaining[0].id);
    }
    toast.success('Settlement abandoned');
    return true;
  }, [user, myVillages, villageId, loadVillageData]);

  // Realtime subscriptions
  useEffect(() => {
    if (!user) return;

    const villageChannel = supabase.channel('village-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'villages', filter: `user_id=eq.${user.id}` }, (payload) => {
        const v = payload.new;
        // Only handle updates for current village
        if (v.id !== villageIdRef.current) return;
        // Skip resource fields — they're managed locally via client-side production ticks
        setVillageNameLocal(v.name as string);
        setPlayerLevel(v.level as number);
        setSteel((v as any).steel ?? 0);
        setPopulationBase((v as any).population ?? 10);
        setMaxPopBase((v as any).max_population ?? 20);
        setHappinessBase((v as any).happiness ?? 50);
        setRationsLocal(((v as any).rations as RationsLevel) ?? 'normal');
        setPopTaxRateLocal((v as any).pop_tax_rate ?? 5);
        setArmy({
          militia: (v as any).army_militia ?? 0,
          archer: (v as any).army_archer ?? 0,
          knight: (v as any).army_knight ?? 0,
          cavalry: (v as any).army_cavalry ?? 0,
          siege: (v as any).army_siege ?? 0,
          scout: (v as any).army_scout ?? 0,
        });
        setSpies((v as any).spies ?? 0);
        setPoisons((v as any).poisons ?? 0);
        setInjuredTroops({
          militia: (v as any).injured_militia ?? 0,
          archer: (v as any).injured_archer ?? 0,
          knight: (v as any).injured_knight ?? 0,
          cavalry: (v as any).injured_cavalry ?? 0,
          siege: (v as any).injured_siege ?? 0,
          scout: (v as any).injured_scout ?? 0,
        });
      }).subscribe();

    const vassalageChannel = supabase.channel(`vassalage-changes-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vassalages', filter: `lord_id=eq.${user.id}` }, () => {
        void loadVillageData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vassalages', filter: `vassal_id=eq.${user.id}` }, () => {
        void loadVillageData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(villageChannel);
      supabase.removeChannel(vassalageChannel);
    };
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

  // Food cost of population = (civilians + workers) * rations multiplier
  // Workers still need to eat! Only soldiers have separate upkeep.
  const popFoodCost = useMemo(() => {
    const nonSoldiers = Math.max(0, populationBase - totalSoldiers);
    return Math.floor(nonSoldiers * RATIONS_INFO[rations].foodMultiplier);
  }, [populationBase, totalSoldiers, rations]);

  // Tax income from population
  const popTaxIncome = useMemo(() => {
    const civilians = Math.max(0, populationBase - totalWorkers - totalSoldiers);
    // Each civilian produces 0.5 gold base, scaled by tax rate percentage
    // At 5% rate with 10 civilians: 10 * 0.5 * 5/10 = 2.5 → 2 gold/min
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

  // Settlement type — loaded from DB, upgraded explicitly
  const settlementTypeRef = useRef<'village' | 'town' | 'city'>('village');
  const [settlementType, setSettlementType] = useState<'village' | 'town' | 'city'>('village');
  const [settlementUpgradeFinishTime, setSettlementUpgradeFinishTime] = useState<number | null>(null);
  const isSettlementUpgrading = settlementUpgradeFinishTime !== null && settlementUpgradeFinishTime > Date.now();

  // Settlement upgrade costs & requirements
  const SETTLEMENT_UPGRADES = {
    village: { next: 'town' as const, label: 'Town', thRequired: 10, cost: { gold: 15000, wood: 12000, stone: 10000, food: 8000 }, steelCost: 50, buildTimeSec: 7200 }, // 2 hours
    town: { next: 'city' as const, label: 'City', thRequired: 10, cost: { gold: 80000, wood: 75000, stone: 70000, food: 60000 }, steelCost: 200, buildTimeSec: 86400 }, // 24 hours
    city: null, // max
  };

  // Process settlement upgrade timer
  useEffect(() => {
    if (!settlementUpgradeFinishTime) return;
    if (settlementUpgradeFinishTime <= Date.now()) {
      // Upgrade complete
      const upgrade = SETTLEMENT_UPGRADES[settlementType];
      if (upgrade) {
        const newType = upgrade.next;
        setSettlementType(newType);
        settlementTypeRef.current = newType;
        setSettlementUpgradeFinishTime(null);
        if (villageId) supabase.from('villages').update({ settlement_type: newType } as any).eq('id', villageId).then();
        setMyVillages(prev => prev.map(v => v.id === villageId ? { ...v, settlement_type: newType } : v));
        toast.success(`🏗️ Settlement upgraded to ${upgrade.label}! New building slots unlocked.`);
      }
      return;
    }
    const timer = setTimeout(() => {
      const upgrade = SETTLEMENT_UPGRADES[settlementType];
      if (upgrade) {
        const newType = upgrade.next;
        setSettlementType(newType);
        settlementTypeRef.current = newType;
        setSettlementUpgradeFinishTime(null);
        if (villageId) supabase.from('villages').update({ settlement_type: newType } as any).eq('id', villageId).then();
        setMyVillages(prev => prev.map(v => v.id === villageId ? { ...v, settlement_type: newType } : v));
        toast.success(`🏗️ Settlement upgraded to ${upgrade.label}! New building slots unlocked.`);
      }
    }, settlementUpgradeFinishTime - Date.now());
    return () => clearTimeout(timer);
  }, [settlementUpgradeFinishTime, settlementType, villageId]);

  const upgradeSettlement = useCallback(async (): Promise<boolean> => {
    if (!villageId || !user) return false;
    const upgrade = SETTLEMENT_UPGRADES[settlementType];
    if (!upgrade) { toast.error('Already at maximum settlement level!'); return false; }
    if (townhallLevel < upgrade.thRequired) { toast.error(`Town Hall must be level ${upgrade.thRequired} to upgrade!`); return false; }
    if (!canAfford(upgrade.cost)) { toast.error('Not enough resources!'); return false; }
    if (upgrade.steelCost > 0 && !canAffordSteel(upgrade.steelCost)) { toast.error('Not enough steel!'); return false; }
    if (isSettlementUpgrading) { toast.error('Settlement upgrade already in progress!'); return false; }

    const newResources = {
      gold: resources.gold - upgrade.cost.gold,
      wood: resources.wood - upgrade.cost.wood,
      stone: resources.stone - upgrade.cost.stone,
      food: resources.food - upgrade.cost.food,
    };
    setResources(newResources);
    if (upgrade.steelCost > 0) setSteel(prev => prev - upgrade.steelCost);
    await supabase.from('villages').update({ ...newResources, steel: steel - upgrade.steelCost } as any).eq('id', villageId);

    const finishTime = Date.now() + upgrade.buildTimeSec * 1000;
    setSettlementUpgradeFinishTime(finishTime);
    // Store in build_queue for persistence
    supabase.from('build_queue').insert({
      user_id: user.id, building_id: villageId, building_type: 'settlement_upgrade',
      target_level: upgrade.next === 'town' ? 2 : 3,
      finish_time: new Date(finishTime).toISOString(),
    } as any).then();

    toast.success(`🏗️ Upgrading to ${upgrade.label}! This will take ${Math.floor(upgrade.buildTimeSec / 3600)}h.`);
    return true;
  }, [villageId, user, settlementType, townhallLevel, canAfford, canAffordSteel, resources, steel, isSettlementUpgrading]);

  // Player level = Town Hall level
  useEffect(() => {
    const th = buildings.find(b => b.type === 'townhall');
    if (th) {
      setPlayerLevel(th.level);
      // Sync to DB
      if (villageId) {
        supabase.from('villages').update({ level: th.level }).eq('id', villageId).then();
      }
    }
  }, [buildings, villageId]);

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

  // Steel production from quarries at level 3+
  const steelProduction = useMemo(() => {
    return buildings.reduce((acc, b) => {
      if (b.type === 'empty') return acc;
      const workers = workerAssignments[b.id] || 0;
      return acc + getSteelProduction(b.type, b.level, workers);
    }, 0);
  }, [buildings, workerAssignments]);

  // Net production: gross - army upkeep - pop food cost + pop tax income
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

  // Army upkeep
  const armyUpkeep = useCallback(() => {
    let foodCost = 0, goldCost = 0;
    for (const [type, count] of Object.entries(army)) {
      const info = TROOP_INFO[type as TroopType];
      foodCost += info.foodUpkeep * count;
      goldCost += info.goldUpkeep * count;
    }
    return { food: foodCost, gold: goldCost };
  }, [army]);

  // Refs for computed values (defined above) — keeps tick stable
  const grossProductionRef = useRef(grossProduction);
  grossProductionRef.current = grossProduction;
  const popFoodCostRef = useRef(popFoodCost);
  popFoodCostRef.current = popFoodCost;
  const popTaxIncomeRef = useRef(popTaxIncome);
  popTaxIncomeRef.current = popTaxIncome;
  const happinessRef = useRef(happiness);
  happinessRef.current = happiness;
  const maxPopulationRef = useRef(maxPopulation);
  maxPopulationRef.current = maxPopulation;
  const resourcesRef = useRef(resources);
  resourcesRef.current = resources;

  // Storage capacity: base 2000 + 500 per level per warehouse building + 500 per village level
  const storageCapacity = useMemo(() => {
    const villageLevel = buildings.find(b => b.type === 'townhall')?.level || 1;
    const warehouseLevels = buildings.filter(b => b.type === 'warehouse').reduce((sum, b) => sum + b.level, 0);
    return 2000 + (villageLevel - 1) * 500 + warehouseLevels * 500;
  }, [buildings]);
  const storageCapRef = useRef(storageCapacity);
  storageCapRef.current = storageCapacity;

  const totalProductionRef = useRef(totalProduction);
  totalProductionRef.current = totalProduction;
  const steelProductionRef = useRef(steelProduction);
  steelProductionRef.current = steelProduction;
  const armyRef = useRef(army);
  armyRef.current = army;

  const persistArmyToVillage = useCallback((nextArmy: Army) => {
    if (!villageId) return;

    supabase.from('villages').update({
      army_militia: nextArmy.militia,
      army_archer: nextArmy.archer,
      army_knight: nextArmy.knight,
      army_cavalry: nextArmy.cavalry,
      army_siege: nextArmy.siege,
      army_scout: nextArmy.scout,
    } as any).eq('id', villageId).then();
  }, [villageId]);

  // Deploy troops: subtract sent troops from village immediately when march begins
  const deployTroops = useCallback((sentArmy: Partial<Army>) => {
    setArmy(prev => {
      const next = { ...prev };
      for (const [type, count] of Object.entries(sentArmy) as [TroopType, number][]) {
        if (count > 0) next[type] = Math.max(0, (next[type] || 0) - count);
      }
      persistArmyToVillage(next);
      return next;
    });
  }, [persistArmyToVillage]);

  // Return troops: add surviving troops back to village after march completes
  const returnTroops = useCallback((survivors: Partial<Army>) => {
    setArmy(prev => {
      const next = { ...prev };
      for (const [type, count] of Object.entries(survivors) as [TroopType, number][]) {
        if (count > 0) next[type] = (next[type] || 0) + count;
      }
      persistArmyToVillage(next);
      return next;
    });
  }, [persistArmyToVillage]);

  useEffect(() => {
    if (!villageId || !user) return;

    // Call server-side resource tick on load to sync DB
    const tickUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resource-tick`;
    fetch(tickUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    }).catch(() => {});

    // Interpolate resources locally every 2 seconds for visible trickle
    // Cap at storage capacity
    let lastDesertionTime = 0;
    const tickInterval = setInterval(() => {
      const prod = totalProductionRef.current;
      const steelProd = steelProductionRef.current;
      const fraction = 2 / 60;
      const cap = storageCapRef.current;
      
      setResources(prev => {
        const newFood = Math.min(cap, Math.max(0, prev.food + prod.food * fraction));
        
        const now = Date.now();
        if (newFood <= 0 && prod.food < 0 && now - lastDesertionTime > 30000) {
          const currentArmy = armyRef.current;
          const desertOrder: TroopType[] = ['siege', 'cavalry', 'knight', 'archer', 'militia', 'scout'];
          for (const t of desertOrder) {
            if (currentArmy[t] > 0) {
              const nextArmy = { ...currentArmy, [t]: currentArmy[t] - 1 };
              setArmy(nextArmy);
              persistArmyToVillage(nextArmy);
              setPopulationBase(p => Math.max(1, p - TROOP_INFO[t].popCost));
              toast.error(`⚠️ A ${TROOP_INFO[t].name} deserted due to starvation!`);
              lastDesertionTime = now;
              break;
            }
          }
        }
        
        return {
          gold: Math.min(cap, Math.max(0, prev.gold + prod.gold * fraction)),
          wood: Math.min(cap, Math.max(0, prev.wood + prod.wood * fraction)),
          stone: Math.min(cap, Math.max(0, prev.stone + prod.stone * fraction)),
          food: newFood,
        };
      });
      if (steelProd > 0) {
        setSteel(prev => Math.max(0, prev + steelProd * fraction));
      }
    }, 2000);

    // Alliance tax rate refresh
    // Periodically sync with server every 2 minutes
    const serverSync = setInterval(() => {
      fetch(tickUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      }).catch(() => {});
    }, 120000);

    const taxRefresh = setInterval(async () => {
      const aid = allianceIdRef.current;
      if (!aid) return;
      const { data } = await supabase.from('alliances').select('tax_rate').eq('id', aid).single();
      if (data) setAllianceTaxRate(data.tax_rate);
    }, 60000);

    return () => { clearInterval(tickInterval); clearInterval(serverSync); clearInterval(taxRefresh); };
  }, [villageId, user]);

  // Persist injured troops whenever they change
  const injuredInitRef = useRef(false);
  useEffect(() => {
    if (!villageId || !injuredInitRef.current) { injuredInitRef.current = true; return; }
    supabase.from('villages').update({
      injured_militia: injuredTroops.militia, injured_archer: injuredTroops.archer,
      injured_knight: injuredTroops.knight, injured_cavalry: injuredTroops.cavalry,
      injured_siege: injuredTroops.siege, injured_scout: injuredTroops.scout,
    } as any).eq('id', villageId).then();
  }, [injuredTroops, villageId]);

  // Persist poisons whenever they change
  const poisonsInitRef = useRef(false);
  useEffect(() => {
    if (!villageId || !poisonsInitRef.current) { poisonsInitRef.current = true; return; }
    supabase.from('villages').update({ poisons } as any).eq('id', villageId).then();
  }, [poisons, villageId]);


  useEffect(() => {
    if (trainingQueue.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setTrainingQueue(prev => {
        const completed = prev.filter(q => q.finishTime <= now);
        const remaining = prev.filter(q => q.finishTime > now);
        if (completed.length > 0) {
          const nextArmy = { ...armyRef.current };
          completed.forEach(q => { nextArmy[q.type] += q.count; });
          setArmy(nextArmy);
          persistArmyToVillage(nextArmy);
          // Clean up completed entries from DB
          supabase.from('training_queue').delete().lte('finish_time', new Date(now).toISOString()).eq('user_id', user?.id ?? '').then();
          // Push notification
          const summary = completed.map(q => `${q.count} ${q.type}`).join(', ');
          supabase.functions.invoke('send-push', {
            body: { user_id: user?.id, title: '⚔️ Training Complete', body: `${summary} ready for battle!`, tag: 'training-done' },
          }).catch(() => {});
        }
        return remaining;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [trainingQueue.length, persistArmyToVillage, user?.id]);

  // Spy training queue processing
  useEffect(() => {
    if (spyTrainingQueue.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setSpyTrainingQueue(prev => {
        const completed = prev.filter(q => q.finishTime <= now);
        const remaining = prev.filter(q => q.finishTime > now);
        if (completed.length > 0) {
          const totalSpies = completed.reduce((s, q) => s + q.count, 0);
          setSpies(p => {
            const newVal = p + totalSpies;
            // Persist spies to village
            if (villageId) supabase.from('villages').update({ spies: newVal } as any).eq('id', villageId).then();
            return newVal;
          });
          // Clean up from DB
          supabase.from('spy_training_queue').delete().lte('finish_time', new Date(now).toISOString()).eq('user_id', user?.id ?? '').then();
          // Push notification
          supabase.functions.invoke('send-push', {
            body: { user_id: user?.id, title: '🕵️ Spy Training Complete', body: `${totalSpies} spy${totalSpies > 1 ? 's' : ''} ready for missions!`, tag: 'spy-training-done' },
          }).catch(() => {});
        }
        return remaining;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [spyTrainingQueue.length, villageId, user?.id]);


  useEffect(() => {
    if (buildQueue.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setBuildQueue(prev => {
        const completed = prev.filter(q => q.finishTime <= now);
        const remaining = prev.filter(q => q.finishTime > now);
        if (completed.length > 0) {
          completed.forEach(q => {
            supabase.from('buildings').update({ level: q.targetLevel }).eq('id', q.buildingId).then();
            setBuildings(prevB => prevB.map(b => b.id === q.buildingId ? { ...b, level: q.targetLevel } : b));
          });
          // Clean up from DB
          supabase.from('build_queue').delete().lte('finish_time', new Date(now).toISOString()).eq('user_id', user?.id ?? '').not('building_type', 'in', '(outpost_upgrade,outpost_wall)').then();
          // Push notification
          const names = completed.map(q => {
            const info = BUILDING_INFO[q.buildingType];
            return info ? `${info.name} Lv.${q.targetLevel}` : q.buildingType;
          });
          supabase.functions.invoke('send-push', {
            body: { user_id: user?.id, title: '🏗️ Construction Complete', body: `${names.join(', ')} finished!`, tag: 'build-done' },
          }).catch(() => {});
        }
        return remaining;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [buildQueue.length, user?.id]);

  const getBuildTime = useCallback((type: Exclude<BuildingType, 'empty'>, level: number) => {
    const info = BUILDING_INFO[type];
    return Math.floor(info.buildTime * 3 * Math.pow(1.3, level)); // 3x base, scales with level
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
    
    // Count troops currently in the training queue (not yet added to army)
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
    // Check army cap INCLUDING troops currently training
    if (totalSoldiers + queuedSoldiers + popNeeded > armyCap) { console.log('[trainTroops] FAIL: over army cap (including queued)', { totalSoldiers, queuedSoldiers, popNeeded, armyCap }); return false; }
    if (population.civilians < popNeeded) { console.log('[trainTroops] FAIL: not enough civilians', { civilians: population.civilians, popNeeded }); return false; }

    const newResources = {
      gold: resources.gold - totalCost.gold, wood: resources.wood - totalCost.wood,
      stone: resources.stone - totalCost.stone, food: resources.food - totalCost.food,
    };
    setResources(newResources);
    const newSteel = totalSteelCost > 0 ? steel - totalSteelCost : steel;
    if (totalSteelCost > 0) setSteel(newSteel);
    // Persist to DB
    if (villageId) {
      supabase.from('villages').update({ ...newResources, steel: newSteel }).eq('id', villageId).then();
    }
    const finishTime = Date.now() + info.trainTime * 1000 * count;
    setTrainingQueue(prev => [...prev, { type, count, finishTime }]);
    // Persist to training_queue table
    if (user) supabase.from('training_queue').insert({ user_id: user.id, troop_type: type, count, finish_time: new Date(finishTime).toISOString() } as any).then();
    return true;
  }, [canAfford, canAffordSteel, getBarracksLevel, totalSoldiers, armyCap, population.civilians, resources, steel, villageId, user, trainingQueue]);

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

  const getWallLevel = useCallback(() => {
    const wall = buildings.find(b => b.type === 'wall');
    return wall?.level || 0;
  }, [buildings]);

  const attackTarget = useCallback((targetName: string, targetPower: number, sentArmy?: Partial<Army>) => {
    // Troops were already deployed (subtracted) when the march started.
    // sentArmy represents the troops that marched — resolve combat with them.
    const attackingArmy: Army = sentArmy ? {
      militia: sentArmy.militia ?? 0, archer: sentArmy.archer ?? 0, knight: sentArmy.knight ?? 0,
      cavalry: sentArmy.cavalry ?? 0, siege: sentArmy.siege ?? 0, scout: sentArmy.scout ?? 0,
    } : { ...army };
    const fakeDefenderArmy: Army = {
      militia: Math.floor(targetPower / 8),
      archer: Math.floor(targetPower / 16),
      knight: Math.floor(targetPower / 25),
      cavalry: Math.floor(targetPower / 30),
      siege: 0,
      scout: 0,
    };
    const result = resolveCombat(attackingArmy, fakeDefenderArmy, 0, Math.floor(targetPower / 50));
    
    // Calculate survivors from the sent army and return them to village
    const survivors: Partial<Army> = {};
    let popLost = 0;
    const apothLvl = getApothecaryLevel();
    const injuryRate = apothLvl > 0 ? Math.min(0.6, 0.2 + apothLvl * 0.08) : 0;
    const newInjured: Partial<Army> = {};
    for (const type of Object.keys(attackingArmy) as TroopType[]) {
      const sent = attackingArmy[type] || 0;
      const lost = Math.min(result.attackerLosses[type] || 0, sent);
      const injured = Math.floor(lost * injuryRate);
      const dead = lost - injured;
      const surviving = sent - lost;
      if (surviving > 0) survivors[type] = surviving;
      if (injured > 0) newInjured[type] = injured;
      popLost += TROOP_INFO[type].popCost * dead;
    }
    // Return surviving troops to village
    if (Object.values(survivors).some(v => v && v > 0)) returnTroops(survivors);
    if (Object.keys(newInjured).length > 0) setInjuredTroops(prev => {
      const u = { ...prev };
      for (const [t, c] of Object.entries(newInjured) as [TroopType, number][]) u[t] += c;
      return u;
    });
    if (popLost > 0) setPopulationBase(prev => Math.max(1, prev - popLost));
    
    const resourcesGained = result.victory ? {
      gold: Math.floor(targetPower * 0.5 + Math.random() * 200),
      wood: Math.floor(targetPower * 0.3 + Math.random() * 100),
      stone: Math.floor(targetPower * 0.2 + Math.random() * 80),
      food: Math.floor(targetPower * 0.1 + Math.random() * 50),
    } : undefined;
    if (resourcesGained) addResources(resourcesGained);
    
    const log: BattleLog = {
      id: Date.now().toString(), target: targetName, result: result.victory ? 'victory' : 'defeat',
      troopsLost: result.attackerLosses, defenderTroopsLost: result.defenderLosses,
      resourcesGained, timestamp: Date.now(),
    };
    setBattleLogs(prev => [log, ...prev].slice(0, 20));
    return log;
  }, [army, addResources, returnTroops]);

  // PvP attack against another player
  const attackPlayer = useCallback(async (targetUserId: string, targetName: string, targetVillageId: string, sentArmy?: Partial<Army>): Promise<BattleLog | null> => {
    if (!user || !villageId) return null;
    const attackingArmy: Army = sentArmy ? {
      militia: sentArmy.militia ?? 0, archer: sentArmy.archer ?? 0, knight: sentArmy.knight ?? 0,
      cavalry: sentArmy.cavalry ?? 0, siege: sentArmy.siege ?? 0, scout: sentArmy.scout ?? 0,
    } : { ...army };
    
    // Prevent lords from attacking their own vassals
    const isMyVassal = vassalages.some(v => v.lord_id === user.id && v.vassal_id === targetUserId && v.status === 'active');
    if (isMyVassal) {
      return null;
    }
    
    // Fetch defender's village data (troops, resources, buildings)
    const { data: defVillage } = await supabase.from('villages').select('*').eq('id', targetVillageId).single();
    if (!defVillage) return null;
    
    const defArmy: Army = {
      militia: (defVillage as any).army_militia ?? 0,
      archer: (defVillage as any).army_archer ?? 0,
      knight: (defVillage as any).army_knight ?? 0,
      cavalry: (defVillage as any).army_cavalry ?? 0,
      siege: (defVillage as any).army_siege ?? 0,
      scout: (defVillage as any).army_scout ?? 0,
    };
    
    // Get defender's wall level
    const { data: defBuildings } = await supabase.from('buildings').select('*').eq('village_id', targetVillageId);
    const defWall = defBuildings?.find(b => b.type === 'wall');
    const defWallLevel = defWall?.level || 0;
    
    const result = resolveCombat(attackingArmy, defArmy, getWallLevel(), defWallLevel);
    
    // Troops were already deployed when march started — calculate survivors and return them
    const survivors: Partial<Army> = {};
    let pvpPopLost = 0;
    const pvpApothLvl = getApothecaryLevel();
    const pvpInjuryRate = pvpApothLvl > 0 ? Math.min(0.6, 0.2 + pvpApothLvl * 0.08) : 0;
    const pvpInjured: Partial<Army> = {};
    for (const type of Object.keys(attackingArmy) as TroopType[]) {
      const sent = attackingArmy[type] || 0;
      const lost = Math.min(result.attackerLosses[type] || 0, sent);
      const injured = Math.floor(lost * pvpInjuryRate);
      const dead = lost - injured;
      const surviving = sent - lost;
      if (surviving > 0) survivors[type] = surviving;
      if (injured > 0) pvpInjured[type] = injured;
      pvpPopLost += TROOP_INFO[type].popCost * dead;
    }
    // Return surviving troops to village
    if (Object.values(survivors).some(v => v && v > 0)) returnTroops(survivors);
    if (Object.keys(pvpInjured).length > 0) setInjuredTroops(prev => {
      const u = { ...prev };
      for (const [t, c] of Object.entries(pvpInjured) as [TroopType, number][]) u[t] += c;
      return u;
    });
    if (pvpPopLost > 0) setPopulationBase(prev => Math.max(1, prev - pvpPopLost));
    
    // Apply defender losses to their village
    const defNewArmy = { ...defArmy };
    for (const [type, lost] of Object.entries(result.defenderLosses) as [TroopType, number][]) {
      defNewArmy[type] = Math.max(0, (defNewArmy[type] || 0) - lost);
    }
    await supabase.from('villages').update({
      army_militia: defNewArmy.militia, army_archer: defNewArmy.archer,
      army_knight: defNewArmy.knight, army_cavalry: defNewArmy.cavalry, army_siege: defNewArmy.siege,
      army_scout: defNewArmy.scout,
    } as any).eq('id', targetVillageId);
    
    let resourcesRaided: Partial<Resources> | undefined;
    let buildingDamaged: string | undefined;
    let buildingDamageLevels = 0;
    let vassalized = false;
    
    if (result.victory) {
      // Raid resources: steal 15-30% based on power ratio, but NEVER more than what the defender has
      const raidPercent = Math.min(0.3, 0.15 + result.powerRatio * 0.05);
      const defGold = Math.max(0, Number(defVillage.gold));
      const defWood = Math.max(0, Number(defVillage.wood));
      const defStone = Math.max(0, Number(defVillage.stone));
      const defFood = Math.max(0, Number(defVillage.food));
      resourcesRaided = {
        gold: Math.min(Math.floor(defGold * raidPercent), defGold),
        wood: Math.min(Math.floor(defWood * raidPercent), defWood),
        stone: Math.min(Math.floor(defStone * raidPercent), defStone),
        food: Math.min(Math.floor(defFood * raidPercent), defFood),
      };
      
      // Only give attacker what's actually taken — skip if nothing to raid
      const totalRaided = (resourcesRaided.gold || 0) + (resourcesRaided.wood || 0) + (resourcesRaided.stone || 0) + (resourcesRaided.food || 0);
      if (totalRaided > 0) {
        addResources(resourcesRaided);
        await supabase.from('villages').update({
          gold: defGold - (resourcesRaided.gold || 0),
          wood: defWood - (resourcesRaided.wood || 0),
          stone: defStone - (resourcesRaided.stone || 0),
          food: defFood - (resourcesRaided.food || 0),
        } as any).eq('id', targetVillageId);
      } else {
        resourcesRaided = undefined; // Nothing to raid
      }
      
      // Building damage: random building loses 1 level if power ratio > 1.5
      if (result.powerRatio > 1.5 && defBuildings && defBuildings.length > 0) {
        const damageable = defBuildings.filter(b => b.level > 1 && b.type !== 'townhall');
        if (damageable.length > 0) {
          const target = damageable[Math.floor(Math.random() * damageable.length)];
          buildingDamaged = target.type;
          buildingDamageLevels = 1;
          await supabase.from('buildings').update({ level: target.level - 1 }).eq('id', target.id);
        }
      }
      
      // Vassalization: if power ratio >= 3:1
      if (result.powerRatio >= 3) {
        const { data: existingVassal } = await supabase.from('vassalages')
          .select('*').eq('lord_id', user.id).eq('vassal_id', targetUserId).eq('status', 'active').maybeSingle();
        
        if (!existingVassal) {
          const ransomGold = Math.floor(
            (Number(defVillage.gold) + Number(defVillage.wood) + Number(defVillage.stone)) * 0.5
          );
          const { data: newVassal } = await supabase.from('vassalages').insert({
            lord_id: user.id,
            vassal_id: targetUserId,
            tribute_rate: 10,
            ransom_gold: Math.max(500, ransomGold),
          } as any).select().single();
          
          if (newVassal) {
            vassalized = true;
            setVassalages(prev => [...prev, newVassal as any as Vassalage]);
            
            // Notify the vassal via player message
            await supabase.from('player_messages').insert({
              sender_id: user.id,
              receiver_id: targetUserId,
              content: `⛓️ You have been conquered by ${displayName} and are now a vassal! You must pay ${Math.max(500, ransomGold)} gold ransom or rebel after 24 hours to regain your freedom. ${Math.floor(10)}% of your production will be taken as tribute.`,
            } as any);
          }
        }
      }
    }
    
    const log: BattleLog = {
      id: Date.now().toString(),
      target: targetName,
      targetUserId,
      result: result.victory ? 'victory' : 'defeat',
      troopsLost: result.attackerLosses,
      defenderTroopsLost: result.defenderLosses,
      resourcesGained: resourcesRaided,
      buildingDamaged,
      buildingDamageLevels,
      vassalized,
      timestamp: Date.now(),
    };
    setBattleLogs(prev => [log, ...prev].slice(0, 20));
    
    // Save battle report to DB
    await supabase.from('battle_reports').insert({
      attacker_id: user.id,
      defender_id: targetUserId,
      attacker_name: displayName,
      defender_name: targetName,
      result: log.result,
      attacker_troops_sent: attackingArmy,
      attacker_troops_lost: result.attackerLosses,
      defender_troops_lost: result.defenderLosses,
      resources_raided: resourcesRaided || {},
      building_damaged: buildingDamaged,
      building_damage_levels: buildingDamageLevels,
      vassalized,
    } as any);
    
    return log;
  }, [army, user, villageId, addResources, displayName, getWallLevel, vassalages, returnTroops]);

  // Vassal: pay ransom to break free
  const payRansom = useCallback(async (vassalageId: string): Promise<boolean> => {
    const v = vassalages.find(va => va.id === vassalageId);
    if (!v || v.vassal_id !== user?.id) return false;
    if (resources.gold < v.ransom_gold) return false;
    
    setResources(prev => ({ ...prev, gold: prev.gold - v.ransom_gold }));
    await supabase.from('vassalages').update({ status: 'ended', ended_at: new Date().toISOString() } as any).eq('id', vassalageId);
    setVassalages(prev => prev.filter(va => va.id !== vassalageId));
    return true;
  }, [vassalages, user, resources]);

  // Vassal: attempt rebellion (combat check after 24h)
  const attemptRebellion = useCallback(async (vassalageId: string): Promise<boolean> => {
    const v = vassalages.find(va => va.id === vassalageId);
    if (!v || v.vassal_id !== user?.id) return false;
    if (new Date(v.rebellion_available_at) > new Date()) return false;
    
    // Fetch lord's army
    const { data: lordVillage } = await supabase.from('villages').select('*').eq('user_id', v.lord_id).single();
    if (!lordVillage) return false;
    
    const lordArmy: Army = {
      militia: (lordVillage as any).army_militia ?? 0,
      archer: (lordVillage as any).army_archer ?? 0,
      knight: (lordVillage as any).army_knight ?? 0,
      cavalry: (lordVillage as any).army_cavalry ?? 0,
      siege: (lordVillage as any).army_siege ?? 0,
      scout: (lordVillage as any).army_scout ?? 0,
    };
    
    // Rebellion: vassal attacks with their army vs lord's army (reduced - lords don't send full force)
    const reducedLordArmy: Army = {
      militia: Math.floor(lordArmy.militia * 0.5),
      archer: Math.floor(lordArmy.archer * 0.5),
      knight: Math.floor(lordArmy.knight * 0.5),
      cavalry: Math.floor(lordArmy.cavalry * 0.5),
      siege: Math.floor(lordArmy.siege * 0.5),
      scout: Math.floor(lordArmy.scout * 0.5),
    };
    
    const result = resolveCombat(army, reducedLordArmy, 0, 0);
    
    // Apply losses (with injury system)
    const newArmy = { ...army };
    let rebelPopLost = 0;
    const rebelApothLvl = getApothecaryLevel();
    const rebelInjuryRate = rebelApothLvl > 0 ? Math.min(0.6, 0.2 + rebelApothLvl * 0.08) : 0;
    const rebelInjured: Partial<Army> = {};
    for (const [type, lost] of Object.entries(result.attackerLosses) as [TroopType, number][]) {
      const actualLost = Math.min(lost, newArmy[type] || 0);
      const injured = Math.floor(actualLost * rebelInjuryRate);
      const dead = actualLost - injured;
      newArmy[type] = Math.max(0, (newArmy[type] || 0) - actualLost);
      if (injured > 0) rebelInjured[type] = injured;
      rebelPopLost += TROOP_INFO[type].popCost * dead;
    }
    setArmy(newArmy);
    persistArmyToVillage(newArmy);
    if (Object.keys(rebelInjured).length > 0) setInjuredTroops(prev => {
      const u = { ...prev };
      for (const [t, c] of Object.entries(rebelInjured) as [TroopType, number][]) u[t] += c;
      return u;
    });
    if (rebelPopLost > 0) setPopulationBase(prev => Math.max(1, prev - rebelPopLost));
    
    if (result.victory) {
      await supabase.from('vassalages').update({ status: 'ended', ended_at: new Date().toISOString() } as any).eq('id', vassalageId);
      setVassalages(prev => prev.filter(va => va.id !== vassalageId));
      return true;
    } else {
      // Failed rebellion — reset timer
      const newTimer = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('vassalages').update({ rebellion_available_at: newTimer } as any).eq('id', vassalageId);
      setVassalages(prev => prev.map(va => va.id === vassalageId ? { ...va, rebellion_available_at: newTimer } : va));
      return false;
    }
  }, [vassalages, user, army, persistArmyToVillage]);

  // Lord: change vassal tribute rate
  const setVassalTributeRate = useCallback(async (vassalageId: string, rate: number): Promise<boolean> => {
    const v = vassalages.find(va => va.id === vassalageId);
    if (!v || v.lord_id !== user?.id) return false;
    const clampedRate = Math.max(0, Math.min(50, rate));
    await supabase.from('vassalages').update({ tribute_rate: clampedRate } as any).eq('id', vassalageId);
    setVassalages(prev => prev.map(va => va.id === vassalageId ? { ...va, tribute_rate: clampedRate } : va));
    return true;
  }, [vassalages, user]);

  // Lord: release a vassal
  const releaseVassal = useCallback(async (vassalageId: string): Promise<boolean> => {
    const v = vassalages.find(va => va.id === vassalageId);
    if (!v || v.lord_id !== user?.id) return false;
    await supabase.from('vassalages').update({ status: 'ended', ended_at: new Date().toISOString() } as any).eq('id', vassalageId);
    setVassalages(prev => prev.filter(va => va.id !== vassalageId));
    return true;
  }, [vassalages, user]);

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
    const newCount = current + 1;
    setWorkerAssignments(prev => ({ ...prev, [buildingId]: newCount }));
    // Persist to DB
    supabase.from('buildings').update({ workers: newCount } as any).eq('id', buildingId).then();
    return true;
  }, [buildings, workerAssignments, population.civilians, getMaxWorkers]);

  const unassignWorker = useCallback((buildingId: string) => {
    const current = workerAssignments[buildingId] || 0;
    if (current <= 0) return false;
    const newCount = current - 1;
    setWorkerAssignments(prev => ({ ...prev, [buildingId]: newCount }));
    // Persist to DB
    supabase.from('buildings').update({ workers: newCount } as any).eq('id', buildingId).then();
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
    const finishTime = Date.now() + buildTime * 1000;
    setBuildQueue(prev => [...prev, { buildingId: data.id, buildingType: type as BuildingType, targetLevel: 1, finishTime }]);
    // Persist build queue to DB
    supabase.from('build_queue').insert({ user_id: user.id, building_id: data.id, building_type: type, target_level: 1, finish_time: new Date(finishTime).toISOString() } as any).then();
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
    const finishTime = Date.now() + buildTime * 1000;
    setBuildQueue(prev => [...prev, { buildingId: id, buildingType: building.type as BuildingType, targetLevel: newLevel, finishTime }]);
    // Persist build queue to DB
    supabase.from('build_queue').insert({ user_id: user.id, building_id: id, building_type: building.type, target_level: newLevel, finish_time: new Date(finishTime).toISOString() } as any).then();
    return true;
  }, [buildings, villageId, user, resources, canAfford, canAffordSteel, buildQueue, getBuildTime]);

  // Demolish building (returns 30% resources, can't demolish townhall)
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
  }, [buildings, villageId, user, buildQueue, resources]);

  // Watchtower level (for espionage defense)
  const getWatchtowerLevel = useCallback(() => {
    const wt = buildings.find(b => b.type === 'watchtower');
    return wt?.level || 0;
  }, [buildings]);

  // Apothecary level
  const getApothecaryLevel = useCallback(() => {
    const apoth = buildings.find(b => b.type === 'apothecary');
    return apoth?.level || 0;
  }, [buildings]);

  // Heal injured troops (requires apothecary)
  const healTroops = useCallback((type: TroopType, count: number) => {
    const apothLvl = getApothecaryLevel();
    if (apothLvl === 0) return false;
    const available = injuredTroops[type];
    const toHeal = Math.min(count, available);
    if (toHeal <= 0) return false;
    // Cost: food + gold per troop, reduced by apothecary level
    const costMult = Math.max(0.4, 1 - apothLvl * 0.1);
    const info = TROOP_INFO[type];
    const healCost = { gold: Math.floor(info.cost.gold * 0.3 * costMult * toHeal), wood: 0, stone: 0, food: Math.floor(info.cost.food * 0.5 * costMult * toHeal) };
    if (!canAfford(healCost)) return false;
    const newResources = { gold: resources.gold - healCost.gold, wood: resources.wood, stone: resources.stone, food: resources.food - healCost.food };
    setResources(newResources);
    const newInjured = { ...injuredTroops, [type]: injuredTroops[type] - toHeal };
    setInjuredTroops(newInjured);
    // Healing takes time based on apothecary level
    const healTime = Math.max(5, Math.floor(15 / apothLvl)) * toHeal;
    const finishTime = Date.now() + healTime * 1000;
    setTrainingQueue(prev => [...prev, { type, count: toHeal, finishTime }]);
    // Persist to DB
    if (villageId) {
      const injuredKey = `injured_${type}` as string;
      supabase.from('villages').update({ ...newResources, [injuredKey]: newInjured[type] } as any).eq('id', villageId).then();
    }
    if (user) {
      supabase.from('training_queue').insert({ user_id: user.id, troop_type: type, count: toHeal, finish_time: new Date(finishTime).toISOString() } as any).then();
    }
    return true;
  }, [getApothecaryLevel, injuredTroops, canAfford, resources, villageId, user]);

  // Craft poison (requires apothecary lvl 2+, used by spies for bonus sabotage)
  const craftPoison = useCallback((count: number) => {
    const apothLvl = getApothecaryLevel();
    if (apothLvl < 2) return false;
    const cost = { gold: 60 * count, wood: 0, stone: 0, food: 30 * count };
    if (!canAfford(cost)) return false;
    setResources(prev => ({ gold: prev.gold - cost.gold, wood: prev.wood, stone: prev.stone, food: prev.food - cost.food }));
    // Crafting takes time
    setTimeout(() => setPoisons(prev => prev + count), 15000 * count);
    return true;
  }, [getApothecaryLevel, canAfford]);

  // Spy Guild level
  const getSpyGuildLevel = useCallback(() => {
    const sg = buildings.find(b => b.type === 'spyguild');
    return sg?.level || 0;
  }, [buildings]);

  // Train spies (requires spy guild, costs gold + food + 1 pop each)
   const trainSpies = useCallback((count: number) => {
    const sgLevel = getSpyGuildLevel();
    console.log('[trainSpies]', { count, spyGuildLvl: sgLevel, civilians: population.civilians, gold: resources.gold, food: resources.food });
    if (sgLevel < 1) { console.log('[trainSpies] FAIL: no spy guild'); return false; }
    const cost = { gold: 40 * count, wood: 0, stone: 0, food: 20 * count };
    if (!canAfford(cost)) { console.log('[trainSpies] FAIL: cant afford'); return false; }
    if (population.civilians < count) { console.log('[trainSpies] FAIL: not enough civilians'); return false; }
    const newResources = { gold: resources.gold - cost.gold, wood: resources.wood, stone: resources.stone, food: resources.food - cost.food };
    setResources(newResources);
    // Persist resource deduction to DB
    if (villageId) {
      supabase.from('villages').update(newResources).eq('id', villageId).then();
    }
    // Spies train faster with higher spy guild level
    const baseTime = 20000;
    const speedMultiplier = Math.max(0.4, 1 - (sgLevel - 1) * 0.15); // 15% faster per level
    const finishTime = Date.now() + Math.floor(baseTime * count * speedMultiplier);
    setSpyTrainingQueue(prev => [...prev, { count, finishTime }]);
    // Persist to spy_training_queue table
    if (user) supabase.from('spy_training_queue').insert({ user_id: user.id, count, finish_time: new Date(finishTime).toISOString() } as any).then();
    return true;
  }, [canAfford, getSpyGuildLevel, population.civilians, resources, villageId, user]);

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
    // Persist to DB and update spies count
    if (user) {
      supabase.from('active_spy_missions').insert({
        id: missionObj.id, user_id: user.id, mission, target_name: targetName,
        target_id: targetId, spies_count: missionObj.spiesCount,
        depart_time: new Date(missionObj.departTime).toISOString(),
        arrival_time: new Date(missionObj.arrivalTime).toISOString(),
        target_x: targetX, target_y: targetY,
      } as any).then();
      supabase.from('villages').update({ spies: spies - info.spiesRequired * spiesCount, gold: resources.gold - goldCost } as any).eq('user_id', user.id).then();
    }
    return true;
  }, [spies, resources.gold, user]);

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
            const spiesLost = caught ? m.spiesCount : 0;
            if (!caught) {
              setSpies(p => {
                const newVal = p + m.spiesCount;
                if (villageId) supabase.from('villages').update({ spies: newVal } as any).eq('id', villageId).then();
                return newVal;
              });
            }

            setIntelReports(prev => [report, ...prev].slice(0, 30));
            // Persist intel report and clean up mission from DB
            if (user) {
              supabase.from('intel_reports').insert({
                user_id: user.id, target_name: m.targetName, mission: m.mission,
                success: report.result === 'success', data: report.data || {}, spies_lost: spiesLost,
              } as any).then();
              supabase.from('active_spy_missions').delete().eq('id', m.id).then();
            }
          });
        }
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSpyMissions.length, getWatchtowerLevel, villageId, user]);

  return (
    <GameContext.Provider value={{
      resources, steel, buildings, villageName, villageId, playerLevel, displayName, avatarUrl,
      setDisplayName, setVillageName, setAvatarUrl,
      demolishBuilding, buildAt, upgradeBuilding, canAfford, canAffordSteel, totalProduction, steelProduction, allVillages, loading,
      army, trainingQueue, buildQueue, battleLogs, trainTroops, getBarracksLevel, totalArmyPower, addResources, addSteel, attackTarget, armyUpkeep,
      population, workerAssignments, assignWorker, unassignWorker, getMaxWorkers,
      rations, setRations, popTaxRate, setPopTaxRate, popFoodCost, popTaxIncome,
      isBuildingUpgrading, getBuildTime,
      spies, trainSpies, sendSpyMission, activeSpyMissions, spyTrainingQueue, intelReports, getWatchtowerLevel, getSpyGuildLevel,
      attackPlayer, vassalages, payRansom, attemptRebellion, setVassalTributeRate, releaseVassal, getWallLevel,
      injuredTroops, poisons, healTroops, craftPoison, getApothecaryLevel,
      storageCapacity,
      myVillages, switchVillage, refreshVillages, abandonSettlement,
      settlementType, upgradeSettlement, isSettlementUpgrading, settlementUpgradeFinishTime,
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
