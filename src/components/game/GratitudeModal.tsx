import { useState } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { useGame } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GratitudeModalProps {
  open: boolean;
  onClose: () => void;
  allyUserId: string;
  allyName: string;
}

const RESOURCE_INFO = [
  { key: 'gold', icon: '💰', label: 'Gold' },
  { key: 'wood', icon: '🪵', label: 'Wood' },
  { key: 'stone', icon: '🪨', label: 'Stone' },
  { key: 'food', icon: '🌾', label: 'Food' },
] as const;

export default function GratitudeModal({ open, onClose, allyUserId, allyName }: GratitudeModalProps) {
  const { resources, addResources } = useGame();
  const { user } = useAuth();
  const [amounts, setAmounts] = useState<Record<string, number>>({ gold: 0, wood: 0, stone: 0, food: 0 });

  const totalGiving = Object.values(amounts).reduce((s, v) => s + v, 0);

  const handleSend = async () => {
    if (totalGiving === 0) {
      toast.error('Select some resources to send!');
      return;
    }

    // Deduct from sender
    addResources({
      gold: -amounts.gold,
      wood: -amounts.wood,
      stone: -amounts.stone,
      food: -amounts.food,
    });

    // Add to receiver's village
    const { data: allyVillage } = await supabase
      .from('villages')
      .select('id, gold, wood, stone, food')
      .eq('user_id', allyUserId)
      .single();

    if (allyVillage) {
      await supabase.from('villages').update({
        gold: Number(allyVillage.gold) + amounts.gold,
        wood: Number(allyVillage.wood) + amounts.wood,
        stone: Number(allyVillage.stone) + amounts.stone,
        food: Number(allyVillage.food) + amounts.food,
      } as any).eq('id', allyVillage.id);
    }

    // Check if in same alliance for logging
    const { data: myMembership } = await supabase
      .from('alliance_members')
      .select('alliance_id')
      .eq('user_id', user?.id)
      .maybeSingle();

    if (myMembership) {
      await supabase.from('alliance_resource_transfers').insert({
        alliance_id: myMembership.alliance_id,
        sender_id: user?.id,
        receiver_id: allyUserId,
        gold: amounts.gold,
        wood: amounts.wood,
        stone: amounts.stone,
        food: amounts.food,
        message: '🙏 Thank you for defending my village!',
      } as any);
    }

    // Send a thank-you message
    await supabase.from('player_messages').insert({
      sender_id: user?.id,
      receiver_id: allyUserId,
      content: `🙏 Thank you for defending my village! I've sent you ${amounts.gold > 0 ? `${amounts.gold}💰 ` : ''}${amounts.wood > 0 ? `${amounts.wood}🪵 ` : ''}${amounts.stone > 0 ? `${amounts.stone}🪨 ` : ''}${amounts.food > 0 ? `${amounts.food}🌾` : ''} as gratitude.`,
    } as any);

    toast.success(`🎁 Sent gratitude gift to ${allyName}!`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="game-panel border-primary/30 max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-foreground flex items-center gap-3">
            🙏 Thank Your Ally
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            <span className="font-bold text-primary">{allyName}</span> helped defend your village!
            Send them a thank-you gift?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {RESOURCE_INFO.map(({ key, icon, label }) => {
            const max = Math.max(0, Math.floor(resources[key as keyof typeof resources] as number));
            if (max === 0) return null;
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{icon} {label}</span>
                  <span className="text-sm text-muted-foreground">
                    {amounts[key]} / {max}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={max}
                  step={1}
                  value={[amounts[key]]}
                  onValueChange={([v]) => setAmounts(prev => ({ ...prev, [key]: v }))}
                />
              </div>
            );
          })}

          {totalGiving > 0 && (
            <div className="text-center text-sm text-primary font-display">
              Sending: {RESOURCE_INFO.filter(r => amounts[r.key] > 0).map(r => `${amounts[r.key]}${r.icon}`).join(' ')}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-lg bg-muted text-muted-foreground font-display text-sm"
            >
              Skip
            </button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSend}
              disabled={totalGiving === 0}
              className="flex-1 py-3 rounded-lg bg-primary text-primary-foreground font-display text-sm disabled:opacity-50"
            >
              🎁 Send Thanks
            </motion.button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
