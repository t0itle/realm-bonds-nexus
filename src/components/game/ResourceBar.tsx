import { useGame } from '@/hooks/useGameState';
import { motion } from 'framer-motion';

const RESOURCE_CONFIG = [
  { key: 'gold' as const, icon: '💰', label: 'Gold', color: 'text-gold' },
  { key: 'wood' as const, icon: '🪵', label: 'Wood', color: 'text-amber-600' },
  { key: 'stone' as const, icon: '🪨', label: 'Stone', color: 'text-stone' },
  { key: 'food' as const, icon: '🌾', label: 'Food', color: 'text-food' },
];

export default function ResourceBar() {
  const { resources, totalProduction, steel, population } = useGame();

  return (
    <div className="game-panel px-2 py-1.5 mx-2 mt-2 border-glow space-y-1">
      <div className="flex items-center justify-between gap-1">
        {RESOURCE_CONFIG.map(({ key, icon, color }) => (
          <motion.div
            key={key}
            className="flex items-center gap-1 min-w-0"
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-sm">{icon}</span>
            <div className="flex flex-col min-w-0">
              <span className={`text-xs font-semibold tabular-nums ${color} truncate`}>
                {resources[key].toLocaleString()}
              </span>
              <span className="text-[9px] text-muted-foreground">
                +{totalProduction[key]}/min
              </span>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="flex items-center justify-between text-[9px] border-t border-border/50 pt-1">
        <span className="text-muted-foreground">⚙️ Steel: <strong className="text-foreground">{steel}</strong></span>
        <span className="text-muted-foreground">👥 {population.current}/{population.max}</span>
      </div>
    </div>
  );
}
