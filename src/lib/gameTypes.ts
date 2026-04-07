export interface Building {
  id: string;
  type: BuildingType;
  level: number;
  position: number;
  village_id: string;
}

// Camp-tier buildings + Village-tier + Town-tier + City-tier
export type BuildingType =
  // Camp tier (tier 1)
  | 'campfire' | 'tent' | 'lean_to' | 'forager' | 'woodpile' | 'stone_cache' | 'lookout'
  // Village tier (tier 2)
  | 'townhall' | 'farm' | 'lumbermill' | 'quarry' | 'goldmine' | 'house' | 'barracks' | 'wall' | 'watchtower' | 'warehouse'
  // Town tier (tier 3)
  | 'temple' | 'apothecary' | 'spyguild' | 'administrator' | 'market' | 'smithy'
  // City tier (tier 4)
  | 'castle' | 'university' | 'grand_temple' | 'fortress_wall'
  // Empty slot
  | 'empty';

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
  buildTime: number;
  requiredTier: number; // minimum settlement tier to build
}

// Settlement tiers
export type SettlementTier = 1 | 2 | 3 | 4;

export const SETTLEMENT_TIER_NAMES: Record<SettlementTier, string> = {
  1: 'Camp',
  2: 'Village',
  3: 'Town',
  4: 'City',
};

export const SETTLEMENT_TIER_MAX_SUB: Record<SettlementTier, number> = {
  1: 20,
  2: 20,
  3: 20,
  4: 15,
};

/** 0 = scarce, 50 = normal, 100 = generous (continuous slider) */
export type RationsLevel = number;

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

export interface Army {
  militia: number;
  archer: number;
  knight: number;
  cavalry: number;
  siege: number;
  scout: number;
}

export type InjuredArmy = Army;

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
  baseSuccessRate: number;
  spiesRequired: number;
}

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
  targetX: number;
  targetY: number;
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
  settlement_tier: number;
  settlement_sub_level: number;
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

// === WORLD MAP TYPES ===
export interface WorldBurg {
  id: string;
  burg_id: number;
  name: string;
  x: number;
  y: number;
  state_id: number;
  state_name: string;
  culture_name: string;
  population: number;
  burg_type: string;
  burg_group: string;
  has_citadel: boolean;
  has_walls: boolean;
  has_temple: boolean;
  has_port: boolean;
  color: string;
}

export interface WorldState {
  id: string;
  state_id: number;
  name: string;
  color: string;
  capital_burg_id: number;
  culture_name: string;
  state_type: string;
}

// Sub-level upgrade info
export interface SubLevelUpgrade {
  subLevel: number;
  name: string;
  description: string;
  cost: Resources;
  steelCost: number;
  buildTimeSec: number;
  unlocks?: string; // what this sub-level unlocks
  bonuses?: {
    productionBonus?: number; // percentage
    storageBonus?: number;
    populationBonus?: number;
    defenseBonus?: number;
  };
}
