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
  const { resources, totalProduction, steel, steelProduction, population, storageCapacity } = useGame();
  const totalStored = Math.floor(resources.gold + resources.wood + resources.stone + resources.food);
  const storagePct = Math.min(100, (totalStored / (storageCapacity * 4)) * 100); // 4 resource types
  const storageNearFull = storagePct > 85;

  const foodCritical = totalProduction.food < 0;
  const foodLow = resources.food < 50 && foodCritical;

  return (
    <div className={`game-panel px-2 py-1.5 mx-2 mt-2 border-glow space-y-1 ${foodLow ? 'border-destructive/60' : ''}`}>
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
        <span className={`flex items-center gap-0.5 ${storageNearFull ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
          🏪 {Math.floor(storagePct)}%
        </span>
        <span className="text-muted-foreground flex items-center gap-0.5">
          <ResourceIcon type="population" size={10} /> {population.current}/{population.max}
        </span>
      </div>
    </div>
  );
}
