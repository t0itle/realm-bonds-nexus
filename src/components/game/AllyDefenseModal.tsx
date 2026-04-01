import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useGame } from '@/hooks/useGameState';
import { TROOP_INFO, calcMarchTime } from '@/lib/gameConstants';
import type { TroopType, Army } from '@/lib/gameTypes';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Slider } from '@/components/ui/slider';
import TroopIcon from './TroopIcon';

interface AllyDefenseModalProps {
  open: boolean;
  onClose: () => void;
  attackerName: string;
  allyName: string;
  allyVillageId?: string;
  targetX: number;
  targetY: number;
  attackEta: string; // ISO timestamp
}

export default function AllyDefenseModal({
  open, onClose, attackerName, allyName, allyVillageId, targetX, targetY, attackEta,
}: AllyDefenseModalProps) {
  const { army, deployTroops } = useGame();
  const { user } = useAuth();
  const [sending, setSending] = useState<Partial<Record<TroopType, number>>>({});

  const troopTypes = (Object.keys(TROOP_INFO) as TroopType[]).filter(t => army[t] > 0);

  // Calculate travel time to ally
  const travelTime = useMemo(() => {
    // Rough distance calc — we need village position
    // We use the target coordinates passed in
    return null; // Will be calculated client-side if we have our position
  }, [targetX, targetY]);

  const attackArrival = new Date(attackEta).getTime();
  const now = Date.now();
  const attackRemaining = Math.max(0, Math.floor((attackArrival - now) / 1000));

  const totalSending = Object.values(sending).reduce((s, v) => s + (v || 0), 0);

  const handleSend = async () => {
    if (totalSending === 0) {
      toast.error('Select troops to send!');
      return;
    }

    // Deploy troops (removes from village)
    deployTroops(sending as Partial<Army>);

    // Create a reinforcement march
    // Get our village position
    const { data: myVillage } = await supabase
      .from('villages')
      .select('map_x, map_y, name')
      .eq('user_id', user?.id)
      .single();

    if (!myVillage) {
      toast.error('Could not find your village');
      return;
    }

    const dist = Math.sqrt(
      Math.pow(targetX - myVillage.map_x, 2) + Math.pow(targetY - myVillage.map_y, 2)
    );
    const marchArmy: Army = {
      militia: sending.militia || 0, archer: sending.archer || 0, knight: sending.knight || 0,
      cavalry: sending.cavalry || 0, siege: sending.siege || 0, scout: sending.scout || 0,
    };
    const travelSec = calcMarchTime(dist, marchArmy);
    const arrivalTime = new Date(Date.now() + travelSec * 1000).toISOString();

    // Check if reinforcements can arrive in time
    const canArrive = new Date(arrivalTime).getTime() < attackArrival;

    // Insert reinforcement march
    await supabase.from('active_marches').insert({
      user_id: user?.id,
      player_name: myVillage.name,
      start_x: myVillage.map_x,
      start_y: myVillage.map_y,
      target_x: targetX,
      target_y: targetY,
      target_name: `Reinforce ${allyName}`,
      arrives_at: arrivalTime,
      march_type: 'reinforce',
      sent_army: sending,
      target_user_id: null, // Reinforcements, not attacks
    } as any);

    // When reinforcements arrive, store them in active_reinforcements
    // This is handled by a setTimeout or the march processing logic
    if (allyVillageId) {
      setTimeout(async () => {
        await supabase.from('active_reinforcements').insert({
          owner_id: user?.id,
          host_village_id: allyVillageId,
          troops: sending,
          expires_at: new Date(Date.now() + travelSec * 1000 + 3600000).toISOString(), // 1 hour after arrival
        } as any);
      }, travelSec * 1000);
    }

    toast.success(
      canArrive
        ? `🛡️ Reinforcements sent to ${allyName}! ETA: ${travelSec}s — will arrive in time!`
        : `🛡️ Reinforcements sent to ${allyName}! ETA: ${travelSec}s — may not arrive before the attack!`
    );
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="game-panel border-primary/30 max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-foreground flex items-center gap-2">
            🛡️ Reinforce {allyName}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            <span className="text-destructive font-bold">{attackerName}</span> is attacking your ally!
            Attack arrives in <span className="font-bold text-destructive">{Math.floor(attackRemaining / 60)}:{(attackRemaining % 60).toString().padStart(2, '0')}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {troopTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">You have no troops to send!</p>
          ) : (
            troopTypes.map(type => (
              <div key={type} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground flex items-center gap-1">
                    <TroopIcon type={type} size={14} /> {TROOP_INFO[type].name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {sending[type] || 0} / {army[type]}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={army[type]}
                  step={1}
                  value={[sending[type] || 0]}
                  onValueChange={([v]) => setSending(prev => ({ ...prev, [type]: v }))}
                />
              </div>
            ))
          )}

          {totalSending > 0 && (
            <div className="text-center text-xs text-muted-foreground">
              Sending <span className="font-bold text-foreground">{totalSending}</span> troops
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-muted text-muted-foreground font-display text-sm"
            >
              Cancel
            </button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSend}
              disabled={totalSending === 0}
              className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-display text-sm disabled:opacity-50"
            >
              🛡️ Send Reinforcements
            </motion.button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
