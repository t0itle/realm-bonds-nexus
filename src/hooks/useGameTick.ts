import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Army, Resources, TroopType } from '@/lib/gameTypes';
import { TROOP_INFO } from '@/lib/gameConstants';

interface UseGameTickParams {
  villageId: string | null;
  user: { id: string } | null;
  totalProduction: Resources;
  buildingSteelProduction: number;
  mineSteelPerTick: number;
  storageCapacity: number;
  setResources: React.Dispatch<React.SetStateAction<Resources>>;
  setSteel: React.Dispatch<React.SetStateAction<number>>;
  army: Army;
  setArmy: React.Dispatch<React.SetStateAction<Army>>;
  setPopulationBase: React.Dispatch<React.SetStateAction<number>>;
  persistArmyToVillage: (army: Army) => void;
  allianceId: string | null;
  setAllianceTaxRate: React.Dispatch<React.SetStateAction<number>>;
  addSteel: (amount: number) => void;
}

export function useGameTick({
  villageId,
  user,
  totalProduction,
  buildingSteelProduction,
  mineSteelPerTick,
  storageCapacity,
  setResources,
  setSteel,
  army,
  setArmy,
  setPopulationBase,
  persistArmyToVillage,
  allianceId,
  setAllianceTaxRate,
  addSteel,
}: UseGameTickParams) {
  const totalProductionRef = useRef(totalProduction);
  totalProductionRef.current = totalProduction;
  const buildingSteelProductionRef = useRef(buildingSteelProduction);
  buildingSteelProductionRef.current = buildingSteelProduction;
  const mineSteelPerTickRef = useRef(mineSteelPerTick);
  mineSteelPerTickRef.current = mineSteelPerTick;
  const storageCapRef = useRef(storageCapacity);
  storageCapRef.current = storageCapacity;
  const armyRef = useRef(army);
  armyRef.current = army;
  const allianceIdRef = useRef(allianceId);
  allianceIdRef.current = allianceId;

  // Main resource tick + server sync + alliance tax refresh
  useEffect(() => {
    if (!villageId || !user) return;

    const tickUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resource-tick`;
    const tickBody = () => JSON.stringify({ user_id: user.id, current_village_id: villageId });
    fetch(tickUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      body: tickBody(),
    }).catch(() => {});

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

    const serverSync = setInterval(() => {
      fetch(tickUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: tickBody(),
      }).catch(() => {});
    }, 45000);

    const taxRefresh = setInterval(async () => {
      const aid = allianceIdRef.current;
      if (!aid) return;
      const { data } = await supabase.from('alliances').select('tax_rate').eq('id', aid).single();
      if (data) setAllianceTaxRate(data.tax_rate);
    }, 60000);

    return () => { clearInterval(tickInterval); clearInterval(serverSync); clearInterval(taxRefresh); };
  }, [villageId, user]);

  // Mine steel tick
  useEffect(() => {
    if (!user || !villageId || mineSteelPerTick <= 0) return;

    const interval = setInterval(() => {
      const steelPerTick = mineSteelPerTickRef.current;
      if (steelPerTick > 0) addSteel(steelPerTick);
    }, 10000);

    return () => clearInterval(interval);
  }, [user, villageId, mineSteelPerTick, addSteel]);
}
