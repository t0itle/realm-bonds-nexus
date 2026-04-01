import type {
  BuildingType, BuildingInfo, Resources, RationsLevel, TroopType, TroopInfo,
  SpyMission, SpyMissionInfo, Army,
} from './gameTypes';

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
    result[key as keyof Resources] = Math.floor(val * level * 1.2 * workerBonus * 0.72); // 28% nerf (20% + 10%)
  }
  return result;
}

/** Steel production: now comes only from captured iron mines on the map */
export function getSteelProduction(_type: Exclude<BuildingType, 'empty'>, _level: number, _workers: number = 0): number {
  return 0; // Steel is acquired from iron ore deposits on the world map
}

export const RATIONS_INFO: Record<RationsLevel, { label: string; foodMultiplier: number; happinessBonus: number; description: string }> = {
  scarce: { label: 'Scarce', foodMultiplier: 0.5, happinessBonus: -15, description: 'Half rations. Saves food but lowers happiness.' },
  normal: { label: 'Normal', foodMultiplier: 1.0, happinessBonus: 0, description: 'Standard rations. No bonus or penalty.' },
  generous: { label: 'Generous', foodMultiplier: 2.0, happinessBonus: 15, description: 'Double rations. Costs more food but boosts happiness.' },
};

export const TROOP_INFO: Record<TroopType, TroopInfo> = {
  militia: { name: 'Militia', emoji: '🗡️', description: 'Basic foot soldiers.', attack: 5, defense: 3, speed: 10, cost: { gold: 20, wood: 10, stone: 0, food: 10 }, steelCost: 0, trainTime: 15, requiredBarracksLevel: 1, foodUpkeep: 1, goldUpkeep: 0, popCost: 1 },
  archer: { name: 'Archer', emoji: '🏹', description: 'Ranged units.', attack: 8, defense: 2, speed: 8, cost: { gold: 35, wood: 25, stone: 0, food: 15 }, steelCost: 0, trainTime: 25, requiredBarracksLevel: 2, foodUpkeep: 1, goldUpkeep: 0, popCost: 1 },
  knight: { name: 'Knight', emoji: '🛡️', description: 'Heavily armored. Requires steel.', attack: 10, defense: 12, speed: 6, cost: { gold: 60, wood: 10, stone: 30, food: 25 }, steelCost: 5, trainTime: 40, requiredBarracksLevel: 3, foodUpkeep: 2, goldUpkeep: 1, popCost: 2 },
  cavalry: { name: 'Cavalry', emoji: '🐴', description: 'Fast mounted warriors. Requires steel.', attack: 14, defense: 6, speed: 18, cost: { gold: 80, wood: 20, stone: 0, food: 40 }, steelCost: 8, trainTime: 50, requiredBarracksLevel: 4, foodUpkeep: 3, goldUpkeep: 1, popCost: 2 },
  siege: { name: 'Siege Ram', emoji: '🏗️', description: 'Devastating siege engine.', attack: 25, defense: 4, speed: 3, cost: { gold: 120, wood: 80, stone: 50, food: 30 }, steelCost: 15, trainTime: 90, requiredBarracksLevel: 5, foodUpkeep: 4, goldUpkeep: 1, popCost: 3 },
  scout: { name: 'Scout', emoji: '🏃', description: 'Fast recon unit. Extends march range.', attack: 2, defense: 1, speed: 25, cost: { gold: 15, wood: 5, stone: 0, food: 10 }, steelCost: 0, trainTime: 10, requiredBarracksLevel: 1, foodUpkeep: 1, goldUpkeep: 0, popCost: 1 },
};

export const SPY_MISSION_INFO: Record<SpyMission, SpyMissionInfo> = {
  scout: { name: 'Scout', emoji: '🔍', description: 'Gather intel on a target. Reveals troops, resources, and defenses.', goldCost: 50, baseSuccessRate: 0.75, spiesRequired: 1 },
  sabotage: { name: 'Sabotage', emoji: '💣', description: 'Destroy resources and damage buildings. High risk.', goldCost: 120, baseSuccessRate: 0.45, spiesRequired: 2 },
  demoralize: { name: 'Demoralize', emoji: '😈', description: 'Spread propaganda to decrease target happiness.', goldCost: 80, baseSuccessRate: 0.55, spiesRequired: 1 },
};

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
  const calcEffectivePower = (army: Army, enemyArmy: Army, isDefender: boolean, wallLevel: number) => {
    let totalAtk = 0;
    let totalDef = 0;
    
    const totalEnemyUnits = Object.values(enemyArmy).reduce((s, c) => s + Math.max(0, c), 0);
    
    for (const [type, count] of Object.entries(army) as [TroopType, number][]) {
      if (count <= 0) continue;
      const info = TROOP_INFO[type];
      let atk = info.attack * count;
      let def = info.defense * count;
      
      if (totalEnemyUnits > 0) {
        const counters = TROOP_COUNTERS[type];
        for (const [enemyType, enemyCount] of Object.entries(enemyArmy) as [TroopType, number][]) {
          if (enemyCount <= 0) continue;
          const proportion = enemyCount / totalEnemyUnits;
          if (counters.strongVs.includes(enemyType)) {
            atk += info.attack * count * 0.3 * proportion;
          }
          if (counters.weakVs.includes(enemyType)) {
            atk -= info.attack * count * 0.15 * proportion;
          }
        }
      }
      totalAtk += Math.max(0, atk);
      totalDef += def;
    }
    if (isDefender) {
      totalDef += wallLevel * 8;
    }
    return { attack: totalAtk, defense: totalDef };
  };

  const atkPower = calcEffectivePower(attackerArmy, defenderArmy, false, 0);
  const defPower = calcEffectivePower(defenderArmy, attackerArmy, true, defenderWallLevel);
  
  const attackerTotal = atkPower.attack + atkPower.defense * 0.3;
  const defenderTotal = defPower.attack * 0.7 + defPower.defense;
  
  const attackerScore = attackerTotal * (0.9 + Math.random() * 0.2);
  const defenderScore = defenderTotal * (0.9 + Math.random() * 0.2);
  
  const victory = attackerScore > defenderScore;
  const powerRatio = attackerScore / Math.max(1, defenderScore);
  
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
  const base = Math.floor(distance / (speed * 200));
  const scoutCount = army.scout || 0;
  const scoutBonus = Math.min(0.30, scoutCount * 0.03);
  return Math.max(5, Math.floor(base * (1 - scoutBonus)));
}

export const WATCHTOWER_RANGE_BONUS = 3000; // extra range per watchtower level

export function getMaxRange(army: Army, watchtowerLevel: number = 0): number {
  const scoutCount = army.scout || 0;
  return MAX_MARCH_RANGE + scoutCount * SCOUT_RANGE_BONUS + watchtowerLevel * WATCHTOWER_RANGE_BONUS;
}

export const SETTLEMENT_UPGRADES = {
  village: { next: 'town' as const, label: 'Town', thRequired: 10, cost: { gold: 15000, wood: 12000, stone: 10000, food: 8000 }, steelCost: 50, buildTimeSec: 7200 },
  town: { next: 'city' as const, label: 'City', thRequired: 10, cost: { gold: 80000, wood: 75000, stone: 70000, food: 60000 }, steelCost: 200, buildTimeSec: 86400 },
} as const;
