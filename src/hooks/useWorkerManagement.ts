import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Building, PopulationStats, WorkerAssignments } from '@/lib/gameTypes';
import { BUILDING_INFO } from '@/lib/gameConstants';

interface UseWorkerManagementParams {
  buildings: Building[];
  workerAssignments: WorkerAssignments;
  setWorkerAssignments: React.Dispatch<React.SetStateAction<WorkerAssignments>>;
  population: PopulationStats;
  villageId: string | null;
}

export function useWorkerManagement({
  buildings,
  workerAssignments,
  setWorkerAssignments,
  population,
  villageId,
}: UseWorkerManagementParams) {
  const getMaxWorkers = useCallback((building: Building) => {
    if (building.type === 'empty') return 0;
    const info = BUILDING_INFO[building.type];
    return info.workersPerLevel * building.level;
  }, []);

  const assignWorker = useCallback((buildingId: string) => {
    const building = buildings.find(b => b.id === buildingId);
    if (!building) return false;
    const maxW = getMaxWorkers(building);
    const current = workerAssignments[buildingId] || 0;
    if (current >= maxW) return false;
    if (population.civilians <= 0) return false;
    const newCount = current + 1;
    setWorkerAssignments(prev => ({ ...prev, [buildingId]: newCount }));
    supabase.from('buildings').update({ workers: newCount } as any).eq('id', buildingId).then();
    return true;
  }, [buildings, workerAssignments, population.civilians, getMaxWorkers, setWorkerAssignments]);

  const unassignWorker = useCallback((buildingId: string) => {
    const current = workerAssignments[buildingId] || 0;
    if (current <= 0) return false;
    const newCount = current - 1;
    setWorkerAssignments(prev => ({ ...prev, [buildingId]: newCount }));
    supabase.from('buildings').update({ workers: newCount } as any).eq('id', buildingId).then();
    return true;
  }, [workerAssignments, setWorkerAssignments]);

  return { getMaxWorkers, assignWorker, unassignWorker };
}
