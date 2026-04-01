import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import { useGame } from '@/hooks/useGameState';
import { TROOP_INFO, calcMarchTime } from '@/lib/gameConstants';
import type { TroopType, Army } from '@/lib/gameTypes';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Outpost {
  id: string;
  x: number;
  y: number;
  name: string;
  user_id: string;
  level: number;
  garrison_power: number;
  garrison_troops: Partial<Record<TroopType, number>>;
  outpost_type: string;
}

interface TroopTransferPanelProps {
  outpost: Outpost;
  allOutposts: Outpost[];
  myVillagePos: { x: number; y: number };
  onTransferComplete: () => void;
  createMarch: (id: string, targetName: string, targetX: number, targetY: number, travelSec: number, action: () => void, sentArmy?: Partial<Record<string, number>>) => void;
}

type TransferDirection = 'to-outpost' | 'from-outpost';

export default function TroopTransferPanel({
  outpost, allOutposts, myVillagePos, onTransferComplete, createMarch,
}: TroopTransferPanelProps) {
  const { army, deployTroops, returnTroops } = useGame();
  const { user } = useAuth();
  const [direction, setDirection] = useState<TransferDirection>('to-outpost');
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [sending, setSending] = useState<Partial<Record<TroopType, number>>>({});
  const [expanded, setExpanded] = useState(false);

  // Available troops based on direction
  const availableTroops = useMemo(() => {
    if (direction === 'to-outpost') {
      return army; // Send from village to this outpost
    } else {
      return outpost.garrison_troops as Partial<Record<TroopType, number>>; // Send from outpost
    }
  }, [direction, army, outpost.garrison_troops]);

  // Possible targets: other forts/settlements owned by player, or village (for from-outpost)
  const targets = useMemo(() => {
    if (direction === 'to-outpost') {
      return []; // Sending to this outpost, no target selection needed
    } else {
      // From outpost to village or another fort
      const result: { id: string; name: string; x: number; y: number; type: 'village' | 'fort' }[] = [
        { id: 'village', name: 'Home Village', x: myVillagePos.x, y: myVillagePos.y, type: 'village' },
      ];
      const otherForts = allOutposts.filter(
        o => o.id !== outpost.id && o.user_id === user?.id &&
             (o.outpost_type === 'fort' || o.outpost_type === 'settlement')
      );
      otherForts.forEach(f => {
        result.push({ id: f.id, name: f.name, x: f.x, y: f.y, type: 'fort' });
      });
      return result;
    }
  }, [direction, allOutposts, outpost.id, myVillagePos, user?.id]);

  const troopTypes = (Object.keys(TROOP_INFO) as TroopType[]).filter(t => {
    const available = availableTroops[t] || 0;
    return available > 0;
  });

  const totalSending = Object.values(sending).reduce((s, v) => s + (v || 0), 0);

  // Calculate travel time
  const travelInfo = useMemo(() => {
    let fromX: number, fromY: number, toX: number, toY: number;
    if (direction === 'to-outpost') {
      fromX = myVillagePos.x; fromY = myVillagePos.y;
      toX = outpost.x; toY = outpost.y;
    } else {
      fromX = outpost.x; fromY = outpost.y;
      const target = targets.find(t => t.id === selectedTarget) || targets[0];
      if (!target) return { seconds: 0, distance: 0 };
      toX = target.x; toY = target.y;
    }
    const dist = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
    const marchArmy: Army = {
      militia: sending.militia || 0, archer: sending.archer || 0, knight: sending.knight || 0,
      cavalry: sending.cavalry || 0, siege: sending.siege || 0, scout: sending.scout || 0,
    };
    const seconds = totalSending > 0 ? calcMarchTime(dist, marchArmy) : Math.max(5, Math.floor(dist / 2000));
    return { seconds, distance: dist };
  }, [direction, myVillagePos, outpost, selectedTarget, targets, sending, totalSending]);

  const handleTransfer = async () => {
    if (totalSending === 0) { toast.error('Select troops to transfer!'); return; }

    if (direction === 'to-outpost') {
      // Village → Outpost: deploy troops, create march, on arrival add to garrison
      deployTroops(sending as Partial<Army>);

      const troopsToSend = { ...sending };
      createMarch(
        `transfer-${Date.now()}`,
        outpost.name,
        outpost.x, outpost.y,
        travelInfo.seconds,
        async () => {
          // Add troops to outpost garrison
          const current = { ...outpost.garrison_troops } as Record<string, number>;
          for (const [type, count] of Object.entries(troopsToSend)) {
            current[type] = (current[type] || 0) + (count || 0);
          }
          // Update garrison power too
          let newPower = 0;
          for (const [type, count] of Object.entries(current)) {
            const info = TROOP_INFO[type as TroopType];
            if (info) newPower += (count || 0) * (info.attack + info.defense);
          }
          await supabase.from('outposts').update({
            garrison_troops: current,
            garrison_power: newPower,
          } as any).eq('id', outpost.id);
          toast.success(`🏰 Troops arrived at ${outpost.name}!`);
          onTransferComplete();
        },
        troopsToSend
      );
      toast(`🚶 Troops marching to ${outpost.name}... ETA ${travelInfo.seconds}s`);
    } else {
      // Outpost → Target: remove from garrison, create march, on arrival add to target
      const troopsToSend = { ...sending };
      const target = targets.find(t => t.id === (selectedTarget || 'village')) || targets[0];
      if (!target) return;

      // Remove from outpost garrison immediately
      const updatedGarrison = { ...outpost.garrison_troops } as Record<string, number>;
      for (const [type, count] of Object.entries(troopsToSend)) {
        updatedGarrison[type] = Math.max(0, (updatedGarrison[type] || 0) - (count || 0));
      }
      let newPower = 0;
      for (const [type, count] of Object.entries(updatedGarrison)) {
        const info = TROOP_INFO[type as TroopType];
        if (info) newPower += (count || 0) * (info.attack + info.defense);
      }
      await supabase.from('outposts').update({
        garrison_troops: updatedGarrison,
        garrison_power: newPower,
      } as any).eq('id', outpost.id);

      // Create march from outpost to target
      // For marches from outposts, we need to set start position override
      if (user) {
        const arrivalTime = new Date(Date.now() + travelInfo.seconds * 1000).toISOString();
        await supabase.from('active_marches').insert({
          user_id: user.id,
          player_name: outpost.name,
          start_x: outpost.x, start_y: outpost.y,
          target_x: target.x, target_y: target.y,
          target_name: target.name,
          arrives_at: arrivalTime,
          march_type: 'transfer',
          sent_army: troopsToSend,
        } as any);
      }

      // After travel time, add troops to target
      setTimeout(async () => {
        if (target.type === 'village') {
          // Return to village army
          returnTroops(troopsToSend as Partial<Army>);
          toast.success(`🏘️ Troops from ${outpost.name} arrived home!`);
        } else {
          // Add to another fort's garrison
          const { data: targetOp } = await supabase.from('outposts').select('garrison_troops').eq('id', target.id).single();
          if (targetOp) {
            const targetGarrison = (targetOp.garrison_troops || {}) as Record<string, number>;
            for (const [type, count] of Object.entries(troopsToSend)) {
              targetGarrison[type] = (targetGarrison[type] || 0) + (count || 0);
            }
            let targetPower = 0;
            for (const [type, count] of Object.entries(targetGarrison)) {
              const info = TROOP_INFO[type as TroopType];
              if (info) targetPower += (count || 0) * (info.attack + info.defense);
            }
            await supabase.from('outposts').update({
              garrison_troops: targetGarrison,
              garrison_power: targetPower,
            } as any).eq('id', target.id);
            toast.success(`🏰 Troops arrived at ${target.name}!`);
          }
        }
        // Clean up the march record
        if (user) {
          supabase.from('active_marches').delete().eq('user_id', user.id).lte('arrives_at', new Date().toISOString()).then(() => {});
        }
        onTransferComplete();
      }, travelInfo.seconds * 1000);

      toast(`🚶 Troops leaving ${outpost.name} for ${target.name}... ETA ${travelInfo.seconds}s`);
    }

    setSending({});
    setExpanded(false);
  };

  if (!expanded) {
    return (
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setExpanded(true)}
        className="w-full bg-muted/30 rounded-lg px-3 py-2 text-left"
      >
        <p className="text-[10px] font-display text-foreground flex items-center gap-1">
          🔄 Transfer Troops
        </p>
        <p className="text-[8px] text-muted-foreground">
          Send troops to/from this {outpost.outpost_type === 'fort' ? 'fort' : 'settlement'}
        </p>
      </motion.button>
    );
  }

  return (
    <div className="bg-muted/30 rounded-lg p-2 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-display text-foreground">🔄 Transfer Troops</p>
        <button onClick={() => { setExpanded(false); setSending({}); }}
          className="text-[9px] text-muted-foreground hover:text-foreground">✕</button>
      </div>

      {/* Direction toggle */}
      <div className="flex gap-1">
        <button
          onClick={() => { setDirection('to-outpost'); setSending({}); }}
          className={`flex-1 text-[9px] py-1.5 rounded-lg font-display transition-colors ${
            direction === 'to-outpost'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          📥 To {outpost.outpost_type === 'fort' ? 'Fort' : 'Here'}
        </button>
        <button
          onClick={() => { setDirection('from-outpost'); setSending({}); setSelectedTarget('village'); }}
          className={`flex-1 text-[9px] py-1.5 rounded-lg font-display transition-colors ${
            direction === 'from-outpost'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          📤 From {outpost.outpost_type === 'fort' ? 'Fort' : 'Here'}
        </button>
      </div>

      {/* Target selection for from-outpost */}
      {direction === 'from-outpost' && targets.length > 1 && (
        <div className="space-y-1">
          <p className="text-[8px] text-muted-foreground">Send to:</p>
          <div className="flex flex-wrap gap-1">
            {targets.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTarget(t.id)}
                className={`text-[8px] px-2 py-1 rounded-lg transition-colors ${
                  (selectedTarget || 'village') === t.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {t.type === 'village' ? '🏘️' : '🏰'} {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Current garrison display */}
      {outpost.garrison_troops && Object.values(outpost.garrison_troops).some(v => (v || 0) > 0) && (
        <div className="bg-card/50 rounded-lg p-1.5">
          <p className="text-[8px] text-muted-foreground mb-0.5">Current Garrison:</p>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {(Object.entries(outpost.garrison_troops) as [TroopType, number][])
              .filter(([, v]) => (v || 0) > 0)
              .map(([type, count]) => (
                <span key={type} className="text-[9px] text-foreground">
                  {TROOP_INFO[type]?.emoji} {count}
                </span>
              ))
            }
          </div>
        </div>
      )}

      {/* Troop sliders */}
      {troopTypes.length === 0 ? (
        <p className="text-[9px] text-muted-foreground text-center py-2">
          {direction === 'to-outpost' ? 'No troops in village to send' : 'No troops garrisoned here'}
        </p>
      ) : (
        <div className="space-y-2">
          {troopTypes.map(type => {
            const max = (availableTroops[type] || 0);
            return (
              <div key={type} className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-foreground">{TROOP_INFO[type].emoji} {TROOP_INFO[type].name}</span>
                  <span className="text-[9px] text-muted-foreground">{sending[type] || 0}/{max}</span>
                </div>
                <Slider
                  min={0} max={max} step={1}
                  value={[sending[type] || 0]}
                  onValueChange={([v]) => setSending(prev => ({ ...prev, [type]: v }))}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Travel info */}
      {totalSending > 0 && (
        <div className="text-center space-y-0.5">
          <p className="text-[9px] text-foreground">
            Sending <span className="font-bold">{totalSending}</span> troops
          </p>
          <p className="text-[8px] text-muted-foreground">
            Travel time: <span className="font-bold text-primary">
              {Math.floor(travelInfo.seconds / 60)}:{(travelInfo.seconds % 60).toString().padStart(2, '0')}
            </span>
            {' '}({(travelInfo.distance / 1000).toFixed(1)}k distance)
          </p>
        </div>
      )}

      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={handleTransfer}
        disabled={totalSending === 0}
        className="w-full bg-primary text-primary-foreground font-display text-[11px] py-2 rounded-lg disabled:opacity-40 active:scale-95 transition-transform"
      >
        🔄 Transfer Troops
      </motion.button>
    </div>
  );
}
