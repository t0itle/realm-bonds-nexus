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

// === RATIONS SYSTEM ===
export type RationsLevel = 'scarce' | 'normal' | 'generous';

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
