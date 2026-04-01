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

const EMPTY_ARMY: Army = { militia: 0, archer: 0, knight: 0, cavalry: 0, siege: 0, scout: 0 };
const EMPTY_INJURED: InjuredArmy = { militia: 0, archer: 0, knight: 0, cavalry: 0, siege: 0, scout: 0 };

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
  const [ownedMineIds, setOwnedMineIds] = useState<string[]>([]);
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
  // Spy state managed by useSpyMissions — hydrateSpyDataRef bridges the gap with loadVillageData
  const hydrateSpyDataRef = useRef<((data: import('./useSpyMissions').SpyDataPayload) => void) | null>(null);
  const setSpiesRef = useRef<React.Dispatch<React.SetStateAction<number>>>(() => {});
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

  const { setVillageName, setDisplayName, setAvatarUrl } = useProfile({
    villageId,
    user,
    setVillageNameLocal,
    setDisplayNameLocal,
    setAvatarUrlLocal,
  });

  const refreshMineOutposts = useCallback(async () => {
    if (!user) {
      setOwnedMineIds([]);
      return;
    }

    const { data } = await supabase
      .from('outposts')
      .select('name')
      .eq('user_id', user.id)
      .eq('outpost_type', 'mine');

    setOwnedMineIds((data || []).map((outpost: any) => outpost.name).filter(Boolean));
  }, [user]);

  const loadVillageData = useCallback(async (targetVillageId?: string) => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // --- Phase 1: parallel fetch of profile, user villages, mine outposts ---
      const [profileRes, userVillagesRes, mineRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('villages').select('id, name, settlement_type').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.from('outposts').select('name').eq('user_id', user.id).eq('outpost_type', 'mine'),
      ]);

      if (profileRes.data) {
        setDisplayNameLocal(profileRes.data.display_name);
        setAvatarUrlLocal((profileRes.data as any).avatar_url ?? null);
      }

      const userVillages = userVillagesRes.data;
      if (userVillages) setMyVillages(userVillages as any);

      setOwnedMineIds((mineRes.data || []).map((o: any) => o.name).filter(Boolean));

      // --- Phase 2: pick & load village ---
      let village: any = null;
      const pickId = targetVillageId || villageIdRef.current;
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
        setRationsLocal(((village as any).rations as RationsLevel) ?? 'normal');
        setPopTaxRateLocal((village as any).pop_tax_rate ?? 5);
        setSpiesRef.current((village as any).spies ?? 0);
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

        // --- Phase 3: parallel fetch of buildings, queues, missions, villages list, vassalages, alliance ---
        const [bldRes, bqRes, tqRes, stqRes, asmRes, irRes, villagesRes, vassalRes, memberRes] = await Promise.all([
          supabase.from('buildings').select('*').eq('village_id', village.id),
          supabase.from('build_queue').select('*').eq('user_id', user.id),
          supabase.from('training_queue').select('*').eq('user_id', user.id),
          supabase.from('spy_training_queue').select('*').eq('user_id', user.id),
          supabase.from('active_spy_missions').select('*').eq('user_id', user.id),
          supabase.from('intel_reports').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
          supabase.from('villages').select('id, user_id, name, gold, wood, stone, food, level, map_x, map_y, settlement_type').limit(50),
          supabase.from('vassalages').select('*').or(`lord_id.eq.${user.id},vassal_id.eq.${user.id}`).eq('status', 'active'),
          supabase.from('alliance_members').select('alliance_id').eq('user_id', user.id).limit(1),
        ]);

        // Process buildings
        const blds = bldRes.data;
        if (blds) {
          const stuckBuildings = blds.filter(b => b.level === 0);
          if (stuckBuildings.length > 0) {
            await Promise.all(stuckBuildings.map(sb => supabase.from('buildings').update({ level: 1 }).eq('id', sb.id)));
            stuckBuildings.forEach(sb => { sb.level = 1; });
          }
          setBuildings(blds.map(b => ({ id: b.id, type: b.type as BuildingType, level: b.level, position: b.position, village_id: b.village_id })));
          const wa: WorkerAssignments = {};
          for (const b of blds) {
            if ((b as any).workers > 0) wa[b.id] = (b as any).workers;
          }
          setWorkerAssignments(wa);
        }

        const now = Date.now();

        // Process build queue
        const bqData = bqRes.data;
        if (bqData && bqData.length > 0) {
          const villageBuilds = bqData.filter((q: any) => q.building_type !== 'outpost_upgrade' && q.building_type !== 'outpost_wall' && q.building_type !== 'settlement_upgrade');
          const settlementUpgrade = bqData.find((q: any) => q.building_type === 'settlement_upgrade');
          if (settlementUpgrade) {
            const ft = new Date(settlementUpgrade.finish_time).getTime();
            if (ft > now) {
              setSettlementUpgradeFinishTime(ft);
            } else {
              const newType = settlementUpgrade.target_level === 2 ? 'town' : 'city';
              setSettlementType(newType as any);
              settlementTypeRef.current = newType as any;
              if (village) await supabase.from('villages').update({ settlement_type: newType } as any).eq('id', village.id);
              await supabase.from('build_queue').delete().eq('id', settlementUpgrade.id);
            }
          }
          const completed = villageBuilds.filter((q: any) => new Date(q.finish_time).getTime() <= now);
          const active = villageBuilds.filter((q: any) => new Date(q.finish_time).getTime() > now);
          if (completed.length > 0) {
            await Promise.all(completed.map(q =>
              Promise.all([
                supabase.from('buildings').update({ level: q.target_level }).eq('id', q.building_id),
                supabase.from('build_queue').delete().eq('id', q.id),
              ])
            ));
            setBuildings(prev => {
              let next = [...prev];
              for (const q of completed) {
                next = next.map(b => b.id === q.building_id ? { ...b, level: q.target_level } : b);
              }
              return next;
            });
          }
          setBuildQueue(active.map((q: any) => ({
            buildingId: q.building_id,
            buildingType: q.building_type as BuildingType,
            targetLevel: q.target_level,
            finishTime: new Date(q.finish_time).getTime(),
          })));
        }

        // Process training queue
        const tqData = tqRes.data;
        if (tqData && tqData.length > 0) {
          const completed = tqData.filter((q: any) => new Date(q.finish_time).getTime() <= now);
          const active = tqData.filter((q: any) => new Date(q.finish_time).getTime() > now);
          if (completed.length > 0) {
            const nextArmy = { ...EMPTY_ARMY };
            nextArmy.militia = (village as any).army_militia ?? 0;
            nextArmy.archer = (village as any).army_archer ?? 0;
            nextArmy.knight = (village as any).army_knight ?? 0;
            nextArmy.cavalry = (village as any).army_cavalry ?? 0;
            nextArmy.siege = (village as any).army_siege ?? 0;
            nextArmy.scout = (village as any).army_scout ?? 0;
            for (const q of completed) {
              nextArmy[q.troop_type as TroopType] += q.count;
            }
            setArmy(nextArmy);
            await Promise.all([
              ...completed.map(q => supabase.from('training_queue').delete().eq('id', q.id)),
              supabase.from('villages').update({
                army_militia: nextArmy.militia, army_archer: nextArmy.archer,
                army_knight: nextArmy.knight, army_cavalry: nextArmy.cavalry,
                army_siege: nextArmy.siege, army_scout: nextArmy.scout,
              }).eq('id', village!.id),
            ]);
          }
          setTrainingQueue(active.map((q: any) => ({
            type: q.troop_type as TroopType,
            count: q.count,
            finishTime: new Date(q.finish_time).getTime(),
          })));
        }

        // Process spy data via hydrateSpyData
        const stqData = stqRes.data;
        const asmData = asmRes.data;
        const irData = irRes.data;
        {
          let hydratedSpies = (village as any)?.spies ?? 0;
          let hydratedStq: { count: number; finishTime: number }[] = [];
          let hydratedAsm: ActiveSpyMission[] = [];
          let hydratedIr: IntelReport[] = [];

          if (stqData && stqData.length > 0) {
            const completed = stqData.filter((q: any) => new Date(q.finish_time).getTime() <= now);
            const active = stqData.filter((q: any) => new Date(q.finish_time).getTime() > now);
            if (completed.length > 0) {
              const totalNewSpies = completed.reduce((s: number, q: any) => s + q.count, 0);
              hydratedSpies += totalNewSpies;
              await Promise.all([
                supabase.from('villages').update({ spies: hydratedSpies } as any).eq('id', village!.id),
                ...completed.map(q => supabase.from('spy_training_queue').delete().eq('id', q.id)),
              ]);
            }
            hydratedStq = active.map((q: any) => ({
              count: q.count,
              finishTime: new Date(q.finish_time).getTime(),
            }));
          }

          if (asmData && asmData.length > 0) {
            hydratedAsm = asmData.map((m: any) => ({
              id: m.id, mission: m.mission as SpyMission, targetName: m.target_name,
              targetId: m.target_id, spiesCount: m.spies_count,
              departTime: new Date(m.depart_time).getTime(),
              arrivalTime: new Date(m.arrival_time).getTime(),
              returnTime: new Date(m.arrival_time).getTime() + 15000,
              phase: (new Date(m.arrival_time).getTime() <= now ? 'operating' : 'traveling') as 'traveling' | 'operating',
              targetX: m.target_x || 0, targetY: m.target_y || 0,
            }));
          }

          if (irData && irData.length > 0) {
            hydratedIr = irData.map((r: any) => ({
              id: r.id, targetName: r.target_name, targetId: '', mission: r.mission as SpyMission,
              result: (r.success ? 'success' : 'failure') as 'success' | 'failure',
              timestamp: new Date(r.created_at).getTime(),
              data: r.data, spiesLost: r.spies_lost,
            }));
          }

          hydrateSpyDataRef.current?.({
            spies: hydratedSpies,
            spyTrainingQueue: hydratedStq,
            activeSpyMissions: hydratedAsm,
            intelReports: hydratedIr,
          });
        }

        // Process all villages for world map
        const villages = villagesRes.data;
        if (villages) {
          const villageUserIds = [...new Set(villages.map(v => v.user_id).filter(Boolean))];
          const { data: visibleProfiles } = villageUserIds.length > 0
            ? await supabase
                .from('profiles')
                .select('user_id, display_name, avatar_emoji')
                .in('user_id', villageUserIds)
            : { data: [] as { user_id: string; display_name: string; avatar_emoji: string }[] };

          const profileMap = new Map((visibleProfiles || []).map(p => [p.user_id, { display_name: p.display_name, avatar_emoji: p.avatar_emoji }]));
          setAllVillages(villages.map(v => ({
            village: { id: v.id, user_id: v.user_id, name: v.name, gold: Number(v.gold), wood: Number(v.wood), stone: Number(v.stone), food: Number(v.food), level: v.level, map_x: v.map_x, map_y: v.map_y, settlement_type: (v as any).settlement_type || 'village' },
            profile: profileMap.get(v.user_id) || { display_name: 'Unknown', avatar_emoji: '🛡️' },
          })));
        }

        // Process vassalages
        setVassalages((vassalRes.data || []) as any as Vassalage[]);

        // Process alliance
        const membership = memberRes.data;
        if (membership && membership.length > 0) {
          const aid = membership[0].alliance_id;
          setAllianceId(aid);
          const { data: alliance } = await supabase.from('alliances').select('tax_rate').eq('id', aid).single();
          if (alliance) setAllianceTaxRate(alliance.tax_rate);
        } else {
          setAllianceId(null);
          setAllianceTaxRate(0);
        }
      }

    } catch (error) {
      console.error('Failed to load village data.', error);
      toast.error('Could not load your realm. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    if (user) {
      loadVillageData();
    } else {
      setOwnedMineIds([]);
    }
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
        if (v.id !== villageIdRef.current) return;
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
        setSpiesRef.current((v as any).spies ?? 0);
        setPoisons((v as any).poisons ?? 0);
        // Skip injured troops here to prevent write-back loop
      }).subscribe();

    const vassalageChannel = supabase.channel(`vassalage-changes-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vassalages', filter: `lord_id=eq.${user.id}` }, async () => {
        const { data } = await supabase.from('vassalages').select('*').or(`lord_id.eq.${user.id},vassal_id.eq.${user.id}`).eq('status', 'active');
        setVassalages((data || []) as any as Vassalage[]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vassalages', filter: `vassal_id=eq.${user.id}` }, async () => {
        const { data } = await supabase.from('vassalages').select('*').or(`lord_id.eq.${user.id},vassal_id.eq.${user.id}`).eq('status', 'active');
        setVassalages((data || []) as any as Vassalage[]);
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
  }, [hydrateSpyData, setSpies]);

  const settlementTypeRef = useRef<'village' | 'town' | 'city'>('village');
  const [settlementType, setSettlementType] = useState<'village' | 'town' | 'city'>('village');
  const [settlementUpgradeFinishTime, setSettlementUpgradeFinishTime] = useState<number | null>(null);
  const isSettlementUpgrading = settlementUpgradeFinishTime !== null && settlementUpgradeFinishTime > Date.now();

  // SETTLEMENT_UPGRADES imported from @/lib/gameConstants

  // Process settlement upgrade timer
  useEffect(() => {
    if (!settlementUpgradeFinishTime) return;
    if (settlementUpgradeFinishTime <= Date.now()) {
      // Upgrade complete
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

  // === PRODUCTION ===
  const {
    grossProduction, buildingSteelProduction, mineSteelPerTick,
    steelProduction, totalProduction, armyUpkeep, storageCapacity,
  } = useProduction({ buildings, workerAssignments, army, allianceId, allianceTaxRate, ownedMineIds, popFoodCost, popTaxIncome });
  const storageCapRef = useRef(storageCapacity);
  storageCapRef.current = storageCapacity;

  const totalProductionRef = useRef(totalProduction);
  totalProductionRef.current = totalProduction;
  const buildingSteelProductionRef = useRef(buildingSteelProduction);
  buildingSteelProductionRef.current = buildingSteelProduction;
  const mineSteelPerTickRef = useRef(mineSteelPerTick);
  mineSteelPerTickRef.current = mineSteelPerTick;
  const armyRef = useRef(army);
  armyRef.current = army;

  const { persistArmyToVillage, deployTroops, disbandTroops, returnTroops } = useTroopManagement({
    villageId, user, army, setArmy, populationBase, setPopulationBase,
  });

  useEffect(() => {
    if (!villageId || !user) return;

    // Call server-side resource tick on load to sync DB
    const tickUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resource-tick`;
    fetch(tickUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({ user_id: user.id }),
    }).catch(() => {});

    // Interpolate resources locally every 2 seconds for visible trickle
    // Cap at storage capacity
    let lastDesertionTime = 0;
    const tickInterval = setInterval(() => {
      const prod = totalProductionRef.current;
      const steelProd = buildingSteelProductionRef.current;
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
        body: JSON.stringify({ user_id: user.id }),
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

  // Persist injured troops with debounce to avoid spamming DB
  const injuredInitRef = useRef(false);
  const injuredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!villageId || !injuredInitRef.current) { injuredInitRef.current = true; return; }
    if (injuredTimerRef.current) clearTimeout(injuredTimerRef.current);
    injuredTimerRef.current = setTimeout(() => {
      supabase.from('villages').update({
        injured_militia: injuredTroops.militia, injured_archer: injuredTroops.archer,
        injured_knight: injuredTroops.knight, injured_cavalry: injuredTroops.cavalry,
        injured_siege: injuredTroops.siege, injured_scout: injuredTroops.scout,
      } as any).eq('id', villageId).then();
    }, 2000);
    return () => { if (injuredTimerRef.current) clearTimeout(injuredTimerRef.current); };
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

  // Spy training queue processing is now in useSpyMissions


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




  useEffect(() => {
    if (!user || !villageId || mineSteelPerTick <= 0) return;

    const interval = setInterval(() => {
      const steelPerTick = mineSteelPerTickRef.current;
      if (steelPerTick > 0) addSteel(steelPerTick);
    }, 10000);

    return () => clearInterval(interval);
  }, [user, villageId, mineSteelPerTick, addSteel]);

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

    // Fetch active reinforcements at defender's village
    const { data: reinforcements } = await supabase
      .from('active_reinforcements')
      .select('*')
      .eq('host_village_id', targetVillageId);
    
    // Add reinforcement troops to defense
    const reinforcementOwners: { ownerId: string; troops: Partial<Army> }[] = [];
    if (reinforcements && reinforcements.length > 0) {
      for (const r of reinforcements) {
        const troops = r.troops as any as Partial<Army>;
        reinforcementOwners.push({ ownerId: r.owner_id, troops });
        for (const [type, count] of Object.entries(troops) as [TroopType, number][]) {
          if (count > 0) defArmy[type] = (defArmy[type] || 0) + count;
        }
      }
    }
    
    // Get defender's wall level
    const { data: defBuildings } = await supabase.from('buildings').select('*').eq('village_id', targetVillageId);
    const defWall = defBuildings?.find(b => b.type === 'wall');
    const defWallLevel = defWall?.level || 0;
    
    const result = resolveCombat(attackingArmy, defArmy, 0, defWallLevel);
    
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
    
    // Apply defender losses — subtract from reinforcements first, then village army
    let remainingLosses = { ...result.defenderLosses } as Record<TroopType, number>;
    
    // Deduct losses from reinforcements first
    for (const r of reinforcementOwners) {
      const rTroops = r.troops as Record<string, number>;
      for (const type of Object.keys(remainingLosses) as TroopType[]) {
        const loss = remainingLosses[type] || 0;
        const available = rTroops[type] || 0;
        if (loss > 0 && available > 0) {
          const deducted = Math.min(loss, available);
          rTroops[type] = available - deducted;
          remainingLosses[type] = loss - deducted;
        }
      }
    }

    // Update or delete reinforcement records
    if (reinforcements && reinforcements.length > 0) {
      for (let i = 0; i < reinforcements.length; i++) {
        const r = reinforcements[i];
        const updatedTroops = reinforcementOwners[i]?.troops || {};
        const totalRemaining = Object.values(updatedTroops).reduce((s, v) => s + (Number(v) || 0), 0);
        if (totalRemaining <= 0) {
          await supabase.from('active_reinforcements').delete().eq('id', r.id);
        } else {
          await supabase.from('active_reinforcements').update({ troops: updatedTroops } as any).eq('id', r.id);
        }
      }
    }

    // Apply remaining losses to defender's own village army
    const defOwnArmy: Army = {
      militia: (defVillage as any).army_militia ?? 0,
      archer: (defVillage as any).army_archer ?? 0,
      knight: (defVillage as any).army_knight ?? 0,
      cavalry: (defVillage as any).army_cavalry ?? 0,
      siege: (defVillage as any).army_siege ?? 0,
      scout: (defVillage as any).army_scout ?? 0,
    };
    for (const [type, lost] of Object.entries(remainingLosses) as [TroopType, number][]) {
      defOwnArmy[type] = Math.max(0, (defOwnArmy[type] || 0) - lost);
    }
    await supabase.from('villages').update({
      army_militia: defOwnArmy.militia, army_archer: defOwnArmy.archer,
      army_knight: defOwnArmy.knight, army_cavalry: defOwnArmy.cavalry, army_siege: defOwnArmy.siege,
      army_scout: defOwnArmy.scout,
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

  const { getMaxWorkers, assignWorker, unassignWorker } = useWorkerManagement({
    buildings, workerAssignments, setWorkerAssignments, population, villageId,
  });




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

  // Spy Guild level, trainSpies, sendSpyMission, and spy mission processing
  // are now provided by useSpyMissions hook

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
