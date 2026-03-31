import { useState } from 'react';
import { useGame } from '@/hooks/useGameState';
import { motion, AnimatePresence } from 'framer-motion';
import ResourceIcon from './ResourceIcon';
import CaravanPanel from './CaravanPanel';

const RESOURCE_CONFIG = [
  { key: 'gold' as const, label: 'Gold', color: 'text-gold' },
  { key: 'wood' as const, label: 'Wood', color: 'text-amber-600' },
  { key: 'stone' as const, label: 'Stone', color: 'text-stone' },
  { key: 'food' as const, label: 'Food', color: 'text-food' },
];

export default function ResourceBar() {
  const { resources, totalProduction, steel, steelProduction, population, storageCapacity, myVillages, switchVillage, villageId, villageName, abandonSettlement } = useGame();
  const [showCaravan, setShowCaravan] = useState(false);
  const [showVillageSwitcher, setShowVillageSwitcher] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState<string | null>(null);
  const totalStored = Math.floor(resources.gold + resources.wood + resources.stone + resources.food);
  const storagePct = Math.min(100, (totalStored / (storageCapacity * 4)) * 100);
  const storageNearFull = storagePct > 85;

  const foodCritical = totalProduction.food < 0;
  const foodLow = resources.food < 50 && foodCritical;

  return (
    <>
      {/* Village Switcher */}
      {myVillages.length > 1 && (
        <div className="mx-2 mt-2">
          <button
            onClick={() => setShowVillageSwitcher(prev => !prev)}
            className="w-full game-panel px-2.5 py-1.5 border-glow rounded-xl flex items-center justify-between active:scale-[0.98] transition-transform"
          >
            <span className="font-display text-[11px] text-foreground flex items-center gap-1.5">
              {myVillages.find(v => v.id === villageId)?.settlement_type === 'city' ? '🏙️' : myVillages.find(v => v.id === villageId)?.settlement_type === 'town' ? '🏘️' : '🏠'} {villageName}
            </span>
            <span className="text-[9px] text-muted-foreground">
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
                <div className="game-panel rounded-b-xl border-t-0 px-1.5 py-1 space-y-0.5">
                  {myVillages.map(v => (
                    <button
                      key={v.id}
                      onClick={() => { switchVillage(v.id); setShowVillageSwitcher(false); }}
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-[10px] flex items-center gap-1.5 transition-colors ${
                        v.id === villageId
                          ? 'bg-primary/20 text-primary font-bold'
                          : 'text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      <span>{v.settlement_type === 'city' ? '🏙️' : v.settlement_type === 'town' ? '🏘️' : '🏠'}</span>
                      <span className="truncate">{v.name}</span>
                      {v.id === villageId && <span className="ml-auto text-[8px]">● Active</span>}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className={`game-panel px-2 py-1.5 mx-2 ${myVillages.length <= 1 ? 'mt-2' : 'mt-1'} border-glow space-y-1 ${foodLow ? 'border-destructive/60' : ''}`}>
        <div className="flex items-center justify-between gap-1">
          {RESOURCE_CONFIG.map(({ key, color }) => (
            <motion.div
              key={key}
              className="flex items-center gap-1 min-w-0"
              whileTap={{ scale: 0.95 }}
            >
              <ResourceIcon type={key} size={14} />
              <div className="flex flex-col min-w-0">
                <span className={`text-xs font-semibold tabular-nums ${color} truncate`}>
                  {Math.floor(resources[key]).toLocaleString()}
                </span>
                <span className={`text-[9px] ${key === 'food' && foodCritical ? 'text-destructive font-bold animate-pulse' : 'text-muted-foreground'}`}>
                  {totalProduction[key] >= 0 ? '+' : ''}{totalProduction[key]}/min
                </span>
              </div>
            </motion.div>
          ))}
        </div>
        {foodLow && (
          <div className="text-[9px] text-destructive font-bold text-center animate-pulse">
            ⚠️ Famine! Troops will desert if food reaches 0!
          </div>
        )}
        <div className="flex items-center justify-between text-[9px] border-t border-border/50 pt-1">
          <span className="text-muted-foreground flex items-center gap-0.5">
            <ResourceIcon type="steel" size={10} /> Steel: <strong className="text-foreground">{steel}</strong>{steelProduction > 0 && <span className="text-primary"> +{steelProduction}/min</span>}
          </span>
          <button
            onClick={() => setShowCaravan(prev => !prev)}
            className={`flex items-center gap-0.5 active:scale-95 transition-transform ${storageNearFull ? 'text-destructive font-bold' : 'text-muted-foreground'}`}
          >
            🏪 {Math.floor(storagePct)}%
          </button>
          <span className="text-muted-foreground flex items-center gap-0.5">
            <ResourceIcon type="population" size={10} /> {population.current}/{population.max}
          </span>
        </div>
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
