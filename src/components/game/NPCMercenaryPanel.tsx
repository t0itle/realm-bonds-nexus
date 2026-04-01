import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '@/hooks/useGameState';
import type { Resources } from '@/lib/gameTypes';
import { NPCPlayerRelation, NPCTownState } from '@/hooks/useNPCState';
import { toast } from 'sonner';

interface MercenaryType {
  type: string;
  name: string;
  emoji: string;
  baseCost: number;
  attack: number;
  defense: number;
  requiredSentiment: number;
}

const MERCENARIES: MercenaryType[] = [
  { type: 'militia', name: 'Sellswords', emoji: '🗡️', baseCost: 30, attack: 5, defense: 3, requiredSentiment: -50 },
  { type: 'archer', name: 'Hired Bows', emoji: '🏹', baseCost: 50, attack: 8, defense: 2, requiredSentiment: 0 },
  { type: 'knight', name: 'Hedge Knights', emoji: '🛡️', baseCost: 100, attack: 10, defense: 12, requiredSentiment: 30 },
  { type: 'cavalry', name: 'Mounted Lancers', emoji: '🐴', baseCost: 140, attack: 14, defense: 6, requiredSentiment: 50 },
];

interface Props {
  realmId: string;
  realmName: string;
  realmPower: number;
  relation: NPCPlayerRelation | null;
  townState: NPCTownState | null;
  onHire: (troops: Record<string, number>, goldCost: number) => Promise<boolean>;
}

export default function NPCMercenaryPanel({ realmId, realmName, realmPower, relation, townState, onHire }: Props) {
  const { resources, addResources } = useGame();
  const [hiring, setHiring] = useState<Record<string, number>>({});
  const [isHiring, setIsHiring] = useState(false);

  const sentiment = relation?.sentiment ?? 0;
  const available = townState?.available_mercenaries ?? { militia: 20, archer: 10, knight: 5 };

  // Discount based on sentiment: -20% at max friendship, +20% if hostile
  const getDiscount = () => {
    if (sentiment >= 80) return 0.6;
    if (sentiment >= 50) return 0.75;
    if (sentiment >= 20) return 0.85;
    if (sentiment >= 0) return 1.0;
    if (sentiment >= -30) return 1.1;
    return 1.25;
  };

  const discount = getDiscount();
  const discountLabel = discount < 1 ? `${Math.round((1 - discount) * 100)}% off` : discount > 1 ? `${Math.round((discount - 1) * 100)}% markup` : '';

  const getCost = (merc: MercenaryType, count: number) => Math.floor(merc.baseCost * discount * count);

  const totalCost = Object.entries(hiring).reduce((sum, [type, count]) => {
    const merc = MERCENARIES.find(m => m.type === type);
    return sum + (merc ? getCost(merc, count) : 0);
  }, 0);

  const totalTroops = Object.values(hiring).reduce((s, v) => s + v, 0);

  const handleHire = async () => {
    if (totalCost <= 0 || totalTroops <= 0) return;
    if (resources.gold < totalCost) { toast.error('Not enough gold!'); return; }
    setIsHiring(true);
    const success = await onHire(hiring, totalCost);
    if (success) {
      addResources({ gold: -totalCost });
      toast.success(`Hired ${totalTroops} mercenaries from ${realmName}! (${totalCost} 💰)`);
      setHiring({});
    } else {
      toast.error('Failed to hire mercenaries.');
    }
    setIsHiring(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-display text-foreground">⚔️ Hire Mercenaries</span>
        {discountLabel && (
          <span className={`text-sm font-bold px-1.5 py-0.5 rounded-full ${
            discount < 1 ? 'bg-food/20 text-food' : 'bg-destructive/20 text-destructive'
          }`}>
            {discountLabel}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {MERCENARIES.map(merc => {
          const avail = (available[merc.type] as number) || 0;
          const locked = sentiment < merc.requiredSentiment;
          const count = hiring[merc.type] || 0;
          const cost = getCost(merc, Math.max(1, count));

          return (
            <div key={merc.type} className={`flex items-center gap-3 p-1.5 rounded-lg ${
              locked ? 'bg-muted/20 opacity-50' : 'bg-muted/40'
            }`}>
              <span className="text-base">{merc.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-bold">{merc.name}</p>
                <p className="text-sm text-muted-foreground">
                  {locked ? `Requires ${merc.requiredSentiment}+ sentiment` : `⚔️${merc.attack} 🛡️${merc.defense} · ${avail} avail · ${cost}💰/ea`}
                </p>
              </div>
              {!locked && avail > 0 && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setHiring(prev => ({ ...prev, [merc.type]: Math.max(0, (prev[merc.type] || 0) - 1) }))}
                    className="w-6 h-6 rounded bg-muted/60 text-foreground text-sm font-bold">−</button>
                  <span className="text-sm text-foreground w-6 text-center font-bold">{count}</span>
                  <button onClick={() => setHiring(prev => ({ ...prev, [merc.type]: Math.min(avail, (prev[merc.type] || 0) + 1) }))}
                    className="w-6 h-6 rounded bg-muted/60 text-foreground text-sm font-bold">+</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalTroops > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{totalTroops} troops · {totalCost} 💰</span>
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleHire} disabled={isHiring || resources.gold < totalCost}
            className="bg-primary/20 text-primary font-display text-sm px-4 py-2.5 rounded-lg disabled:opacity-50">
            {isHiring ? 'Hiring...' : '⚔️ Hire'}
          </motion.button>
        </div>
      )}

      <p className="text-sm text-muted-foreground italic">
        Mercenaries fight alongside your army for 10 minutes. Higher sentiment = better prices & elite units.
      </p>
    </div>
  );
}
