import { useMemo } from 'react';
import type { Building } from '@/lib/gameTypes';
import { BUILDING_INFO } from '@/lib/gameConstants';

export function useHousing(buildings: Building[]) {
  // Core building level: campfire (tier 1) or townhall (tier 2+)
  const townhallLevel = useMemo(() => {
    const th = buildings.find(b => b.type === 'townhall');
    if (th) return th.level;
    const cf = buildings.find(b => b.type === 'campfire');
    return cf?.level || 1;
  }, [buildings]);

  const maxHouses = useMemo(() => townhallLevel * 2, [townhallLevel]);

  const currentHouses = useMemo(() =>
    buildings.filter(b => b.type === 'house' || b.type === 'tent').length,
  [buildings]);

  const housingCapacity = useMemo(() => {
    let cap = 5; // base housing
    for (const b of buildings) {
      const info = BUILDING_INFO[b.type as keyof typeof BUILDING_INFO];
      if (info?.housingPerLevel) {
        cap += info.housingPerLevel * b.level;
      }
      if (b.type === 'townhall') {
        cap += b.level * 5;
      }
      if (b.type === 'campfire') {
        cap += b.level * 2;
      }
    }
    return cap;
  }, [buildings]);

  return { townhallLevel, maxHouses, currentHouses, housingCapacity };
}
