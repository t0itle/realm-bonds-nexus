import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  Building, BuildingType, Resources, Army, InjuredArmy,
  TrainingQueue, BuildQueue, Vassalage, PlayerVillage,
  RationsLevel, TroopType, SpyMission, ActiveSpyMission, IntelReport,
  WorkerAssignments,
} from '@/lib/gameTypes';
import { BUILDING_INFO } from '@/lib/gameConstants';
import type { SpyDataPayload } from './useSpyMissions';

const EMPTY_ARMY: Army = { militia: 0, archer: 0, knight: 0, cavalry: 0, siege: 0, scout: 0 };
const EMPTY_INJURED: InjuredArmy = { militia: 0, archer: 0, knight: 0, cavalry: 0, siege: 0, scout: 0 };

export function useVillageDataLoader(user: { id: string } | null) {
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
  const [buildQueue, setBuildQueue] = useState<BuildQueue[]>([]);
  const [workerAssignmentsRaw, setWorkerAssignmentsRaw] = useState<WorkerAssignments>({});
  const setWorkerAssignments = useCallback((updater: WorkerAssignments | ((prev: WorkerAssignments) => WorkerAssignments)) => {
    setWorkerAssignmentsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
  }, []);
  const workerAssignments = workerAssignmentsRaw;
  const [populationBase, setPopulationBase] = useState(10);
  const [maxPopBase, setMaxPopBase] = useState(20);
  const [happinessBase, setHappinessBase] = useState(50);
  const [rations, setRationsLocal] = useState<RationsLevel>(50);
  const [popTaxRate, setPopTaxRateLocal] = useState(5);
  const hydrateSpyDataRef = useRef<((data: SpyDataPayload) => void) | null>(null);
  const setSpiesRef = useRef<React.Dispatch<React.SetStateAction<number>>>(() => {});
  const [vassalages, setVassalages] = useState<Vassalage[]>([]);
  const [injuredTroops, setInjuredTroops] = useState<InjuredArmy>({ ...EMPTY_INJURED });
  const [poisons, setPoisons] = useState(0);
  const [allianceTaxRate, setAllianceTaxRate] = useState(0);
  const [allianceId, setAllianceId] = useState<string | null>(null);
  const settlementTypeRef = useRef<'village' | 'town' | 'city'>('village');
  const [settlementType, setSettlementType] = useState<'village' | 'town' | 'city'>('village');
  const [settlementUpgradeFinishTime, setSettlementUpgradeFinishTime] = useState<number | null>(null);

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
          supabase.from('build_queue').select('*').eq('user_id', user.id).eq('village_id', village.id),
          supabase.from('training_queue').select('*').eq('user_id', user.id).eq('village_id', village.id),
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
    await supabase.from('buildings').delete().eq('village_id', abandonId);
    await supabase.from('build_queue').delete().eq('user_id', user.id);
    const { error } = await supabase.from('villages').delete().eq('id', abandonId).eq('user_id', user.id);
    if (error) {
      toast.error('Failed to abandon settlement');
      return false;
    }
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

  // Persist injured troops with debounce
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

  // Player level = Town Hall level
  useEffect(() => {
    const th = buildings.find(b => b.type === 'townhall');
    if (th) {
      setPlayerLevel(th.level);
      if (villageId) {
        supabase.from('villages').update({ level: th.level }).eq('id', villageId).then();
      }
    }
  }, [buildings, villageId]);

  return {
    // State values
    resources, steel, buildings, villageId, villageName: villageNameLocal, playerLevel,
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
  };
}
