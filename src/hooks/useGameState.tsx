import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { useSpyMissions } from './useSpyMissions';
import { useProfile } from './useProfile';
import { usePopulation } from './usePopulation';
import { useProduction } from './useProduction';
import { useWorkerManagement } from './useWorkerManagement';
import { useTroopManagement } from './useTroopManagement';
import { useBuildingManagement } from './useBuildingManagement';
import { useTroopTraining } from './useTroopTraining';
import { useApothecary } from './useApothecary';
import { useVassalage } from './useVassalage';
import { useCombat } from './useCombat';
import { useQueueProcessing } from './useQueueProcessing';
import { useGameTick } from './useGameTick';
import { useVillageDataLoader } from './useVillageDataLoader';

// Re-export all types from gameTypes
export type {
  Building, BuildingType, Resources, ExtendedResources, BuildingInfo,
  Army, InjuredArmy, TrainingQueue, BuildQueue,
  SpyMission, SpyMissionInfo, IntelReport, ActiveSpyMission,
  BattleLog, Vassalage, Village, PlayerVillage,
  RationsLevel, TroopType, TroopInfo,
  WorkerAssignments, PopulationStats,
} from '@/lib/gameTypes';

// Re-export all constants from gameConstants
export {
  BUILDING_INFO, getUpgradeCost, getProduction, getSteelProduction,
  RATIONS_INFO, TROOP_INFO, SPY_MISSION_INFO, TROOP_COUNTERS,
  resolveCombat, MAX_MARCH_RANGE, SCOUT_RANGE_BONUS,
  getSlowestTroopSpeed, calcMarchTime, WATCHTOWER_RANGE_BONUS, getMaxRange,
  SETTLEMENT_UPGRADES,
} from '@/lib/gameConstants';

// Import types and constants for local use
import type {
  Building, BuildingType, Resources, Army, InjuredArmy,
  TrainingQueue, BuildQueue, BattleLog, Vassalage, Village, PlayerVillage,
  RationsLevel, TroopType, SpyMission, ActiveSpyMission, IntelReport,
  WorkerAssignments, PopulationStats,
} from '@/lib/gameTypes';

import {
  BUILDING_INFO, getUpgradeCost, getProduction, getSteelProduction,
  RATIONS_INFO, TROOP_INFO, SPY_MISSION_INFO,
  resolveCombat, SETTLEMENT_UPGRADES, calcMarchTime, getSlowestTroopSpeed,
} from '@/lib/gameConstants';

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
  deployTroops: (sentArmy: Partial<Army>) => void;
  returnTroops: (survivors: Partial<Army>) => void;
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
  refreshMineOutposts: () => Promise<void>;
  abandonSettlement: (villageId: string) => Promise<boolean>;
  // Settlement upgrade
  settlementType: 'village' | 'town' | 'city';
  upgradeSettlement: () => Promise<boolean>;
  isSettlementUpgrading: boolean;
  settlementUpgradeFinishTime: number | null;
  disbandTroops: (type: TroopType, count: number) => boolean;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // === VILLAGE DATA LOADER (owns most state, loading, and realtime) ===
  const {
    resources, steel, buildings, villageId, villageName, playerLevel,
    displayName: displayNameLocal, avatarUrl, allVillages, myVillages, ownedMineIds,
    loading, army, trainingQueue, buildQueue, workerAssignments,
    populationBase, happinessBase, rations, popTaxRate,
    vassalages, injuredTroops, poisons, allianceTaxRate, allianceId,
    settlementType, settlementUpgradeFinishTime,
    // Setters
    setResources, setSteel, setBuildings, setVillageNameLocal,
    setPlayerLevel, setDisplayNameLocal, setAvatarUrlLocal,
    setMyVillages, setArmy, setTrainingQueue, setBuildQueue,
    setWorkerAssignments, setPopulationBase,
    setRationsLocal, setPopTaxRateLocal, setVassalages, setInjuredTroops,
    setPoisons, setAllianceTaxRate, setAllianceId,
    setSettlementType, setSettlementUpgradeFinishTime,
    // Refs
    hydrateSpyDataRef, setSpiesRef, settlementTypeRef,
    // Functions
    loadVillageData, switchVillage, refreshVillages, abandonSettlement, refreshMineOutposts,
  } = useVillageDataLoader(user);

  const [battleLogs, setBattleLogs] = useState<BattleLog[]>([]);

  // Wrap setRations and setPopTaxRate to immediately persist to DB
  const setRations = useCallback((r: RationsLevel) => {
    setRationsLocal(r);
    if (villageId) {
      supabase.from('villages').update({ rations: r } as any).eq('id', villageId).then();
    }
  }, [villageId, setRationsLocal]);

  const setPopTaxRate = useCallback((rate: number) => {
    setPopTaxRateLocal(rate);
    if (villageId) {
      supabase.from('villages').update({ pop_tax_rate: rate } as any).eq('id', villageId).then();
    }
  }, [villageId, setPopTaxRateLocal]);

  // Name & avatar update functions
  const displayName = displayNameLocal;

  const { setVillageName, setDisplayName, setAvatarUrl } = useProfile({
    villageId,
    user,
    setVillageNameLocal,
    setDisplayNameLocal,
    setAvatarUrlLocal,
  });

  const canAfford = useCallback((cost: Resources) => {
    return resources.gold >= cost.gold && resources.wood >= cost.wood && resources.stone >= cost.stone && resources.food >= cost.food;
  }, [resources]);

  const canAffordSteel = useCallback((amount: number) => steel >= amount, [steel]);

  // === HOUSING & POPULATION ===
  const {
    townhallLevel, maxHouses, currentHouses, housingCapacity,
    happiness, totalSoldiers, totalWorkers, maxPopulation,
    armyCap, popFoodCost, popTaxIncome, population,
  } = usePopulation({ buildings, workerAssignments, army, rations, populationBase, popTaxRate });

  // === SPY MISSIONS HOOK ===
  const spyMissions = useSpyMissions({
    user, villageId, resources, setResources, canAfford, buildings, population,
  });
  const { spies, setSpies, spyTrainingQueue, activeSpyMissions, intelReports,
    trainSpies, sendSpyMission, getSpyGuildLevel, getWatchtowerLevel, hydrateSpyData } = spyMissions;

  // Bridge refs for loadVillageData (defined before this hook)
  useEffect(() => {
    hydrateSpyDataRef.current = hydrateSpyData;
    setSpiesRef.current = setSpies;
  }, [hydrateSpyData, setSpies, hydrateSpyDataRef, setSpiesRef]);

  const isSettlementUpgrading = settlementUpgradeFinishTime !== null && settlementUpgradeFinishTime > Date.now();

  // Process settlement upgrade timer
  useEffect(() => {
    if (!settlementUpgradeFinishTime) return;
    if (settlementUpgradeFinishTime <= Date.now()) {
      const upgrade = SETTLEMENT_UPGRADES[settlementType];
      if (upgrade) {
        const newType = upgrade.next as 'village' | 'town' | 'city';
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
        const newType = upgrade.next as 'village' | 'town' | 'city';
        setSettlementType(newType);
        settlementTypeRef.current = newType;
        setSettlementUpgradeFinishTime(null);
        if (villageId) supabase.from('villages').update({ settlement_type: newType } as any).eq('id', villageId).then();
        setMyVillages(prev => prev.map(v => v.id === villageId ? { ...v, settlement_type: newType } : v));
        toast.success(`🏗️ Settlement upgraded to ${upgrade.label}! New building slots unlocked.`);
      }
    }, settlementUpgradeFinishTime - Date.now());
    return () => clearTimeout(timer);
  }, [settlementUpgradeFinishTime, settlementType, villageId, setSettlementType, setSettlementUpgradeFinishTime, setMyVillages, settlementTypeRef]);

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
    supabase.from('build_queue').insert({
      user_id: user.id, building_id: villageId, building_type: 'settlement_upgrade',
      target_level: upgrade.next === 'town' ? 2 : 3,
      finish_time: new Date(finishTime).toISOString(),
    } as any).then();

    toast.success(`🏗️ Upgrading to ${upgrade.label}! This will take ${Math.floor(upgrade.buildTimeSec / 3600)}h.`);
    return true;
  }, [villageId, user, settlementType, townhallLevel, canAfford, canAffordSteel, resources, steel, isSettlementUpgrading, setResources, setSteel, setSettlementUpgradeFinishTime]);

  // Player level = Town Hall level
  useEffect(() => {
    const th = buildings.find(b => b.type === 'townhall');
    if (th) {
      setPlayerLevel(th.level);
      if (villageId) {
        supabase.from('villages').update({ level: th.level }).eq('id', villageId).then();
      }
    }
  }, [buildings, villageId, setPlayerLevel]);

  // === PRODUCTION ===
  const {
    grossProduction, buildingSteelProduction, mineSteelPerTick,
    steelProduction, totalProduction, armyUpkeep, storageCapacity,
  } = useProduction({ buildings, workerAssignments, army, allianceId, allianceTaxRate, ownedMineIds, popFoodCost, popTaxIncome });

  const { persistArmyToVillage, deployTroops, disbandTroops, returnTroops } = useTroopManagement({
    villageId, user, army, setArmy, populationBase, setPopulationBase,
  });

  useQueueProcessing({
    trainingQueue, setTrainingQueue, buildQueue, setBuildQueue,
    army, setArmy, setBuildings, persistArmyToVillage, user, villageId,
  });
  const {
    getBuildTime, isBuildingUpgrading, getBarracksLevel,
    buildAt, upgradeBuilding, demolishBuilding, addResources, addSteel,
  } = useBuildingManagement({
    buildings, setBuildings, buildQueue, setBuildQueue, resources, setResources,
    steel, setSteel, villageId, user, canAfford, canAffordSteel, storageCapacity,
    currentHouses, maxHouses, setWorkerAssignments,
  });
  const { trainTroops, totalArmyPower } = useTroopTraining({
    trainingQueue, setTrainingQueue, army, resources, setResources, steel, setSteel,
    villageId, user, canAfford, canAffordSteel, getBarracksLevel, totalSoldiers, armyCap, population,
  });

  useGameTick({
    villageId, user, totalProduction, buildingSteelProduction, mineSteelPerTick,
    storageCapacity, setResources, setSteel, army, setArmy, setPopulationBase,
    persistArmyToVillage, allianceId, setAllianceTaxRate, addSteel,
  });

  const { getMaxWorkers, assignWorker, unassignWorker } = useWorkerManagement({
    buildings, workerAssignments, setWorkerAssignments, population, villageId,
  });

  const { getApothecaryLevel, healTroops, craftPoison } = useApothecary({
    buildings, injuredTroops, setInjuredTroops, army, setArmy, resources, setResources,
    poisons, setPoisons, setTrainingQueue, villageId, user, canAfford,
  });

  const { getWallLevel, attackTarget, attackPlayer } = useCombat({
    army, setArmy, buildings, resources, setResources, steel, setSteel,
    injuredTroops, setInjuredTroops, vassalages, setVassalages, villageId, user,
    displayName, getApothecaryLevel, returnTroops, deployTroops, addResources,
    setBattleLogs, setPopulationBase,
  });

  const { payRansom, attemptRebellion, setVassalTributeRate, releaseVassal } = useVassalage({
    vassalages, setVassalages, army, setArmy, resources, setResources, user, villageId,
    displayName, persistArmyToVillage, setInjuredTroops, setPopulationBase, getApothecaryLevel,
  });

  return (
    <GameContext.Provider value={{
      resources, steel, buildings, villageName, villageId, playerLevel, displayName, avatarUrl,
      setDisplayName, setVillageName, setAvatarUrl,
      demolishBuilding, buildAt, upgradeBuilding, canAfford, canAffordSteel, totalProduction, steelProduction, allVillages, loading,
      army, trainingQueue, buildQueue, battleLogs, trainTroops, getBarracksLevel, totalArmyPower, addResources, addSteel, attackTarget, armyUpkeep, deployTroops, returnTroops, disbandTroops,
      population, workerAssignments, assignWorker, unassignWorker, getMaxWorkers,
      rations, setRations, popTaxRate, setPopTaxRate, popFoodCost, popTaxIncome,
      isBuildingUpgrading, getBuildTime,
      spies, trainSpies, sendSpyMission, activeSpyMissions, spyTrainingQueue, intelReports, getWatchtowerLevel, getSpyGuildLevel,
      attackPlayer, vassalages, payRansom, attemptRebellion, setVassalTributeRate, releaseVassal, getWallLevel,
      injuredTroops, poisons, healTroops, craftPoison, getApothecaryLevel,
      storageCapacity,
      myVillages, switchVillage, refreshVillages, refreshMineOutposts, abandonSettlement,
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
