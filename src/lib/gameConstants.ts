import type {
  BuildingType, BuildingInfo, Resources, TroopType, TroopInfo,
  SpyMission, SpyMissionInfo, Army, SettlementTier, SubLevelUpgrade,
} from './gameTypes';

// ============ BUILDING INFO ============
// Camp tier buildings have small costs, low maxLevels
// Village/Town/City buildings scale up

export const BUILDING_INFO: Record<Exclude<BuildingType, 'empty'>, BuildingInfo> = {
  // === CAMP TIER (tier 1) ===
  campfire:    { name: 'Campfire', icon: '🔥', description: 'Heart of your camp. Upgrade to unlock new structures.', baseCost: { gold: 10, wood: 15, stone: 5, food: 0 }, maxLevel: 20, workersPerLevel: 0, buildTime: 15, requiredTier: 1 },
  tent:        { name: 'Tent', icon: '⛺', description: 'Provides basic shelter. Houses 3 people per level.', baseCost: { gold: 5, wood: 10, stone: 0, food: 0 }, maxLevel: 10, workersPerLevel: 0, housingPerLevel: 3, buildTime: 10, requiredTier: 1 },
  lean_to:     { name: 'Lean-To', icon: '🏕️', description: 'Simple storage shelter. +100 storage per level.', baseCost: { gold: 5, wood: 15, stone: 5, food: 0 }, maxLevel: 10, workersPerLevel: 0, buildTime: 12, requiredTier: 1 },
  forager:     { name: 'Foraging Spot', icon: '🌿', description: 'Gather berries and roots. Produces food.', baseCost: { gold: 5, wood: 5, stone: 0, food: 0 }, baseProduction: { food: 1 }, maxLevel: 10, workersPerLevel: 1, buildTime: 8, requiredTier: 1 },
  woodpile:    { name: 'Woodpile', icon: '🪵', description: 'Chop and store wood.', baseCost: { gold: 5, wood: 3, stone: 0, food: 0 }, baseProduction: { wood: 1 }, maxLevel: 10, workersPerLevel: 1, buildTime: 8, requiredTier: 1 },
  stone_cache: { name: 'Stone Cache', icon: '🪨', description: 'Collect stones from the land.', baseCost: { gold: 5, wood: 5, stone: 3, food: 0 }, baseProduction: { stone: 1 }, maxLevel: 10, workersPerLevel: 1, buildTime: 10, requiredTier: 1 },
  lookout:     { name: 'Lookout Post', icon: '👁️', description: 'Watch for threats. Extends visibility.', baseCost: { gold: 10, wood: 10, stone: 5, food: 0 }, maxLevel: 5, workersPerLevel: 1, buildTime: 15, requiredTier: 1 },

  // === VILLAGE TIER (tier 2) ===
  townhall:    { name: 'Town Hall', icon: '🏰', description: 'Administrative center. Unlocks advanced buildings.', baseCost: { gold: 100, wood: 50, stone: 50, food: 0 }, steelCost: 5, maxLevel: 20, workersPerLevel: 0, buildTime: 60, requiredTier: 2 },
  house:       { name: 'House', icon: '🏠', description: 'Housing for settlers. +8 pop per level.', baseCost: { gold: 20, wood: 40, stone: 20, food: 0 }, maxLevel: 15, workersPerLevel: 0, housingPerLevel: 8, buildTime: 30, requiredTier: 2 },
  farm:        { name: 'Farm', icon: '🌾', description: 'Grows food. Workers boost output.', baseCost: { gold: 30, wood: 40, stone: 10, food: 0 }, baseProduction: { food: 2 }, maxLevel: 15, workersPerLevel: 1, buildTime: 25, requiredTier: 2 },
  lumbermill:  { name: 'Lumber Mill', icon: '🪓', description: 'Harvests wood efficiently.', baseCost: { gold: 30, wood: 10, stone: 20, food: 0 }, baseProduction: { wood: 2 }, maxLevel: 15, workersPerLevel: 1, buildTime: 25, requiredTier: 2 },
  quarry:      { name: 'Quarry', icon: '⛏️', description: 'Mines stone from the earth.', baseCost: { gold: 40, wood: 20, stone: 10, food: 0 }, baseProduction: { stone: 1 }, maxLevel: 15, workersPerLevel: 1, buildTime: 30, requiredTier: 2 },
  goldmine:    { name: 'Gold Mine', icon: '💰', description: 'Extracts gold from veins.', baseCost: { gold: 10, wood: 30, stone: 40, food: 0 }, steelCost: 3, baseProduction: { gold: 1 }, maxLevel: 15, workersPerLevel: 1, buildTime: 35, requiredTier: 2 },
  barracks:    { name: 'Barracks', icon: '⚔️', description: 'Train warriors.', baseCost: { gold: 80, wood: 60, stone: 40, food: 20 }, steelCost: 8, maxLevel: 10, workersPerLevel: 2, buildTime: 50, requiredTier: 2 },
  wall:        { name: 'Wall', icon: '🧱', description: 'Defenses against attackers.', baseCost: { gold: 20, wood: 10, stone: 60, food: 0 }, steelCost: 4, maxLevel: 10, workersPerLevel: 0, buildTime: 40, requiredTier: 2 },
  watchtower:  { name: 'Watchtower', icon: '🗼', description: 'Spots incoming attacks.', baseCost: { gold: 50, wood: 40, stone: 30, food: 0 }, maxLevel: 8, workersPerLevel: 1, buildTime: 35, requiredTier: 2 },
  warehouse:   { name: 'Warehouse', icon: '🏪', description: '+500 storage per level.', baseCost: { gold: 50, wood: 80, stone: 60, food: 0 }, maxLevel: 10, workersPerLevel: 0, buildTime: 30, requiredTier: 2 },

  // === TOWN TIER (tier 3) ===
  temple:       { name: 'Temple', icon: '⛪', description: 'Increases happiness through worship.', baseCost: { gold: 60, wood: 30, stone: 50, food: 0 }, steelCost: 2, maxLevel: 10, workersPerLevel: 1, buildTime: 60, requiredTier: 3 },
  apothecary:   { name: 'Apothecary', icon: '⚗️', description: 'Heal injured troops and craft poisons.', baseCost: { gold: 70, wood: 30, stone: 30, food: 20 }, steelCost: 2, maxLevel: 8, workersPerLevel: 1, buildTime: 50, requiredTier: 3 },
  spyguild:     { name: 'Spy Guild', icon: '🕵️', description: 'Train spies for espionage missions.', baseCost: { gold: 100, wood: 50, stone: 40, food: 30 }, steelCost: 5, maxLevel: 5, workersPerLevel: 2, buildTime: 60, requiredTier: 3 },
  administrator:{ name: 'Administrator', icon: '📜', description: 'Automates settlement growth.', baseCost: { gold: 200, wood: 100, stone: 80, food: 50 }, steelCost: 3, maxLevel: 1, workersPerLevel: 0, buildTime: 90, requiredTier: 3 },
  market:       { name: 'Market', icon: '🏪', description: 'Enables trade routes. +5% gold per level.', baseCost: { gold: 80, wood: 50, stone: 40, food: 0 }, maxLevel: 10, workersPerLevel: 1, buildTime: 45, requiredTier: 3 },
  smithy:       { name: 'Smithy', icon: '🔨', description: 'Produces steel from iron. Workers boost output.', baseCost: { gold: 100, wood: 40, stone: 60, food: 0 }, steelCost: 2, maxLevel: 10, workersPerLevel: 1, buildTime: 55, requiredTier: 3 },

  // === CITY TIER (tier 4) ===
  castle:        { name: 'Castle', icon: '🏯', description: 'Ultimate stronghold. Massive defense bonus.', baseCost: { gold: 500, wood: 300, stone: 400, food: 100 }, steelCost: 50, maxLevel: 10, workersPerLevel: 0, buildTime: 180, requiredTier: 4 },
  university:    { name: 'University', icon: '📚', description: 'Research new technologies. Unlocks special units.', baseCost: { gold: 400, wood: 200, stone: 200, food: 100 }, steelCost: 20, maxLevel: 10, workersPerLevel: 2, buildTime: 120, requiredTier: 4 },
  grand_temple:  { name: 'Grand Temple', icon: '🕌', description: 'Maximum happiness bonus. Cultural influence.', baseCost: { gold: 300, wood: 150, stone: 250, food: 50 }, steelCost: 15, maxLevel: 5, workersPerLevel: 1, buildTime: 150, requiredTier: 4 },
  fortress_wall: { name: 'Fortress Wall', icon: '🏰', description: 'Impenetrable fortification. Massive defense.', baseCost: { gold: 200, wood: 100, stone: 500, food: 0 }, steelCost: 30, maxLevel: 10, workersPerLevel: 0, buildTime: 120, requiredTier: 4 },
};

// Cost scaling: gentle 1.3x per level instead of 1.5x
export function getUpgradeCost(type: Exclude<BuildingType, 'empty'>, level: number): Resources & { steel: number } {
  const info = BUILDING_INFO[type];
  const mult = Math.pow(1.3, level);
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
  const workerBonus = 1 + workers * 0.25;
  for (const [key, val] of Object.entries(info.baseProduction)) {
    // Smaller per-level gains: linear instead of multiplicative
    result[key as keyof Resources] = Math.floor(val * (1 + (level - 1) * 0.15) * workerBonus);
  }
  return result;
}

export function getSteelProduction(_type: Exclude<BuildingType, 'empty'>, _level: number, _workers: number = 0): number {
  return 0;
}

// ============ RATIONS ============
export function getRationsEffect(level: number): { label: string; foodMultiplier: number; happinessBonus: number; description: string } {
  const clamped = Math.max(0, Math.min(100, level));
  let foodMultiplier: number;
  let happinessBonus: number;
  if (clamped <= 50) {
    const t = clamped / 50;
    foodMultiplier = 0.5 + t * 0.5;
    happinessBonus = -15 + t * 15;
  } else {
    const t = (clamped - 50) / 50;
    foodMultiplier = 1.0 + t * 1.0;
    happinessBonus = t * 15;
  }
  happinessBonus = Math.round(happinessBonus);
  foodMultiplier = Math.round(foodMultiplier * 100) / 100;
  const label = clamped <= 20 ? 'Scarce' : clamped <= 40 ? 'Lean' : clamped <= 60 ? 'Normal' : clamped <= 80 ? 'Plentiful' : 'Generous';
  const description = `${foodMultiplier}× food consumption, ${happinessBonus >= 0 ? '+' : ''}${happinessBonus} happiness.`;
  return { label, foodMultiplier, happinessBonus, description };
}

export const RATIONS_INFO = {
  scarce: getRationsEffect(0),
  normal: getRationsEffect(50),
  generous: getRationsEffect(100),
};

// ============ TROOPS ============
export const TROOP_INFO: Record<TroopType, TroopInfo> = {
  militia: { name: 'Militia', emoji: '🗡️', description: 'Basic foot soldiers.', attack: 5, defense: 3, speed: 10, cost: { gold: 20, wood: 10, stone: 0, food: 10 }, steelCost: 0, trainTime: 15, requiredBarracksLevel: 1, foodUpkeep: 1, goldUpkeep: 0, popCost: 1 },
  archer:  { name: 'Archer', emoji: '🏹', description: 'Ranged units.', attack: 8, defense: 2, speed: 8, cost: { gold: 35, wood: 25, stone: 0, food: 15 }, steelCost: 0, trainTime: 25, requiredBarracksLevel: 2, foodUpkeep: 1, goldUpkeep: 0, popCost: 1 },
  knight:  { name: 'Knight', emoji: '🛡️', description: 'Heavily armored. Requires steel.', attack: 10, defense: 12, speed: 6, cost: { gold: 60, wood: 10, stone: 30, food: 25 }, steelCost: 5, trainTime: 40, requiredBarracksLevel: 3, foodUpkeep: 2, goldUpkeep: 1, popCost: 2 },
  cavalry: { name: 'Cavalry', emoji: '🐴', description: 'Fast mounted warriors.', attack: 14, defense: 6, speed: 18, cost: { gold: 80, wood: 20, stone: 0, food: 40 }, steelCost: 8, trainTime: 50, requiredBarracksLevel: 4, foodUpkeep: 3, goldUpkeep: 1, popCost: 2 },
  siege:   { name: 'Siege Ram', emoji: '🏗️', description: 'Siege engine.', attack: 25, defense: 4, speed: 3, cost: { gold: 120, wood: 80, stone: 50, food: 30 }, steelCost: 15, trainTime: 90, requiredBarracksLevel: 5, foodUpkeep: 4, goldUpkeep: 1, popCost: 3 },
  scout:   { name: 'Scout', emoji: '🏃', description: 'Fast recon unit.', attack: 2, defense: 1, speed: 25, cost: { gold: 15, wood: 5, stone: 0, food: 10 }, steelCost: 0, trainTime: 10, requiredBarracksLevel: 1, foodUpkeep: 1, goldUpkeep: 0, popCost: 1 },
};

export const SPY_MISSION_INFO: Record<SpyMission, SpyMissionInfo> = {
  scout: { name: 'Scout', emoji: '🔍', description: 'Gather intel on a target.', goldCost: 50, baseSuccessRate: 0.75, spiesRequired: 1 },
  sabotage: { name: 'Sabotage', emoji: '💣', description: 'Destroy resources and damage buildings.', goldCost: 120, baseSuccessRate: 0.45, spiesRequired: 2 },
  demoralize: { name: 'Demoralize', emoji: '😈', description: 'Decrease target happiness.', goldCost: 80, baseSuccessRate: 0.55, spiesRequired: 1 },
};

export const TROOP_COUNTERS: Record<TroopType, { strongVs: TroopType[]; weakVs: TroopType[] }> = {
  militia: { strongVs: ['cavalry'], weakVs: ['archer'] },
  archer: { strongVs: ['militia'], weakVs: ['cavalry'] },
  knight: { strongVs: ['militia', 'archer'], weakVs: ['siege'] },
  cavalry: { strongVs: ['archer', 'siege'], weakVs: ['militia', 'knight'] },
  siege: { strongVs: ['knight'], weakVs: ['cavalry'] },
  scout: { strongVs: [], weakVs: ['militia', 'archer', 'knight', 'cavalry'] },
};

export function resolveCombat(
  attackerArmy: Army, defenderArmy: Army,
  attackerWallLevel: number = 0, defenderWallLevel: number = 0,
): { victory: boolean; attackerLosses: Partial<Army>; defenderLosses: Partial<Army>; powerRatio: number } {
  const calcEffectivePower = (army: Army, enemyArmy: Army, isDefender: boolean, wallLevel: number) => {
    let totalAtk = 0, totalDef = 0;
    const totalEnemyUnits = Object.values(enemyArmy).reduce((s, c) => s + Math.max(0, c), 0);
    for (const [type, count] of Object.entries(army) as [TroopType, number][]) {
      if (count <= 0) continue;
      const info = TROOP_INFO[type];
      let atk = info.attack * count;
      const def = info.defense * count;
      if (totalEnemyUnits > 0) {
        const counters = TROOP_COUNTERS[type];
        for (const [enemyType, enemyCount] of Object.entries(enemyArmy) as [TroopType, number][]) {
          if (enemyCount <= 0) continue;
          const proportion = enemyCount / totalEnemyUnits;
          if (counters.strongVs.includes(enemyType)) atk += info.attack * count * 0.3 * proportion;
          if (counters.weakVs.includes(enemyType)) atk -= info.attack * count * 0.15 * proportion;
        }
      }
      totalAtk += Math.max(0, atk);
      totalDef += def;
    }
    if (isDefender) totalDef += wallLevel * 8;
    return { attack: totalAtk, defense: totalDef };
  };

  const atkPower = calcEffectivePower(attackerArmy, defenderArmy, false, 0);
  const defPower = calcEffectivePower(defenderArmy, attackerArmy, true, defenderWallLevel);
  const attackerScore = (atkPower.attack + atkPower.defense * 0.3) * (0.9 + Math.random() * 0.2);
  const defenderScore = (defPower.attack * 0.7 + defPower.defense) * (0.9 + Math.random() * 0.2);
  const victory = attackerScore > defenderScore;
  const powerRatio = attackerScore / Math.max(1, defenderScore);
  const attackerLossRate = victory ? Math.min(0.4, 1 / (powerRatio * 2)) : Math.min(0.8, 0.3 + 1 / (powerRatio * 3));
  const defenderLossRate = victory ? Math.min(0.7, powerRatio * 0.3) : Math.min(0.3, powerRatio * 0.15);
  const attackerLosses: Partial<Army> = {};
  const defenderLosses: Partial<Army> = {};
  for (const [type, count] of Object.entries(attackerArmy) as [TroopType, number][]) {
    if (count > 0) attackerLosses[type] = Math.max(1, Math.floor(count * attackerLossRate));
  }
  for (const [type, count] of Object.entries(defenderArmy) as [TroopType, number][]) {
    if (count > 0) defenderLosses[type] = Math.max(1, Math.floor(count * defenderLossRate));
  }
  return { victory, attackerLosses, defenderLosses, powerRatio };
}

export const MAX_MARCH_RANGE = 30000;
export const SCOUT_RANGE_BONUS = 5000;

export function getSlowestTroopSpeed(army: Army): number {
  let slowest = Infinity;
  for (const [type, count] of Object.entries(army) as [TroopType, number][]) {
    if (count > 0) slowest = Math.min(slowest, TROOP_INFO[type].speed);
  }
  return slowest === Infinity ? 10 : slowest;
}

export function calcMarchTime(distance: number, army: Army): number {
  const speed = getSlowestTroopSpeed(army);
  const base = Math.floor(distance / (speed * 200));
  const scoutBonus = Math.min(0.30, (army.scout || 0) * 0.03);
  return Math.max(5, Math.floor(base * (1 - scoutBonus)));
}

export const WATCHTOWER_RANGE_BONUS = 3000;

export function getMaxRange(army: Army, watchtowerLevel: number = 0): number {
  return MAX_MARCH_RANGE + (army.scout || 0) * SCOUT_RANGE_BONUS + watchtowerLevel * WATCHTOWER_RANGE_BONUS;
}

// ============ SETTLEMENT TIER PROGRESSION ============
// Each tier has 15-20 sub-levels. Upgrading tier requires reaching max sub-level + resources.

export const SETTLEMENT_UPGRADES: Record<string, { next: string; nextTier: SettlementTier; label: string; maxSubLevel: number; cost: Resources; steelCost: number; buildTimeSec: number } | null> = {
  camp:    { next: 'village', nextTier: 2, label: 'Village', maxSubLevel: 20, cost: { gold: 500, wood: 400, stone: 300, food: 200 }, steelCost: 0, buildTimeSec: 300 },
  village: { next: 'town', nextTier: 3, label: 'Town', maxSubLevel: 20, cost: { gold: 5000, wood: 4000, stone: 3000, food: 2000 }, steelCost: 25, buildTimeSec: 3600 },
  town:    { next: 'city', nextTier: 4, label: 'City', maxSubLevel: 20, cost: { gold: 30000, wood: 25000, stone: 20000, food: 15000 }, steelCost: 100, buildTimeSec: 14400 },
  city:    null,
};

// Sub-level upgrades for each tier (what you get per sub-level)
export function getSubLevelUpgrade(tier: SettlementTier, subLevel: number): SubLevelUpgrade {
  const baseCostMult = Math.pow(1.2, subLevel - 1);
  const tierMult = Math.pow(3, tier - 1);

  return {
    subLevel,
    name: `Upgrade ${subLevel}`,
    description: `Improve your settlement infrastructure.`,
    cost: {
      gold: Math.floor(20 * tierMult * baseCostMult),
      wood: Math.floor(15 * tierMult * baseCostMult),
      stone: Math.floor(10 * tierMult * baseCostMult),
      food: Math.floor(5 * tierMult * baseCostMult),
    },
    steelCost: tier >= 3 ? Math.floor(2 * baseCostMult) : 0,
    buildTimeSec: Math.floor(30 * tier * baseCostMult),
    bonuses: {
      productionBonus: 3, // +3% per sub-level
      storageBonus: 50 * tier,
      populationBonus: tier,
      defenseBonus: tier >= 2 ? 2 : 0,
    },
  };
}

// Which buildings are available at each tier
export function getBuildingsForTier(tier: SettlementTier): Exclude<BuildingType, 'empty'>[] {
  const all: Exclude<BuildingType, 'empty'>[] = [];
  for (const [type, info] of Object.entries(BUILDING_INFO)) {
    if (info.requiredTier <= tier) {
      all.push(type as Exclude<BuildingType, 'empty'>);
    }
  }
  return all;
}

export function isCastle(townhallLevel: number): boolean {
  return townhallLevel >= 20;
}

export function getMaxBuildingLevel(type: Exclude<BuildingType, 'empty'>, townhallLevel: number): number {
  const base = BUILDING_INFO[type].maxLevel;
  if (type === 'townhall') return base;
  return isCastle(townhallLevel) ? 20 : base;
}

// === ROAD SYSTEM ===
export const ROAD_INFO: Record<number, { name: string; emoji: string; speedBonus: number; cost: Resources & { steel: number } }> = {
  1: { name: 'Dirt Road', emoji: '🟫', speedBonus: 0.20, cost: { gold: 50, wood: 100, stone: 50, food: 0, steel: 0 } },
  2: { name: 'Cobblestone Road', emoji: '🪨', speedBonus: 0.40, cost: { gold: 150, wood: 50, stone: 200, food: 0, steel: 5 } },
  3: { name: 'Paved Road', emoji: '🛤️', speedBonus: 0.60, cost: { gold: 400, wood: 100, stone: 500, food: 0, steel: 15 } },
};
export const MAX_ROAD_LEVEL = 3;

export const TRADE_INTERVALS = [
  { label: 'Every 5 min', seconds: 300 },
  { label: 'Every 15 min', seconds: 900 },
  { label: 'Every 30 min', seconds: 1800 },
  { label: 'Every 1 hour', seconds: 3600 },
];
