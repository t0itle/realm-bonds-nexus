import { useState } from 'react';
import happinessSprite from '@/assets/sprites/happiness.png';
import { useGame } from '@/hooks/useGameState';
import { motion, AnimatePresence } from 'framer-motion';
import ResourceIcon from './ResourceIcon';
import CaravanPanel from './CaravanPanel';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { woodPlankStyle } from './uiSprites';

const RESOURCE_CONFIG = [
  { key: 'gold' as const, label: 'Gold', color: 'text-gold' },
  { key: 'wood' as const, label: 'Wood', color: 'text-amber-600' },
  { key: 'stone' as const, label: 'Stone', color: 'text-stone' },
  { key: 'food' as const, label: 'Food', color: 'text-food' },
];

function BudgetTooltip({ lines, label, net }: { lines: { icon: string; label: string; value: number }[]; label: string; net: number }) {
  const visible = lines.filter(l => l.value !== 0);
  return (
    <div className="space-y-0.5 min-w-[140px]">
      <div className="font-bold text-[11px] text-foreground mb-1">{label} Budget</div>
      {visible.length === 0 ? (
        <div className="text-sm text-muted-foreground">No production</div>
      ) : (
        <>
          {visible.map((l, i) => (
            <div key={i} className="flex justify-between gap-3 text-sm tabular-nums">
              <span className="text-muted-foreground">{l.icon} {l.label}</span>
              <span className={l.value > 0 ? 'text-emerald-500' : 'text-destructive'}>
                {l.value > 0 ? '+' : ''}{l.value}/min
              </span>
            </div>
          ))}
          <div className="border-t border-border/50 mt-1 pt-1 flex justify-between text-sm tabular-nums font-bold">
            <span className="text-foreground">Net</span>
            <span className={net > 0 ? 'text-emerald-500' : net < 0 ? 'text-destructive' : 'text-muted-foreground'}>
              {net > 0 ? '+' : ''}{net}/min
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export default function ResourceBar() {
  const {
    resources, totalProduction, steel, steelProduction, population, storageCapacity,
    myVillages, switchVillage, villageId, villageName, abandonSettlement,
    grossProduction, armyUpkeep, popFoodCost, popTaxIncome,
  } = useGame();
  const [showCaravan, setShowCaravan] = useState(false);
  const [showVillageSwitcher, setShowVillageSwitcher] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState<string | null>(null);
  const totalStored = Math.floor(resources.gold + resources.wood + resources.stone + resources.food);
  const storagePct = Math.min(100, (totalStored / (storageCapacity * 4)) * 100);
  const storageNearFull = storagePct > 85;

  const foodDeclining = totalProduction.food < 0;
  const foodLow = foodDeclining && resources.food < 200;
  const foodCritical = foodDeclining && resources.food < 50;

  const upkeep = armyUpkeep();

  // Compute alliance tax amounts (difference between gross and what's kept)
  const allianceTax = {
    gold: grossProduction.gold - Math.floor(grossProduction.gold * (1 - ((grossProduction.gold > 0 && totalProduction.gold !== grossProduction.gold - upkeep.gold + popTaxIncome) ? ((grossProduction.gold - (totalProduction.gold + upkeep.gold - popTaxIncome)) / grossProduction.gold) : 0))),
    wood: grossProduction.wood - Math.floor(grossProduction.wood * (1 - ((grossProduction.wood > 0 && totalProduction.wood !== grossProduction.wood) ? ((grossProduction.wood - totalProduction.wood) / grossProduction.wood) : 0))),
    stone: grossProduction.stone - Math.floor(grossProduction.stone * (1 - ((grossProduction.stone > 0 && totalProduction.stone !== grossProduction.stone) ? ((grossProduction.stone - totalProduction.stone) / grossProduction.stone) : 0))),
    food: grossProduction.food - Math.floor(grossProduction.food * (1 - ((grossProduction.food > 0 && totalProduction.food !== grossProduction.food - upkeep.food - popFoodCost) ? ((grossProduction.food - (totalProduction.food + upkeep.food + popFoodCost)) / grossProduction.food) : 0))),
  };

  function getBreakdown(key: 'gold' | 'wood' | 'stone' | 'food'): { icon: string; label: string; value: number }[] {
    const lines: { icon: string; label: string; value: number }[] = [];
    if (grossProduction[key] !== 0) {
      const icons = { gold: '🪙', wood: '🪵', stone: '⛏️', food: '🌾' };
      const labels = { gold: 'Buildings', wood: 'Buildings', stone: 'Buildings', food: 'Farms/Buildings' };
      lines.push({ icon: icons[key], label: labels[key], value: grossProduction[key] });
    }
    if (allianceTax[key] > 0) {
      lines.push({ icon: '🏛️', label: 'Alliance Tax', value: -allianceTax[key] });
    }
    if (key === 'gold' && popTaxIncome > 0) {
      lines.push({ icon: '👥', label: 'Pop Tax', value: popTaxIncome });
    }
    if (key === 'gold' && upkeep.gold > 0) {
      lines.push({ icon: '⚔️', label: 'Army Upkeep', value: -upkeep.gold });
    }
    if (key === 'food' && upkeep.food > 0) {
      lines.push({ icon: '⚔️', label: 'Army Upkeep', value: -upkeep.food });
    }
    if (key === 'food' && popFoodCost > 0) {
      lines.push({ icon: '🍞', label: 'Pop Rations', value: -popFoodCost });
    }
    return lines;
  }

  return (
    <>
      {/* Village Switcher */}
      {myVillages.length > 1 && (
        <div className="mx-2 mt-2">
          <button
            onClick={() => setShowVillageSwitcher(prev => !prev)}
            className="w-full game-panel px-2.5 py-2.5 border-glow rounded-xl flex items-center justify-between active:scale-[0.98] transition-transform"
          >
            <span className="font-display text-[11px] text-foreground flex items-center gap-2.5">
              {myVillages.find(v => v.id === villageId)?.settlement_type === 'city' ? '🏙️' : myVillages.find(v => v.id === villageId)?.settlement_type === 'town' ? '🏘️' : '🏠'} {villageName}
            </span>
            <span className="text-sm text-muted-foreground">
              {myVillages.length} settlements • Lv.{myVillages.length} ▾
            </span>
          </button>
          <AnimatePresence>
            {showVillageSwitcher && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="game-panel rounded-b-xl border-t-0 px-1.5 py-2 space-y-0.5">
                  {myVillages.map(v => (
                    <div key={v.id} className="flex items-center gap-0.5">
                      <button
                        onClick={() => { switchVillage(v.id); setShowVillageSwitcher(false); }}
                        className={`flex-1 text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-2.5 transition-colors ${
                          v.id === villageId
                            ? 'bg-primary/20 text-primary font-bold'
                            : 'text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        <span>{v.settlement_type === 'city' ? '🏙️' : v.settlement_type === 'town' ? '🏘️' : '🏠'}</span>
                        <span className="truncate">{v.name}</span>
                        {v.id === villageId && <span className="ml-auto text-sm">● Active</span>}
                      </button>
                      {myVillages.length > 1 && v.id !== villageId && (
                        confirmAbandon === v.id ? (
                          <div className="flex gap-0.5">
                            <button
                              onClick={async () => { await abandonSettlement(v.id); setConfirmAbandon(null); }}
                              className="text-sm px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground font-bold"
                            >Yes</button>
                            <button
                              onClick={() => setConfirmAbandon(null)}
                              className="text-sm px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                            >No</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmAbandon(v.id)}
                            className="text-sm px-1 py-0.5 rounded text-destructive hover:bg-destructive/10"
                            title="Abandon settlement"
                          >🗑️</button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div
        className={`game-panel px-3 py-2.5 mx-2 ${myVillages.length <= 1 ? 'mt-2' : 'mt-1'} border-glow space-y-1 ${foodCritical ? 'border-destructive/60' : foodLow ? 'border-destructive/40' : ''} rounded-xl overflow-hidden text-shadow-wood`}
        style={woodPlankStyle}
      >
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center justify-between gap-2">
            {RESOURCE_CONFIG.map(({ key, label, color }) => {
              const isFood = key === 'food';
              const foodValueColor = isFood && foodCritical
                ? 'text-destructive font-bold animate-pulse'
                : isFood && foodLow
                  ? 'text-destructive font-bold'
                  : isFood && foodDeclining
                    ? 'text-amber-500'
                    : color;
              const prodColor = isFood && foodCritical
                ? 'text-destructive font-bold animate-pulse'
                : isFood && foodLow
                  ? 'text-destructive font-bold animate-pulse'
                  : isFood && foodDeclining
                    ? 'text-amber-500 font-semibold'
                    : 'text-foreground/70';
              const breakdown = getBreakdown(key);
              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <motion.div
                      className="flex items-center gap-2 min-w-0 cursor-default"
                      whileTap={{ scale: 0.95 }}
                    >
                      <ResourceIcon type={key} size={14} />
                      <div className="flex flex-col min-w-0">
                        <span className={`text-xs font-semibold tabular-nums ${foodValueColor} truncate`}>
                          {Math.floor(resources[key]).toLocaleString()}{isFood && foodDeclining && ' ▼'}
                        </span>
                        <span className={`text-sm ${prodColor}`}>
                          {totalProduction[key] >= 0 ? '+' : ''}{totalProduction[key]}/min
                        </span>
                      </div>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-sm max-w-[220px]">
                    <BudgetTooltip lines={breakdown} label={label} net={totalProduction[key]} />
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
        {foodCritical && (
          <div className="text-sm text-destructive font-bold text-center animate-pulse">
            ⚠️ Famine! Troops will desert if food reaches 0!
          </div>
        )}
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center justify-between text-sm border-t border-border/50 pt-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-foreground/80 flex items-center gap-0.5 cursor-default">
                   <ResourceIcon type="steel" size={10} /> Steel: <strong className="text-foreground">{steel}</strong>{steelProduction > 0 && <span className="text-primary"> +{steelProduction}/min</span>}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-sm max-w-[200px]">
                <BudgetTooltip
                  lines={[
                    ...(steelProduction > 0 ? [{ icon: '⚒️', label: 'Production', value: steelProduction }] : []),
                  ]}
                  label="Steel"
                  net={steelProduction}
                />
              </TooltipContent>
            </Tooltip>
            <button
              onClick={() => setShowCaravan(prev => !prev)}
              className={`flex items-center gap-0.5 active:scale-95 transition-transform ${storageNearFull ? 'text-destructive font-bold' : 'text-muted-foreground'}`}
            >
              🏪 {Math.floor(storagePct)}%
            </button>
            <span className="text-muted-foreground flex items-center gap-0.5">
              <ResourceIcon type="population" size={10} /> {population.current}/{population.max}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-0.5 cursor-default">
                  <img src={happinessSprite} alt="Happiness" width={14} height={14} className="pixelated" />
                  <strong className={`tabular-nums ${population.happiness >= 66 ? 'text-emerald-500' : population.happiness >= 33 ? 'text-amber-500' : 'text-destructive'}`}>
                    {population.happiness}
                  </strong>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-sm max-w-[200px]">
                Happiness: {population.happiness}/100 — Affects population growth and rebellion risk. Build Temples and adjust Rations to improve it.
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
      <AnimatePresence>
        {showCaravan && (
          <div className="mx-2 mt-1">
            <CaravanPanel onClose={() => setShowCaravan(false)} />
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
