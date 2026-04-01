import { useMemo } from 'react';
import type { Building } from '@/lib/gameTypes';
import { BUILDING_INFO } from '@/lib/gameConstants';

export function useHousing(buildings: Building[]) {
  const townhallLevel = useMemo(() => {
    const th = buildings.find(b => b.type === 'townhall');
    return th?.level || 1;
  }, [buildings]);

  const maxHouses = useMemo(() => townhallLevel * 2, [townhallLevel]);

  const currentHouses = useMemo(() => buildings.filter(b => b.type === 'house').length, [buildings]);

  const housingCapacity = useMemo(() => {
    let cap = 10; // base housing from townhall
    for (const b of buildings) {
      if (b.type === 'house') {
        cap += (BUILDING_INFO.house.housingPerLevel || 0) * b.level;
      }
      if (b.type === 'townhall') {
        cap += b.level * 5; // townhall also provides some housing
      }
    }
    return cap;
  }, [buildings]);

  return { townhallLevel, maxHouses, currentHouses, housingCapacity };
}
