import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ResourceIcon from './ResourceIcon';
import { ROAD_INFO, MAX_ROAD_LEVEL } from '@/lib/gameConstants';

interface Road {
  id: string;
  from_village_id: string;
  to_village_id: string;
  road_level: number;
}

interface Settlement {
  id: string;
  name: string;
}

export default function RoadsPanel() {
  const { resources, villageId, addResources, steel, addSteel } = useGame();
  const { user } = useAuth();
  const [roads, setRoads] = useState<Road[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [selectedDest, setSelectedDest] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('villages').select('id, name').eq('user_id', user.id).then(({ data }) => {
      if (data) setSettlements(data);
    });
    supabase.from('roads').select('*').eq('user_id', user.id).then(({ data }) => {
      if (data) setRoads(data as Road[]);
    });
  }, [user]);

  const getExistingRoad = (destId: string) => {
    return roads.find(r =>
      (r.from_village_id === villageId && r.to_village_id === destId) ||
      (r.from_village_id === destId && r.to_village_id === villageId)
    );
  };

  const handleBuildOrUpgrade = async (destId: string) => {
    if (!user || !villageId) return;
    setLoading(true);
    const existing = getExistingRoad(destId);
    const targetLevel = existing ? existing.road_level + 1 : 1;
    if (targetLevel > MAX_ROAD_LEVEL) { toast.error('Road already at max level!'); setLoading(false); return; }

    const cost = ROAD_INFO[targetLevel].cost;
    if (resources.gold < cost.gold || resources.wood < cost.wood || resources.stone < cost.stone) {
      toast.error('Not enough resources!'); setLoading(false); return;
    }
    if (cost.steel > 0 && steel < cost.steel) {
      toast.error('Not enough steel!'); setLoading(false); return;
    }

    if (existing) {
      const { error } = await supabase.from('roads').update({ road_level: targetLevel } as any).eq('id', existing.id);
      if (error) { toast.error('Failed to upgrade road'); setLoading(false); return; }
      setRoads(prev => prev.map(r => r.id === existing.id ? { ...r, road_level: targetLevel } : r));
    } else {
      const { data, error } = await supabase.from('roads').insert({
        user_id: user.id,
        from_village_id: villageId,
        to_village_id: destId,
        road_level: 1,
      } as any).select().single();
      if (error) { toast.error('Failed to build road'); setLoading(false); return; }
      setRoads(prev => [...prev, data as Road]);
    }

    addResources({ gold: -cost.gold, wood: -cost.wood, stone: -cost.stone, food: 0 });
    if (cost.steel > 0) addSteel(-cost.steel);
    toast.success(`${ROAD_INFO[targetLevel].emoji} ${ROAD_INFO[targetLevel].name} built!`);
    setLoading(false);
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
        const nextLevel = level + 1;
        const canUpgrade = nextLevel <= MAX_ROAD_LEVEL;
        const nextInfo = canUpgrade ? ROAD_INFO[nextLevel] : null;
        const currentInfo = level > 0 ? ROAD_INFO[level] : null;

        return (
          <div key={s.id} className="bg-muted/30 rounded-lg p-2 space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-foreground font-medium">{s.name}</span>
              <span className="text-muted-foreground">
                {currentInfo ? `${currentInfo.emoji} ${currentInfo.name} (−${Math.round(currentInfo.speedBonus * 100)}% travel)` : 'No road'}
              </span>
            </div>
            {canUpgrade && nextInfo && (
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5 text-[8px] text-muted-foreground">
                  {nextInfo.cost.gold > 0 && <span><ResourceIcon type="gold" size={10} />{nextInfo.cost.gold}</span>}
                  {nextInfo.cost.wood > 0 && <span><ResourceIcon type="wood" size={10} />{nextInfo.cost.wood}</span>}
                  {nextInfo.cost.stone > 0 && <span><ResourceIcon type="stone" size={10} />{nextInfo.cost.stone}</span>}
                  {nextInfo.cost.steel > 0 && <span>⚙️{nextInfo.cost.steel}</span>}
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleBuildOrUpgrade(s.id)}
                  disabled={loading}
                  className="text-[9px] bg-primary text-primary-foreground px-2 py-0.5 rounded disabled:opacity-40"
                >
                  {level === 0 ? 'Build' : 'Upgrade'} → {nextInfo.name}
                </motion.button>
              </div>
            )}
            {!canUpgrade && <p className="text-[8px] text-primary">✓ Max level</p>}
          </div>
        );
      })}
    </div>
  );
}

/** Returns the speed bonus (0-0.6) for a road between two villages, or 0 if no road */
export async function getRoadSpeedBonus(userId: string, fromId: string, toId: string): Promise<number> {
  const { data } = await supabase.from('roads').select('road_level').eq('user_id', userId).or(
    `and(from_village_id.eq.${fromId},to_village_id.eq.${toId}),and(from_village_id.eq.${toId},to_village_id.eq.${fromId})`
  ).maybeSingle();
  if (!data) return 0;
  return ROAD_INFO[(data as any).road_level]?.speedBonus || 0;
}
