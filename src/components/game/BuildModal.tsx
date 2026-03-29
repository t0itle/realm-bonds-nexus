import { motion } from 'framer-motion';
import { useGame, BuildingType, BUILDING_INFO, getUpgradeCost } from '@/hooks/useGameState';
import { BUILDING_SPRITES } from './sprites';

const BUILDABLE: Exclude<BuildingType, 'empty' | 'townhall'>[] = [
  'farm', 'lumbermill', 'quarry', 'goldmine', 'barracks', 'wall', 'watchtower',
];

export default function BuildModal({ position, onClose }: { position: number; onClose: () => void }) {
  const { buildAt, canAfford } = useGame();

  const handleBuild = async (type: Exclude<BuildingType, 'empty'>) => {
    const success = await buildAt(position, type);
    if (success) onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="w-full game-panel border-t border-glow rounded-t-2xl p-4 pb-20 max-h-[70vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg text-foreground">Build Structure</h3>
          <button onClick={onClose} className="text-muted-foreground text-sm">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {BUILDABLE.map(type => {
            const info = BUILDING_INFO[type];
            const cost = getUpgradeCost(type, 0);
            const affordable = canAfford(cost);
            const sprite = BUILDING_SPRITES[type];

            return (
              <motion.button
                key={type}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleBuild(type)}
                disabled={!affordable}
                className={`game-panel p-3 rounded-xl text-left transition-all ${
                  affordable ? 'border-glow hover:glow-gold-sm' : 'opacity-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <img src={sprite} alt={info.name} className="w-10 h-10 object-contain" loading="lazy" />
                  <span className="font-display text-xs text-foreground">{info.name}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                  {Object.entries(cost).filter(([, v]) => v > 0).map(([key, val]) => (
                    <span key={key}>
                      {key === 'gold' ? '💰' : key === 'wood' ? '🪵' : key === 'stone' ? '🪨' : '🌾'}
                      {val}
                    </span>
                  ))}
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
