import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface TaxPanelProps {
  allianceId: string;
  isLeader: boolean;
}

interface AllianceTreasury {
  tax_rate: number;
  treasury_gold: number;
  treasury_wood: number;
  treasury_stone: number;
  treasury_food: number;
}

export default function GuildTaxPanel({ allianceId, isLeader }: TaxPanelProps) {
  const { user } = useAuth();
  const [treasury, setTreasury] = useState<AllianceTreasury | null>(null);
  const [taxRate, setTaxRate] = useState(0);

  useEffect(() => {
    loadTreasury();
  }, [allianceId]);

  const loadTreasury = async () => {
    const { data } = await supabase
      .from('alliances')
      .select('tax_rate, treasury_gold, treasury_wood, treasury_stone, treasury_food')
      .eq('id', allianceId)
      .single();
    if (data) {
      setTreasury(data);
      setTaxRate(data.tax_rate);
    }
  };

  const updateTaxRate = async () => {
    if (!isLeader) return;
    const rate = Math.max(0, Math.min(50, taxRate));
    const { error } = await supabase
      .from('alliances')
      .update({ tax_rate: rate })
      .eq('id', allianceId);
    if (error) { toast.error('Failed to update tax rate'); return; }
    toast.success(`Tax rate set to ${rate}%`);
    loadTreasury();
  };

  const withdrawFromTreasury = async (resource: string, amount: number) => {
    if (!isLeader || !treasury) return;
    const key = `treasury_${resource}` as keyof AllianceTreasury;
    if ((treasury[key] as number) < amount) { toast.error('Not enough in treasury'); return; }

    // Withdraw from alliance treasury
    const { error } = await supabase
      .from('alliances')
      .update({ [key]: (treasury[key] as number) - amount })
      .eq('id', allianceId);
    if (error) { toast.error('Withdrawal failed'); return; }

    // Add to player village
    const { data: village } = await supabase
      .from('villages')
      .select('*')
      .eq('user_id', user!.id)
      .single();
    if (village) {
      await supabase.from('villages').update({
        [resource]: Number(village[resource as keyof typeof village]) + amount,
      }).eq('id', village.id);
    }
    toast.success(`Withdrew ${amount} ${resource} from treasury`);
    loadTreasury();
  };

  if (!treasury) return null;

  const resources = [
    { key: 'gold', icon: '💰', value: treasury.treasury_gold },
    { key: 'wood', icon: '🪵', value: treasury.treasury_wood },
    { key: 'stone', icon: '🪨', value: treasury.treasury_stone },
    { key: 'food', icon: '🌾', value: treasury.treasury_food },
  ];

  return (
    <div className="game-panel border-glow rounded-xl p-3 space-y-3">
      <h3 className="font-display text-sm text-foreground">🏦 Guild Treasury</h3>

      {/* Tax Rate */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Tax Rate</span>
        {isLeader ? (
          <div className="flex items-center gap-2">
            <input type="number" min={0} max={50} value={taxRate}
              onChange={e => setTaxRate(Number(e.target.value))}
              className="w-14 bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground text-center" />
            <span className="text-xs text-muted-foreground">%</span>
            <motion.button whileTap={{ scale: 0.95 }} onClick={updateTaxRate}
              className="bg-primary/20 text-primary text-[10px] px-2 py-1 rounded">Set</motion.button>
          </div>
        ) : (
          <span className="text-sm font-display text-primary">{treasury.tax_rate}%</span>
        )}
      </div>

      {/* Treasury Resources */}
      <div className="grid grid-cols-2 gap-2">
        {resources.map(r => (
          <div key={r.key} className="bg-secondary/50 rounded-lg p-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{r.icon}</span>
              <span className="text-xs text-foreground font-bold">{r.value.toLocaleString()}</span>
            </div>
            {isLeader && r.value > 0 && (
              <motion.button whileTap={{ scale: 0.9 }}
                onClick={() => withdrawFromTreasury(r.key, Math.min(100, r.value))}
                className="text-[8px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                -100
              </motion.button>
            )}
          </div>
        ))}
      </div>

      <p className="text-[9px] text-muted-foreground text-center">
        {isLeader ? 'Members contribute taxes on resource gains' : `${treasury.tax_rate}% of your gains goes to the guild`}
      </p>
    </div>
  );
}
