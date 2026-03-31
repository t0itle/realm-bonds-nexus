import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ResourceIcon from './ResourceIcon';

interface Caravan {
  id: string;
  from_village_id: string;
  to_village_id: string;
  gold: number;
  wood: number;
  stone: number;
  food: number;
  steel: number;
  departed_at: string;
  arrives_at: string;
  status: string;
  raided_by: string | null;
}

interface Settlement {
  id: string;
  name: string;
  map_x: number;
  map_y: number;
}

export default function CaravanPanel({ onClose }: { onClose: () => void }) {
  const { resources, storageCapacity, villageId, addResources } = useGame();
  const { user } = useAuth();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [caravans, setCaravans] = useState<Caravan[]>([]);
  const [selectedDest, setSelectedDest] = useState<string>('');
  const [sendAmounts, setSendAmounts] = useState({ gold: 0, wood: 0, stone: 0, food: 0 });
  const [sending, setSending] = useState(false);

  // Load user's settlements
  useEffect(() => {
    if (!user) return;
    supabase.from('villages').select('id, name, map_x, map_y').eq('user_id', user.id).then(({ data }) => {
      if (data) setSettlements(data);
    });
  }, [user]);

  // Load active caravans
  useEffect(() => {
    if (!user) return;
    const loadCaravans = async () => {
      const { data } = await supabase.from('caravans').select('*').eq('user_id', user.id).eq('status', 'in_transit');
      if (data) setCaravans(data as Caravan[]);
    };
    loadCaravans();

    // Realtime subscription
    const channel = supabase.channel('my-caravans')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'caravans', filter: `user_id=eq.${user.id}` }, () => {
        loadCaravans();
      }).subscribe();

    // Process arrivals every 5s
    const interval = setInterval(async () => {
      const now = new Date().toISOString();
      const { data: arrived } = await supabase.from('caravans').select('*')
        .eq('user_id', user.id).eq('status', 'in_transit').lte('arrives_at', now);
      if (arrived && arrived.length > 0) {
        for (const c of arrived) {
          // Add resources to destination village
          await supabase.from('villages').update({
            gold: (c as any).gold,
            wood: (c as any).wood,
            stone: (c as any).stone,
            food: (c as any).food,
          }).eq('id', (c as any).to_village_id);

          await supabase.from('caravans').update({ status: 'delivered' } as any).eq('id', (c as any).id);
          toast.success(`📦 Caravan arrived! Resources delivered.`);
        }
        loadCaravans();
      }
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user]);

  const calcTravelTime = (destId: string): number => {
    const origin = settlements.find(s => s.id === villageId);
    const dest = settlements.find(s => s.id === destId);
    if (!origin || !dest) return 60;
    const dist = Math.sqrt(Math.pow(dest.map_x - origin.map_x, 2) + Math.pow(dest.map_y - origin.map_y, 2));
    return Math.max(30, Math.floor(dist / 500)); // ~500 units per second
  };

  const handleSend = async () => {
    if (!user || !villageId || !selectedDest) return;
    const total = sendAmounts.gold + sendAmounts.wood + sendAmounts.stone + sendAmounts.food;
    if (total <= 0) { toast.error('Select resources to send!'); return; }
    if (sendAmounts.gold > resources.gold || sendAmounts.wood > resources.wood ||
      sendAmounts.stone > resources.stone || sendAmounts.food > resources.food) {
      toast.error('Not enough resources!'); return;
    }

    setSending(true);
    const travelSec = calcTravelTime(selectedDest);
    const arrivesAt = new Date(Date.now() + travelSec * 1000).toISOString();

    const { error } = await supabase.from('caravans').insert({
      user_id: user.id,
      from_village_id: villageId,
      to_village_id: selectedDest,
      gold: sendAmounts.gold,
      wood: sendAmounts.wood,
      stone: sendAmounts.stone,
      food: sendAmounts.food,
      steel: 0,
      arrives_at: arrivesAt,
    } as any);

    if (error) {
      toast.error('Failed to send caravan');
      setSending(false);
      return;
    }

    // Deduct resources from origin
    addResources({
      gold: -sendAmounts.gold, wood: -sendAmounts.wood,
      stone: -sendAmounts.stone, food: -sendAmounts.food,
    });

    toast.success(`🐴 Caravan dispatched! Arrives in ${travelSec}s`);
    setSendAmounts({ gold: 0, wood: 0, stone: 0, food: 0 });
    setSending(false);
  };

  const otherSettlements = settlements.filter(s => s.id !== villageId);
  const totalStored = Math.floor(resources.gold + resources.wood + resources.stone + resources.food);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      className="game-panel border-glow rounded-xl p-3 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm text-foreground">🐴 Caravan & Storage</h3>
        <button onClick={onClose} className="text-muted-foreground text-sm w-6 h-6 flex items-center justify-center rounded-full hover:bg-muted/50">✕</button>
      </div>

      {/* Storage overview */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Storage</span>
          <span className="text-foreground font-semibold">{totalStored.toLocaleString()} / {(storageCapacity * 4).toLocaleString()}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${totalStored > storageCapacity * 3.4 ? 'bg-destructive' : 'bg-primary'}`}
            style={{ width: `${Math.min(100, (totalStored / (storageCapacity * 4)) * 100)}%` }}
          />
        </div>
        <p className="text-[8px] text-muted-foreground">
          Each resource caps at {storageCapacity.toLocaleString()}. Build warehouses to increase capacity.
          {totalStored > storageCapacity * 3.4 && ' ⚠️ Storage nearly full — excess production will be lost!'}
        </p>
      </div>

      {/* Send caravan */}
      {otherSettlements.length > 0 ? (
        <div className="space-y-2 border-t border-border/50 pt-2">
          <p className="text-[10px] text-muted-foreground font-semibold">Send Resources to Settlement</p>
          <select
            value={selectedDest}
            onChange={e => setSelectedDest(e.target.value)}
            className="w-full text-[11px] bg-muted/50 border border-border rounded-lg p-1.5 text-foreground"
          >
            <option value="">Select destination...</option>
            {otherSettlements.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({calcTravelTime(s.id)}s travel)
              </option>
            ))}
          </select>

          {selectedDest && (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                {(['gold', 'wood', 'stone', 'food'] as const).map(res => (
                  <div key={res} className="flex items-center gap-1 bg-muted/30 rounded-lg p-1.5">
                    <ResourceIcon type={res} size={12} />
                    <input
                      type="number"
                      min={0}
                      max={Math.floor(resources[res])}
                      value={sendAmounts[res]}
                      onChange={e => setSendAmounts(prev => ({ ...prev, [res]: Math.max(0, Math.min(Math.floor(resources[res]), parseInt(e.target.value) || 0)) }))}
                      className="w-full bg-transparent text-[11px] text-foreground outline-none tabular-nums"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleSend}
                disabled={sending || sendAmounts.gold + sendAmounts.wood + sendAmounts.stone + sendAmounts.food <= 0}
                className="w-full bg-primary text-primary-foreground font-display text-[11px] py-2 rounded-lg glow-gold-sm disabled:opacity-40 active:scale-95 transition-transform"
              >
                🐴 Send Caravan ({calcTravelTime(selectedDest)}s travel) ⚠️ Can be raided!
              </motion.button>
            </>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground text-center py-2 border-t border-border/50">
          Found a second settlement on the map to enable caravan transfers.
        </p>
      )}

      {/* Active caravans */}
      {caravans.length > 0 && (
        <div className="space-y-1.5 border-t border-border/50 pt-2">
          <p className="text-[10px] text-muted-foreground font-semibold">Active Caravans</p>
          {caravans.map(c => {
            const dest = settlements.find(s => s.id === c.to_village_id);
            const totalSec = (new Date(c.arrives_at).getTime() - new Date(c.departed_at).getTime()) / 1000;
            const elapsed = (Date.now() - new Date(c.departed_at).getTime()) / 1000;
            const pct = Math.min(100, (elapsed / totalSec) * 100);
            const remaining = Math.max(0, Math.ceil(totalSec - elapsed));
            return (
              <div key={c.id} className="bg-muted/30 rounded-lg p-2 space-y-1">
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-foreground">→ {dest?.name || 'Unknown'}</span>
                  <span className="text-muted-foreground">{remaining}s remaining</span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex gap-1.5 text-[8px] text-muted-foreground">
                  {c.gold > 0 && <span>🪙{c.gold}</span>}
                  {c.wood > 0 && <span>🪵{c.wood}</span>}
                  {c.stone > 0 && <span>🪨{c.stone}</span>}
                  {c.food > 0 && <span>🌾{c.food}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
