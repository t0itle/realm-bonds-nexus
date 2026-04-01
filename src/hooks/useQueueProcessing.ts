import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Army, TrainingQueue, BuildQueue, Building, BuildingType } from '@/lib/gameTypes';
import { BUILDING_INFO } from '@/lib/gameConstants';

interface UseQueueProcessingParams {
  trainingQueue: TrainingQueue[];
  setTrainingQueue: React.Dispatch<React.SetStateAction<TrainingQueue[]>>;
  buildQueue: BuildQueue[];
  setBuildQueue: React.Dispatch<React.SetStateAction<BuildQueue[]>>;
  army: Army;
  setArmy: React.Dispatch<React.SetStateAction<Army>>;
  setBuildings: React.Dispatch<React.SetStateAction<Building[]>>;
  persistArmyToVillage: (army: Army) => void;
  user: { id: string } | null;
  villageId: string | null;
}

export function useQueueProcessing({
  trainingQueue,
  setTrainingQueue,
  buildQueue,
  setBuildQueue,
  army,
  setArmy,
  setBuildings,
  persistArmyToVillage,
  user,
  villageId,
}: UseQueueProcessingParams) {
  const armyRef = useRef(army);
  armyRef.current = army;

  // Training queue processing
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
          supabase.from('training_queue').delete().lte('finish_time', new Date(now).toISOString()).eq('user_id', user?.id ?? '').then();
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

  // Build queue processing
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
          supabase.from('build_queue').delete().lte('finish_time', new Date(now).toISOString()).eq('user_id', user?.id ?? '').not('building_type', 'in', '(outpost_upgrade,outpost_wall)').then();
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
}
