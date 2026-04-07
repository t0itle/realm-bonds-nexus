import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '@/hooks/useGameState';
import { getSubLevelUpgrade, SETTLEMENT_UPGRADES } from '@/lib/gameConstants';
import { SETTLEMENT_TIER_NAMES, SETTLEMENT_TIER_MAX_SUB } from '@/lib/gameTypes';
import type { SettlementTier } from '@/lib/gameTypes';
import ResourceIcon, { getResourceType } from './ResourceIcon';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export default function SettlementUpgradePanel() {
  const { resources, steel, canAfford, canAffordSteel, villageId, settlementType } = useGame();
  const { user } = useAuth();
  const [upgrading, setUpgrading] = useState(false);

  // Get current tier & sub-level from DB
  const [tierData, setTierData] = useState<{ tier: SettlementTier; subLevel: number } | null>(null);

  // Fetch on mount
  useState(() => {
    if (!villageId) return;
    supabase.from('villages').select('settlement_tier, settlement_sub_level').eq('id', villageId).single()
      .then(({ data }) => {
        if (data) setTierData({ tier: data.settlement_tier as SettlementTier, subLevel: data.settlement_sub_level });
      });
  });

  if (!tierData) return null;

  const { tier, subLevel } = tierData;
  const maxSub = SETTLEMENT_TIER_MAX_SUB[tier];
  const tierName = SETTLEMENT_TIER_NAMES[tier];
  const nextUpgrade = getSubLevelUpgrade(tier, subLevel + 1);
  const atMaxSub = subLevel >= maxSub;
  const tierUpgradeInfo = SETTLEMENT_UPGRADES[settlementType];

  const canUpgradeSub = !atMaxSub && canAfford(nextUpgrade.cost) && (nextUpgrade.steelCost <= 0 || canAffordSteel(nextUpgrade.steelCost));

  const doSubLevelUpgrade = async () => {
    if (!villageId || !user || upgrading || !canUpgradeSub) return;
    setUpgrading(true);

    const newResources = {
      gold: resources.gold - nextUpgrade.cost.gold,
      wood: resources.wood - nextUpgrade.cost.wood,
      stone: resources.stone - nextUpgrade.cost.stone,
      food: resources.food - nextUpgrade.cost.food,
    };

    await supabase.from('villages').update({
      ...newResources,
      steel: steel - nextUpgrade.steelCost,
      settlement_sub_level: subLevel + 1,
    } as any).eq('id', villageId);

    setTierData({ tier, subLevel: subLevel + 1 });
    toast.success(`🏗️ ${tierName} upgraded to sub-level ${subLevel + 1}! +${nextUpgrade.bonuses?.productionBonus || 0}% production`);
    setUpgrading(false);
  };

  return (
    <div className="mx-3 mb-2 game-panel border border-border/30 rounded-xl p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-display text-xs text-foreground">{tierName} Progress</h4>
          <p className="text-[9px] text-muted-foreground">Sub-level {subLevel} / {maxSub}</p>
        </div>
        <span className="text-lg">{tier === 1 ? '🏕️' : tier === 2 ? '🏘️' : tier === 3 ? '🏰' : '🏯'}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(subLevel / maxSub) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Current bonuses */}
      <div className="flex flex-wrap gap-1.5 text-[9px] text-muted-foreground">
        <span>📈 +{subLevel * 3}% prod</span>
        <span>📦 +{subLevel * 50 * tier} storage</span>
        <span>👥 +{subLevel * tier} pop</span>
        {tier >= 2 && <span>🛡️ +{subLevel * 2} def</span>}
      </div>

      {/* Next upgrade */}
      {!atMaxSub ? (
        <div className="space-y-1.5">
          <p className="text-[9px] text-muted-foreground font-display">Next: Sub-level {subLevel + 1}</p>
          <div className="flex flex-wrap gap-1.5 text-[9px]">
            {Object.entries(nextUpgrade.cost).filter(([, v]) => v > 0).map(([key, val]) => {
              const rType = getResourceType(key);
              const enough = key === 'gold' ? resources.gold >= val : key === 'wood' ? resources.wood >= val : key === 'stone' ? resources.stone >= val : resources.food >= val;
              return (
                <span key={key} className={`flex items-center gap-0.5 ${enough ? 'text-foreground' : 'text-destructive'}`}>
                  {rType ? <ResourceIcon type={rType} size={10} /> : key}{val}
                </span>
              );
            })}
            {nextUpgrade.steelCost > 0 && (
              <span className={`flex items-center gap-0.5 ${steel >= nextUpgrade.steelCost ? 'text-foreground' : 'text-destructive'}`}>
                <ResourceIcon type="steel" size={10} />{nextUpgrade.steelCost}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1 text-[8px] text-primary/80">
            <span>+{nextUpgrade.bonuses?.productionBonus || 0}% prod</span>
            <span>+{nextUpgrade.bonuses?.storageBonus || 0} storage</span>
            <span>+{nextUpgrade.bonuses?.populationBonus || 0} pop</span>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={doSubLevelUpgrade}
            disabled={!canUpgradeSub || upgrading}
            className={`w-full py-2 rounded-lg font-display text-[10px] font-bold transition-all ${
              canUpgradeSub ? 'bg-primary text-primary-foreground glow-gold-sm' : 'bg-muted text-muted-foreground'
            }`}
          >
            {upgrading ? '⏳ Upgrading...' : canUpgradeSub ? `⬆️ Upgrade to ${subLevel + 1}` : 'Need Resources'}
          </motion.button>
        </div>
      ) : (
        <div className="text-center space-y-1">
          <p className="text-[10px] text-primary font-display animate-pulse">✦ Max sub-level reached! ✦</p>
          {tierUpgradeInfo && (
            <p className="text-[9px] text-muted-foreground">Ready to upgrade to {tierUpgradeInfo.label}!</p>
          )}
        </div>
      )}
    </div>
  );
}
