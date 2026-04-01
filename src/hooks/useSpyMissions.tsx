import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Resources, Building, PopulationStats, SpyMission, ActiveSpyMission, IntelReport } from './useGameState';
import { SPY_MISSION_INFO } from './useGameState';

export interface UseSpyMissionsParams {
  user: { id: string } | null;
  villageId: string | null;
  resources: Resources;
  setResources: React.Dispatch<React.SetStateAction<Resources>>;
  canAfford: (cost: Resources) => boolean;
  buildings: Building[];
  population: PopulationStats;
}

export interface SpyDataPayload {
  spies: number;
  spyTrainingQueue: { count: number; finishTime: number }[];
  activeSpyMissions: ActiveSpyMission[];
  intelReports: IntelReport[];
}

export interface UseSpyMissionsReturn {
  spies: number;
  setSpies: React.Dispatch<React.SetStateAction<number>>;
  spyTrainingQueue: { count: number; finishTime: number }[];
  activeSpyMissions: ActiveSpyMission[];
  intelReports: IntelReport[];
  trainSpies: (count: number) => boolean;
  sendSpyMission: (mission: SpyMission, targetName: string, targetId: string, targetX: number, targetY: number, spiesCount: number) => boolean;
  getSpyGuildLevel: () => number;
  getWatchtowerLevel: () => number;
  /** Called by loadVillageData to hydrate spy state from DB data */
  hydrateSpyData: (data: SpyDataPayload) => void;
}

export function useSpyMissions({
  user,
  villageId,
  resources,
  setResources,
  canAfford,
  buildings,
  population,
}: UseSpyMissionsParams): UseSpyMissionsReturn {
  const [spies, setSpies] = useState(0);
  const [spyTrainingQueue, setSpyTrainingQueue] = useState<{ count: number; finishTime: number }[]>([]);
  const [activeSpyMissions, setActiveSpyMissions] = useState<ActiveSpyMission[]>([]);
  const [intelReports, setIntelReports] = useState<IntelReport[]>([]);

  const hydrateSpyData = useCallback((data: SpyDataPayload) => {
    setSpies(data.spies);
    setSpyTrainingQueue(data.spyTrainingQueue);
    setActiveSpyMissions(data.activeSpyMissions);
    setIntelReports(data.intelReports);
  }, []);

  const getSpyGuildLevel = useCallback(() => {
    const sg = buildings.find(b => b.type === 'spyguild');
    return sg?.level || 0;
  }, [buildings]);

  const getWatchtowerLevel = useCallback(() => {
    const wt = buildings.find(b => b.type === 'watchtower');
    return wt?.level || 0;
  }, [buildings]);

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
            if (villageId) supabase.from('villages').update({ spies: newVal } as any).eq('id', villageId).then();
            return newVal;
          });
          supabase.from('spy_training_queue').delete().lte('finish_time', new Date(now).toISOString()).eq('user_id', user?.id ?? '').then();
          supabase.functions.invoke('send-push', {
            body: { user_id: user?.id, title: '🕵️ Spy Training Complete', body: `${totalSpies} spy${totalSpies > 1 ? 's' : ''} ready for missions!`, tag: 'spy-training-done' },
          }).catch(() => {});
        }
        return remaining;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [spyTrainingQueue.length, villageId, user?.id]);

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
            const roll = Math.random();
            const successRate = Math.min(0.95, info.baseSuccessRate + m.spiesCount * 0.05);
            const caught = roll > successRate + 0.15;
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

            const spiesLost = caught ? m.spiesCount : 0;
            if (!caught) {
              setSpies(p => {
                const newVal = p + m.spiesCount;
                if (villageId) supabase.from('villages').update({ spies: newVal } as any).eq('id', villageId).then();
                return newVal;
              });
            }

            setIntelReports(prev => [report, ...prev].slice(0, 30));
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

  // Train spies
  const trainSpies = useCallback((count: number) => {
    const sgLevel = getSpyGuildLevel();
    console.log('[trainSpies]', { count, spyGuildLvl: sgLevel, civilians: population.civilians, gold: resources.gold, food: resources.food });
    if (sgLevel < 1) { console.log('[trainSpies] FAIL: no spy guild'); return false; }
    const cost = { gold: 40 * count, wood: 0, stone: 0, food: 20 * count };
    if (!canAfford(cost)) { console.log('[trainSpies] FAIL: cant afford'); return false; }
    if (population.civilians < count) { console.log('[trainSpies] FAIL: not enough civilians'); return false; }
    const newResources = { gold: resources.gold - cost.gold, wood: resources.wood, stone: resources.stone, food: resources.food - cost.food };
    setResources(newResources);
    if (villageId) {
      supabase.from('villages').update(newResources).eq('id', villageId).then();
    }
    const baseTime = 20000;
    const speedMultiplier = Math.max(0.4, 1 - (sgLevel - 1) * 0.15);
    const finishTime = Date.now() + Math.floor(baseTime * count * speedMultiplier);
    setSpyTrainingQueue(prev => [...prev, { count, finishTime }]);
    if (user) supabase.from('spy_training_queue').insert({ user_id: user.id, count, finish_time: new Date(finishTime).toISOString() } as any).then();
    return true;
  }, [canAfford, getSpyGuildLevel, population.civilians, resources, villageId, user, setResources]);

  // Send spy mission
  const sendSpyMission = useCallback((mission: SpyMission, targetName: string, targetId: string, targetX: number, targetY: number, spiesCount: number) => {
    const info = SPY_MISSION_INFO[mission];
    if (spies < info.spiesRequired * spiesCount) return false;
    const goldCost = info.goldCost * spiesCount;
    if (resources.gold < goldCost) return false;

    setSpies(prev => prev - info.spiesRequired * spiesCount);
    setResources(prev => ({ ...prev, gold: prev.gold - goldCost }));

    const dist = Math.sqrt(Math.pow(targetX - 100000, 2) + Math.pow(targetY - 100000, 2));
    const travelSec = Math.max(5, Math.floor(dist / 3000));
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
      targetX,
      targetY,
    };
    setActiveSpyMissions(prev => [...prev, missionObj]);
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
  }, [spies, resources.gold, user, setResources]);

  return {
    spies,
    setSpies,
    spyTrainingQueue,
    activeSpyMissions,
    intelReports,
    trainSpies,
    sendSpyMission,
    getSpyGuildLevel,
    getWatchtowerLevel,
    hydrateSpyData,
  };
}
