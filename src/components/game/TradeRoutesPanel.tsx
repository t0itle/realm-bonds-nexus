import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ResourceIcon from './ResourceIcon';
import { TRADE_INTERVALS, ROAD_INFO } from '@/lib/gameConstants';

interface TradeRoute {
  id: string;
  from_village_id: string;
  to_village_id: string;
  gold: number;
  wood: number;
  stone: number;
  food: number;
  interval_seconds: number;
  next_run_at: string;
  active: boolean;
}

interface Settlement { id: string; name: string; map_x: number; map_y: number; }

export default function TradeRoutesPanel() {
  const { resources, villageId, addResources } = useGame();
  const { user } = useAuth();
  const [routes, setRoutes] = useState<TradeRoute[]>([]);
  const [roads, setRoads] = useState<{ from_village_id: string; to_village_id: string; road_level: number }[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDest, setSelectedDest] = useState('');
  const [amounts, setAmounts] = useState({ gold: 0, wood: 0, stone: 0, food: 0 });
  const [interval, setInterval_] = useState(300);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('villages').select('id, name, map_x, map_y').eq('user_id', user.id).then(({ data }) => {
      if (data) setSettlements(data as Settlement[]);
    });
    supabase.from('roads').select('from_village_id, to_village_id, road_level').eq('user_id', user.id).then(({ data }) => {
      if (data) setRoads(data as any);
    });
    loadRoutes();
  }, [user]);

  const loadRoutes = async () => {
    if (!user) return;
    const { data } = await supabase.from('trade_routes').select('*').eq('user_id', user.id);
    if (data) setRoutes(data as TradeRoute[]);
  };

  // Process due trade routes
  useEffect(() => {
    if (!user || !villageId) return;
    const timer = window.setInterval(async () => {
      const now = new Date().toISOString();
      const dueRoutes = routes.filter(r => r.active && r.from_village_id === villageId && r.next_run_at <= now);
      for (const route of dueRoutes) {
        const canSend = resources.gold >= route.gold && resources.wood >= route.wood &&
          resources.stone >= route.stone && resources.food >= route.food;
        if (!canSend) continue;

        // Calculate travel time based on distance + road bonus
        const origin = settlements.find(s => s.id === route.from_village_id);
        const dest = settlements.find(s => s.id === route.to_village_id);
        let travelSec = 60;
        if (origin && dest) {
          const dist = Math.sqrt(Math.pow(dest.map_x - origin.map_x, 2) + Math.pow(dest.map_y - origin.map_y, 2));
          const baseSec = Math.max(30, Math.floor(dist / 500));
          const road = roads.find(r =>
            (r.from_village_id === route.from_village_id && r.to_village_id === route.to_village_id) ||
            (r.from_village_id === route.to_village_id && r.to_village_id === route.from_village_id)
          );
          const bonus = road ? (ROAD_INFO[road.road_level]?.speedBonus || 0) : 0;
          travelSec = Math.max(15, Math.floor(baseSec * (1 - bonus)));
        }
        const arrivesAt = new Date(Date.now() + travelSec * 1000).toISOString();
        const { error } = await supabase.from('caravans').insert({
          user_id: user.id,
          from_village_id: route.from_village_id,
          to_village_id: route.to_village_id,
          gold: route.gold, wood: route.wood, stone: route.stone, food: route.food, steel: 0,
          arrives_at: arrivesAt,
        } as any);

        if (!error) {
          addResources({ gold: -route.gold, wood: -route.wood, stone: -route.stone, food: -route.food });
          const nextRun = new Date(Date.now() + route.interval_seconds * 1000).toISOString();
          await supabase.from('trade_routes').update({ next_run_at: nextRun } as any).eq('id', route.id);
          setRoutes(prev => prev.map(r => r.id === route.id ? { ...r, next_run_at: nextRun } : r));
          const dest = settlements.find(s => s.id === route.to_village_id);
          toast.info(`📦 Trade route sent caravan to ${dest?.name || 'settlement'}`);
        }
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [user, villageId, routes, resources]);

  const handleCreate = async () => {
    if (!user || !villageId || !selectedDest) return;
    const total = amounts.gold + amounts.wood + amounts.stone + amounts.food;
    if (total <= 0) { toast.error('Set resource amounts!'); return; }
    setSaving(true);

    const nextRun = new Date(Date.now() + interval * 1000).toISOString();
    const { data, error } = await supabase.from('trade_routes').insert({
      user_id: user.id,
      from_village_id: villageId,
      to_village_id: selectedDest,
      gold: amounts.gold, wood: amounts.wood, stone: amounts.stone, food: amounts.food,
      interval_seconds: interval,
      next_run_at: nextRun,
    } as any).select().single();

    if (error) { toast.error('Failed to create trade route'); setSaving(false); return; }
    setRoutes(prev => [...prev, data as TradeRoute]);
    setShowCreate(false);
    setAmounts({ gold: 0, wood: 0, stone: 0, food: 0 });
    toast.success('📦 Trade route created!');
    setSaving(false);
  };

  const toggleRoute = async (id: string, active: boolean) => {
    await supabase.from('trade_routes').update({ active } as any).eq('id', id);
    setRoutes(prev => prev.map(r => r.id === id ? { ...r, active } : r));
  };

  const deleteRoute = async (id: string) => {
    await supabase.from('trade_routes').delete().eq('id', id);
    setRoutes(prev => prev.filter(r => r.id !== id));
    toast.success('Trade route removed');
  };

  const otherSettlements = settlements.filter(s => s.id !== villageId);

  if (otherSettlements.length === 0) {
    return <p className="text-[10px] text-muted-foreground text-center py-2">Need a second settlement for trade routes.</p>;
  }

  const myRoutes = routes.filter(r => r.from_village_id === villageId);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground font-semibold">📦 Trade Routes</p>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowCreate(!showCreate)}
          className="text-[9px] bg-primary/20 text-primary px-2 py-0.5 rounded">
          {showCreate ? 'Cancel' : '+ New'}
        </motion.button>
      </div>

      {showCreate && (
        <div className="space-y-1.5 bg-muted/30 rounded-lg p-2">
          <select value={selectedDest} onChange={e => setSelectedDest(e.target.value)}
            className="w-full text-[11px] bg-muted/50 border border-border rounded-lg p-1.5 text-foreground">
            <option value="">Select destination...</option>
            {otherSettlements.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-1.5">
            {(['gold', 'wood', 'stone', 'food'] as const).map(res => (
              <div key={res} className="flex items-center gap-1 bg-muted/50 rounded-lg p-1.5">
                <ResourceIcon type={res} size={12} />
                <input type="number" min={0} value={amounts[res]}
                  onChange={e => setAmounts(prev => ({ ...prev, [res]: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-full bg-transparent text-[11px] text-foreground outline-none tabular-nums" placeholder="0" />
              </div>
            ))}
          </div>
          <select value={interval} onChange={e => setInterval_(Number(e.target.value))}
            className="w-full text-[11px] bg-muted/50 border border-border rounded-lg p-1.5 text-foreground">
            {TRADE_INTERVALS.map(t => <option key={t.seconds} value={t.seconds}>{t.label}</option>)}
          </select>
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleCreate} disabled={saving || !selectedDest}
            className="w-full bg-primary text-primary-foreground font-display text-[11px] py-1.5 rounded-lg disabled:opacity-40">
            Create Trade Route
          </motion.button>
        </div>
      )}

      {myRoutes.map(route => {
        const dest = settlements.find(s => s.id === route.to_village_id);
        const intervalLabel = TRADE_INTERVALS.find(t => t.seconds === route.interval_seconds)?.label || `${route.interval_seconds}s`;
        const nextIn = Math.max(0, Math.ceil((new Date(route.next_run_at).getTime() - Date.now()) / 1000));
        return (
          <div key={route.id} className={`bg-muted/30 rounded-lg p-2 space-y-1 ${!route.active ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-foreground">→ {dest?.name || 'Unknown'} ({intervalLabel})</span>
              <div className="flex gap-1">
                <button onClick={() => toggleRoute(route.id, !route.active)}
                  className="text-[8px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                  {route.active ? '⏸️' : '▶️'}
                </button>
                <button onClick={() => deleteRoute(route.id)}
                  className="text-[8px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive">✕</button>
              </div>
            </div>
            <div className="flex gap-1.5 text-[8px] text-muted-foreground">
              {route.gold > 0 && <span>🪙{route.gold}</span>}
              {route.wood > 0 && <span>🪵{route.wood}</span>}
              {route.stone > 0 && <span>🪨{route.stone}</span>}
              {route.food > 0 && <span>🌾{route.food}</span>}
            </div>
            {route.active && <p className="text-[8px] text-primary">Next in {nextIn}s</p>}
          </div>
        );
      })}
    </div>
  );
}
