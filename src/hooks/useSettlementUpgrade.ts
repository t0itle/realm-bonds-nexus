import { useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Resources } from '@/lib/gameTypes';
import { SETTLEMENT_UPGRADES } from '@/lib/gameConstants';

interface UseSettlementUpgradeParams {
  villageId: string | null;
  user: { id: string } | null;
  settlementType: 'camp' | 'village' | 'town' | 'city';
  setSettlementType: React.Dispatch<React.SetStateAction<'camp' | 'village' | 'town' | 'city'>>;
  settlementUpgradeFinishTime: number | null;
  setSettlementUpgradeFinishTime: React.Dispatch<React.SetStateAction<number | null>>;
  settlementTypeRef: React.MutableRefObject<'camp' | 'village' | 'town' | 'city'>;
  setMyVillages: React.Dispatch<React.SetStateAction<{ id: string; name: string; settlement_type: string }[]>>;
  resources: Resources;
  setResources: React.Dispatch<React.SetStateAction<Resources>>;
  steel: number;
  setSteel: React.Dispatch<React.SetStateAction<number>>;
  canAfford: (cost: Resources) => boolean;
  canAffordSteel: (amount: number) => boolean;
  townhallLevel: number;
}

export function useSettlementUpgrade({
  villageId, user, settlementType, setSettlementType,
  settlementUpgradeFinishTime, setSettlementUpgradeFinishTime,
  settlementTypeRef, setMyVillages,
  resources, setResources, steel, setSteel,
  canAfford, canAffordSteel, townhallLevel,
}: UseSettlementUpgradeParams) {
  const isSettlementUpgrading = settlementUpgradeFinishTime !== null && settlementUpgradeFinishTime > Date.now();

  useEffect(() => {
    if (!settlementUpgradeFinishTime) return;
    const apply = () => {
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
    };
    if (settlementUpgradeFinishTime <= Date.now()) { apply(); return; }
    const timer = setTimeout(apply, settlementUpgradeFinishTime - Date.now());
    return () => clearTimeout(timer);
  }, [settlementUpgradeFinishTime, settlementType, villageId]);

  const upgradeSettlement = useCallback(async (): Promise<boolean> => {
    if (!villageId || !user) return false;
    const upgrade = SETTLEMENT_UPGRADES[settlementType];
    if (!upgrade) { toast.error('Already at maximum settlement level!'); return false; }
    // Tier upgrade requires reaching max sub-level (checked elsewhere)
    if (!canAfford(upgrade.cost)) { toast.error('Not enough resources!'); return false; }
    if (upgrade.steelCost > 0 && !canAffordSteel(upgrade.steelCost)) { toast.error('Not enough steel!'); return false; }
    if (isSettlementUpgrading) { toast.error('Settlement upgrade already in progress!'); return false; }

    const newResources = {
      gold: resources.gold - upgrade.cost.gold, wood: resources.wood - upgrade.cost.wood,
      stone: resources.stone - upgrade.cost.stone, food: resources.food - upgrade.cost.food,
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
      village_id: villageId,
    } as any).then();

    toast.success(`🏗️ Upgrading to ${upgrade.label}! This will take ${Math.floor(upgrade.buildTimeSec / 3600)}h.`);
    return true;
  }, [villageId, user, settlementType, townhallLevel, canAfford, canAffordSteel, resources, steel, isSettlementUpgrading]);

  return { upgradeSettlement, isSettlementUpgrading };
}
