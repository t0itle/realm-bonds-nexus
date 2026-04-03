import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ResourceIcon from './ResourceIcon';
import { ROAD_INFO, MAX_ROAD_LEVEL } from '@/lib/gameConstants';
import dirtRoadSprite from '@/assets/sprites/roads/dirt-road.png';
import cobblestoneRoadSprite from '@/assets/sprites/roads/cobblestone-road.png';
import pavedRoadSprite from '@/assets/sprites/roads/paved-road.png';

const ROAD_SPRITES: Record<number, string> = {
  1: dirtRoadSprite,
  2: cobblestoneRoadSprite,
  3: pavedRoadSprite,
};

interface Road {
  id: string;
  from_village_id: string;
  to_village_id: string;
  road_level: number;
  building_finish_time: string | null;
}

interface Settlement {
  id: string;
  name: string;
  map_x: number;
  map_y: number;
}

/** Base build seconds per 1000 map-units of distance, multiplied by road level */
const BUILD_RATE = 0.12; // seconds per map-unit
const LEVEL_MULTIPLIER = [0, 1, 2.5, 5]; // index = target level

export default function RoadsPanel() {
  const { resources, villageId, addResources, steel, addSteel } = useGame();
  const { user } = useAuth();
  const [roads, setRoads] = useState<Road[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!user) return;
    supabase.from('villages').select('id, name, map_x, map_y').eq('user_id', user.id).then(({ data }) => {
      if (data) setSettlements(data);
    });
    supabase.from('roads').select('*').eq('user_id', user.id).then(({ data }) => {
      if (data) setRoads(data as Road[]);
    });
  }, [user]);

  // Tick for countdown & auto-complete
  useEffect(() => {
    const timer = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      // Auto-complete finished roads
      setRoads(prev => {
        let changed = false;
        const next = prev.map(r => {
          if (r.building_finish_time && new Date(r.building_finish_time).getTime() <= t) {
            changed = true;
            supabase.from('roads').update({ building_finish_time: null } as any).eq('id', r.id).then();
            toast.success(`🛤️ Road to ${settlements.find(s => s.id === r.to_village_id || s.id === r.from_village_id)?.name || 'settlement'} complete!`);
            return { ...r, building_finish_time: null };
          }
          return r;
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [settlements]);

  const getExistingRoad = (destId: string) => {
    return roads.find(r =>
      (r.from_village_id === villageId && r.to_village_id === destId) ||
      (r.from_village_id === destId && r.to_village_id === villageId)
    );
  };

  const calcDistance = (destId: string): number => {
    const origin = settlements.find(s => s.id === villageId);
    const dest = settlements.find(s => s.id === destId);
    if (!origin || !dest) return 10000;
    return Math.sqrt(Math.pow(dest.map_x - origin.map_x, 2) + Math.pow(dest.map_y - origin.map_y, 2));
  };

  const calcBuildTime = (destId: string, targetLevel: number): number => {
    const dist = calcDistance(destId);
    return Math.max(30, Math.floor(dist * BUILD_RATE * LEVEL_MULTIPLIER[targetLevel]));
  };

  const handleBuildOrUpgrade = async (destId: string) => {
    if (!user || !villageId) return;
    setLoading(true);
    const existing = getExistingRoad(destId);

    // Can't build/upgrade while under construction
    if (existing?.building_finish_time && new Date(existing.building_finish_time).getTime() > Date.now()) {
      toast.error('Road already under construction!'); setLoading(false); return;
    }

    const targetLevel = existing ? existing.road_level + 1 : 1;
    if (targetLevel > MAX_ROAD_LEVEL) { toast.error('Road already at max level!'); setLoading(false); return; }

    const cost = ROAD_INFO[targetLevel].cost;
    if (resources.gold < cost.gold || resources.wood < cost.wood || resources.stone < cost.stone) {
      toast.error('Not enough resources!'); setLoading(false); return;
    }
    if (cost.steel > 0 && steel < cost.steel) {
      toast.error('Not enough steel!'); setLoading(false); return;
    }

    const buildSec = calcBuildTime(destId, targetLevel);
    const finishTime = new Date(Date.now() + buildSec * 1000).toISOString();

    if (existing) {
      const { error } = await supabase.from('roads').update({
        road_level: targetLevel,
        building_finish_time: finishTime,
      } as any).eq('id', existing.id);
      if (error) { toast.error('Failed to upgrade road'); setLoading(false); return; }
      setRoads(prev => prev.map(r => r.id === existing.id ? { ...r, road_level: targetLevel, building_finish_time: finishTime } : r));
    } else {
      const { data, error } = await supabase.from('roads').insert({
        user_id: user.id,
        from_village_id: villageId,
        to_village_id: destId,
        road_level: 1,
        building_finish_time: finishTime,
      } as any).select().single();
      if (error) { toast.error('Failed to build road'); setLoading(false); return; }
      setRoads(prev => [...prev, data as Road]);
    }

    addResources({ gold: -cost.gold, wood: -cost.wood, stone: -cost.stone, food: 0 });
    if (cost.steel > 0) addSteel(-cost.steel);
    toast.success(`🛤️ Road construction started! (~${buildSec}s)`);
    setLoading(false);
  };

  const formatTime = (sec: number) => {
    if (sec >= 3600) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
    if (sec >= 60) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    return `${sec}s`;
  };

  const otherSettlements = settlements.filter(s => s.id !== villageId);

  if (otherSettlements.length === 0) {
    return <p className="text-[10px] text-muted-foreground text-center py-2">Need a second settlement to build roads.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted-foreground font-semibold">🛤️ Roads</p>
      {otherSettlements.map(s => {
        const road = getExistingRoad(s.id);
        const level = road?.road_level || 0;
        const isBuilding = road?.building_finish_time && new Date(road.building_finish_time).getTime() > now;
        const effectiveLevel = isBuilding ? Math.max(0, level - 1) : level;
        const nextLevel = effectiveLevel + 1;
        const canUpgrade = nextLevel <= MAX_ROAD_LEVEL && !isBuilding;
        const nextInfo = canUpgrade ? ROAD_INFO[nextLevel] : null;
        const currentInfo = effectiveLevel > 0 ? ROAD_INFO[effectiveLevel] : null;

        return (
          <div key={s.id} className="bg-muted/30 rounded-lg p-2 space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-foreground font-medium">{s.name}</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                {currentInfo ? (
                  <><img src={ROAD_SPRITES[effectiveLevel]} alt={currentInfo.name} width={14} height={14} className="inline rounded" /> {currentInfo.name} (−{Math.round(currentInfo.speedBonus * 100)}% travel)</>
                ) : 'No road'}
              </span>
            </div>

            {/* Construction progress */}
            {isBuilding && road?.building_finish_time && (() => {
              const finishMs = new Date(road.building_finish_time).getTime();
              const remaining = Math.max(0, Math.ceil((finishMs - now) / 1000));
              const totalBuildSec = calcBuildTime(s.id, level);
              const elapsed = totalBuildSec - remaining;
              const pct = Math.min(100, (elapsed / totalBuildSec) * 100);
              return (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between text-[8px]">
                    <span className="text-primary">🔨 Building {ROAD_INFO[level]?.name}...</span>
                    <span className="text-muted-foreground">{formatTime(remaining)}</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}

            {canUpgrade && nextInfo && (
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5 text-[8px] text-muted-foreground">
                  {nextInfo.cost.gold > 0 && <span><ResourceIcon type="gold" size={10} />{nextInfo.cost.gold}</span>}
                  {nextInfo.cost.wood > 0 && <span><ResourceIcon type="wood" size={10} />{nextInfo.cost.wood}</span>}
                  {nextInfo.cost.stone > 0 && <span><ResourceIcon type="stone" size={10} />{nextInfo.cost.stone}</span>}
                  {nextInfo.cost.steel > 0 && <span>⚙️{nextInfo.cost.steel}</span>}
                  <span className="text-primary/70">⏱️{formatTime(calcBuildTime(s.id, nextLevel))}</span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleBuildOrUpgrade(s.id)}
                  disabled={loading}
                  className="text-[9px] bg-primary text-primary-foreground px-2 py-0.5 rounded disabled:opacity-40"
                >
                  {effectiveLevel === 0 ? 'Build' : 'Upgrade'} → {nextInfo.name}
                </motion.button>
              </div>
            )}
            {!canUpgrade && !isBuilding && level >= MAX_ROAD_LEVEL && <p className="text-[8px] text-primary">✓ Max level</p>}
          </div>
        );
      })}
    </div>
  );
}

/** Returns the speed bonus (0-0.6) for a road between two villages, or 0 if no road */
export async function getRoadSpeedBonus(userId: string, fromId: string, toId: string): Promise<number> {
  const { data } = await supabase.from('roads').select('road_level, building_finish_time').eq('user_id', userId).or(
    `and(from_village_id.eq.${fromId},to_village_id.eq.${toId}),and(from_village_id.eq.${toId},to_village_id.eq.${fromId})`
  ).maybeSingle();
  if (!data) return 0;
  const d = data as any;
  // If under construction, use previous level bonus
  if (d.building_finish_time && new Date(d.building_finish_time).getTime() > Date.now()) {
    const prevLevel = Math.max(0, d.road_level - 1);
    return prevLevel > 0 ? (ROAD_INFO[prevLevel]?.speedBonus || 0) : 0;
  }
  return ROAD_INFO[d.road_level]?.speedBonus || 0;
}
