import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Army, BattleLog, Building, Resources, Vassalage, TroopType, InjuredArmy } from '@/lib/gameTypes';
import { TROOP_INFO, resolveCombat } from '@/lib/gameConstants';

interface UseCombatParams {
  army: Army;
  setArmy: React.Dispatch<React.SetStateAction<Army>>;
  buildings: Building[];
  resources: Resources;
  setResources: React.Dispatch<React.SetStateAction<Resources>>;
  steel: number;
  setSteel: React.Dispatch<React.SetStateAction<number>>;
  injuredTroops: InjuredArmy;
  setInjuredTroops: React.Dispatch<React.SetStateAction<InjuredArmy>>;
  vassalages: Vassalage[];
  setVassalages: React.Dispatch<React.SetStateAction<Vassalage[]>>;
  villageId: string | null;
  user: { id: string } | null;
  displayName: string;
  getApothecaryLevel: () => number;
  returnTroops: (survivors: Partial<Army>) => void;
  deployTroops: (sentArmy: Partial<Army>) => void;
  addResources: (r: Partial<Resources>) => void;
  setBattleLogs: React.Dispatch<React.SetStateAction<BattleLog[]>>;
  setPopulationBase: React.Dispatch<React.SetStateAction<number>>;
}

export function useCombat({
  army,
  buildings,
  injuredTroops,
  setInjuredTroops,
  vassalages,
  setVassalages,
  villageId,
  user,
  displayName,
  getApothecaryLevel,
  returnTroops,
  addResources,
  setBattleLogs,
  setPopulationBase,
}: UseCombatParams) {
  const getWallLevel = useCallback(() => {
    const wall = buildings.find(b => b.type === 'wall');
    return wall?.level || 0;
  }, [buildings]);

  const attackTarget = useCallback((targetName: string, targetPower: number, sentArmy?: Partial<Army>) => {
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
  }, [army, addResources, returnTroops, getApothecaryLevel, setInjuredTroops, setPopulationBase, setBattleLogs]);

  const attackPlayer = useCallback(async (targetUserId: string, targetName: string, targetVillageId: string, sentArmy?: Partial<Army>): Promise<BattleLog | null> => {
    if (!user || !villageId) return null;
    const attackingArmy: Army = sentArmy ? {
      militia: sentArmy.militia ?? 0, archer: sentArmy.archer ?? 0, knight: sentArmy.knight ?? 0,
      cavalry: sentArmy.cavalry ?? 0, siege: sentArmy.siege ?? 0, scout: sentArmy.scout ?? 0,
    } : { ...army };

    const isMyVassal = vassalages.some(v => v.lord_id === user.id && v.vassal_id === targetUserId && v.status === 'active');
    if (isMyVassal) return null;

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

    const { data: reinforcements } = await supabase
      .from('active_reinforcements')
      .select('*')
      .eq('host_village_id', targetVillageId);

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

    const { data: defBuildings } = await supabase.from('buildings').select('*').eq('village_id', targetVillageId);
    const defWall = defBuildings?.find(b => b.type === 'wall');
    const defWallLevel = defWall?.level || 0;

    const result = resolveCombat(attackingArmy, defArmy, 0, defWallLevel);

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
    if (Object.values(survivors).some(v => v && v > 0)) returnTroops(survivors);
    if (Object.keys(pvpInjured).length > 0) setInjuredTroops(prev => {
      const u = { ...prev };
      for (const [t, c] of Object.entries(pvpInjured) as [TroopType, number][]) u[t] += c;
      return u;
    });
    if (pvpPopLost > 0) setPopulationBase(prev => Math.max(1, prev - pvpPopLost));

    let remainingLosses = { ...result.defenderLosses } as Record<TroopType, number>;

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
        resourcesRaided = undefined;
      }

      if (result.powerRatio > 1.5 && defBuildings && defBuildings.length > 0) {
        const damageable = defBuildings.filter(b => b.level > 1 && b.type !== 'townhall');
        if (damageable.length > 0) {
          const target = damageable[Math.floor(Math.random() * damageable.length)];
          buildingDamaged = target.type;
          buildingDamageLevels = 1;
          await supabase.from('buildings').update({ level: target.level - 1 }).eq('id', target.id);
        }
      }

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
  }, [army, user, villageId, addResources, displayName, vassalages, returnTroops, getApothecaryLevel, setInjuredTroops, setPopulationBase, setBattleLogs, setVassalages]);

  return { getWallLevel, attackTarget, attackPlayer };
}
