import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
import { useSettlementUpgrade } from './useSettlementUpgrade';

export type {
  Building, BuildingType, Resources, ExtendedResources, BuildingInfo,
  Army, InjuredArmy, TrainingQueue, BuildQueue,
  SpyMission, SpyMissionInfo, IntelReport, ActiveSpyMission,
  BattleLog, Vassalage, Village, PlayerVillage,
  RationsLevel, TroopType, TroopInfo,
  WorkerAssignments, PopulationStats,
} from '@/lib/gameTypes';

export {
  BUILDING_INFO, getUpgradeCost, getProduction, getSteelProduction,
  RATIONS_INFO, TROOP_INFO, SPY_MISSION_INFO, TROOP_COUNTERS,
  resolveCombat, MAX_MARCH_RANGE, SCOUT_RANGE_BONUS,
  getSlowestTroopSpeed, calcMarchTime, WATCHTOWER_RANGE_BONUS, getMaxRange,
  SETTLEMENT_UPGRADES,
} from '@/lib/gameConstants';

import type {
  Building, BuildingType, Resources, Army, InjuredArmy,
  TrainingQueue, BuildQueue, BattleLog, Vassalage, PlayerVillage,
  RationsLevel, TroopType, SpyMission, ActiveSpyMission, IntelReport,
  WorkerAssignments, PopulationStats,
} from '@/lib/gameTypes';

interface GameContextType {
  resources: Resources; steel: number; buildings: Building[];
  villageName: string; villageId: string | null; playerLevel: number;
  displayName: string; avatarUrl: string | null;
  setDisplayName: (n: string) => Promise<boolean>; setVillageName: (n: string) => Promise<boolean>; setAvatarUrl: (u: string | null) => void;
  demolishBuilding: (id: string) => Promise<boolean>; buildAt: (p: number, t: Exclude<BuildingType, 'empty'>) => Promise<boolean>; upgradeBuilding: (id: string) => Promise<boolean>;
  canAfford: (cost: Resources) => boolean; canAffordSteel: (a: number) => boolean;
  totalProduction: Resources; steelProduction: number; allVillages: PlayerVillage[]; loading: boolean;
  army: Army; trainingQueue: TrainingQueue[]; buildQueue: BuildQueue[]; battleLogs: BattleLog[];
  trainTroops: (t: TroopType, c: number) => boolean; getBarracksLevel: () => number; totalArmyPower: () => { attack: number; defense: number };
  addResources: (r: Partial<Resources>) => void; addSteel: (a: number) => void;
  attackTarget: (name: string, power: number, sent?: Partial<Army>) => BattleLog;
  attackPlayer: (uid: string, name: string, vid: string, sent?: Partial<Army>) => Promise<BattleLog | null>;
  vassalages: Vassalage[]; payRansom: (id: string) => Promise<boolean>; attemptRebellion: (id: string) => Promise<boolean>;
  setVassalTributeRate: (id: string, rate: number) => Promise<boolean>; releaseVassal: (id: string) => Promise<boolean>;
  getWallLevel: () => number; deployTroops: (s: Partial<Army>) => void; returnTroops: (s: Partial<Army>) => void;
  disbandTroops: (t: TroopType, c: number) => boolean; armyUpkeep: () => { food: number; gold: number };
  population: PopulationStats; workerAssignments: WorkerAssignments;
  assignWorker: (id: string) => boolean; unassignWorker: (id: string) => boolean; getMaxWorkers: (b: Building) => number;
  rations: RationsLevel; setRations: (r: RationsLevel) => void; popTaxRate: number; setPopTaxRate: (r: number) => void;
  popFoodCost: number; popTaxIncome: number;
  isBuildingUpgrading: (id: string) => BuildQueue | undefined; getBuildTime: (t: Exclude<BuildingType, 'empty'>, l: number) => number;
  spies: number; trainSpies: (c: number) => boolean;
  sendSpyMission: (m: SpyMission, n: string, id: string, x: number, y: number, c: number) => boolean;
  activeSpyMissions: ActiveSpyMission[]; spyTrainingQueue: { count: number; finishTime: number }[];
  intelReports: IntelReport[]; getWatchtowerLevel: () => number; getSpyGuildLevel: () => number;
  injuredTroops: InjuredArmy; poisons: number; healTroops: (t: TroopType, c: number) => boolean;
  craftPoison: (c: number) => boolean; getApothecaryLevel: () => number; storageCapacity: number;
  myVillages: { id: string; name: string; settlement_type: string }[];
  switchVillage: (id: string) => void; refreshVillages: () => Promise<void>; refreshMineOutposts: () => Promise<void>;
  abandonSettlement: (id: string) => Promise<boolean>;
  settlementType: 'village' | 'town' | 'city'; upgradeSettlement: () => Promise<boolean>;
  isSettlementUpgrading: boolean; settlementUpgradeFinishTime: number | null;
}

const GameContext = createContext<GameContextType | null>(null);
export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const {
    resources, steel, buildings, villageId, villageName, playerLevel,
    displayName: displayNameLocal, avatarUrl, allVillages, myVillages, ownedMineIds,
    loading, army, trainingQueue, buildQueue, workerAssignments,
    populationBase, rations, popTaxRate,
    vassalages, injuredTroops, poisons, allianceTaxRate, allianceId,
    settlementType, settlementUpgradeFinishTime,
    setResources, setSteel, setBuildings, setVillageNameLocal, setDisplayNameLocal, setAvatarUrlLocal,
    setMyVillages, setArmy, setTrainingQueue, setBuildQueue, setWorkerAssignments, setPopulationBase,
    setRationsLocal, setPopTaxRateLocal, setVassalages, setInjuredTroops,
    setPoisons, setAllianceTaxRate, setAllianceId,
    setSettlementType, setSettlementUpgradeFinishTime,
    hydrateSpyDataRef, setSpiesRef, settlementTypeRef,
    switchVillage, refreshVillages, abandonSettlement, refreshMineOutposts,
  } = useVillageDataLoader(user);
  const [battleLogs, setBattleLogs] = useState<BattleLog[]>([]);
  const displayName = displayNameLocal;
  const setRations = useCallback((r: RationsLevel) => {
    setRationsLocal(r);
    if (villageId) supabase.from('villages').update({ rations: String(r) } as any).eq('id', villageId).then();
  }, [villageId, setRationsLocal]);
  const setPopTaxRate = useCallback((rate: number) => {
    setPopTaxRateLocal(rate);
    if (villageId) supabase.from('villages').update({ pop_tax_rate: rate } as any).eq('id', villageId).then();
  }, [villageId, setPopTaxRateLocal]);
  const { setVillageName, setDisplayName, setAvatarUrl } = useProfile({
    villageId, user, setVillageNameLocal, setDisplayNameLocal, setAvatarUrlLocal,
  });
  const canAfford = useCallback((cost: Resources) =>
    resources.gold >= cost.gold && resources.wood >= cost.wood && resources.stone >= cost.stone && resources.food >= cost.food,
  [resources]);
  const canAffordSteel = useCallback((amount: number) => steel >= amount, [steel]);

  const {
    townhallLevel, maxHouses, currentHouses, totalSoldiers, armyCap, popFoodCost, popTaxIncome, population,
  } = usePopulation({ buildings, workerAssignments, army, rations, populationBase, popTaxRate });

  const { spies, setSpies, spyTrainingQueue, activeSpyMissions, intelReports,
    trainSpies, sendSpyMission, getSpyGuildLevel, getWatchtowerLevel, hydrateSpyData } = useSpyMissions({
    user, villageId, resources, setResources, canAfford, buildings, population,
  });

  useEffect(() => {
    hydrateSpyDataRef.current = hydrateSpyData;
    setSpiesRef.current = setSpies;
  }, [hydrateSpyData, setSpies, hydrateSpyDataRef, setSpiesRef]);

  const { upgradeSettlement, isSettlementUpgrading } = useSettlementUpgrade({
    villageId, user, settlementType, setSettlementType,
    settlementUpgradeFinishTime, setSettlementUpgradeFinishTime,
    settlementTypeRef, setMyVillages,
    resources, setResources, steel, setSteel,
    canAfford, canAffordSteel, townhallLevel,
  });

  const { grossProduction, buildingSteelProduction, mineSteelPerTick,
    steelProduction, totalProduction, armyUpkeep, storageCapacity,
  } = useProduction({ buildings, workerAssignments, army, allianceId, allianceTaxRate, ownedMineIds, popFoodCost, popTaxIncome });

  const { persistArmyToVillage, deployTroops, disbandTroops, returnTroops } = useTroopManagement({
    villageId, user, army, setArmy, populationBase, setPopulationBase,
  });

  useQueueProcessing({ trainingQueue, setTrainingQueue, buildQueue, setBuildQueue,
    army, setArmy, setBuildings, persistArmyToVillage, user, villageId });

  const { getBuildTime, isBuildingUpgrading, getBarracksLevel,
    buildAt, upgradeBuilding, demolishBuilding, addResources, addSteel,
  } = useBuildingManagement({ buildings, setBuildings, buildQueue, setBuildQueue, resources, setResources,
    steel, setSteel, villageId, user, canAfford, canAffordSteel, storageCapacity, currentHouses, maxHouses, setWorkerAssignments });

  const { trainTroops, totalArmyPower } = useTroopTraining({ trainingQueue, setTrainingQueue, army, resources, setResources,
    steel, setSteel, villageId, user, canAfford, canAffordSteel, getBarracksLevel, totalSoldiers, armyCap, population });

  useGameTick({ villageId, user, totalProduction, buildingSteelProduction, mineSteelPerTick,
    storageCapacity, setResources, setSteel, army, setArmy, setPopulationBase,
    persistArmyToVillage, allianceId, setAllianceTaxRate, addSteel });

  const { getMaxWorkers, assignWorker, unassignWorker } = useWorkerManagement({
    buildings, workerAssignments, setWorkerAssignments, population, villageId });

  const { getApothecaryLevel, healTroops, craftPoison } = useApothecary({
    buildings, injuredTroops, setInjuredTroops, army, setArmy, resources, setResources,
    poisons, setPoisons, setTrainingQueue, villageId, user, canAfford });

  const { getWallLevel, attackTarget, attackPlayer } = useCombat({
    army, setArmy, buildings, resources, setResources, steel, setSteel,
    injuredTroops, setInjuredTroops, vassalages, setVassalages, villageId, user,
    displayName, getApothecaryLevel, returnTroops, deployTroops, addResources, setBattleLogs, setPopulationBase });

  const { payRansom, attemptRebellion, setVassalTributeRate, releaseVassal } = useVassalage({
    vassalages, setVassalages, army, setArmy, resources, setResources, user, villageId,
    displayName, persistArmyToVillage, setInjuredTroops, setPopulationBase, getApothecaryLevel });

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
      injuredTroops, poisons, healTroops, craftPoison, getApothecaryLevel, storageCapacity,
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
