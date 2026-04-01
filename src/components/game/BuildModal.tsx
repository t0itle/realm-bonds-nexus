import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '@/hooks/useGameState';
import { BUILDING_INFO, getUpgradeCost } from '@/lib/gameConstants';
import type { BuildingType } from '@/lib/gameTypes';
import { useTroopSkins } from '@/hooks/useTroopSkins';
import ResourceIcon, { getResourceType } from './ResourceIcon';

const BUILDABLE: Exclude<BuildingType, 'empty' | 'townhall'>[] = [
  'house', 'farm', 'lumbermill', 'quarry', 'goldmine', 'barracks', 'wall', 'watchtower', 'temple', 'apothecary', 'warehouse', 'spyguild',
];

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
}

export default function BuildModal({ position, onClose }: { position: number; onClose: () => void }) {
  const { buildAt, canAfford, canAffordSteel, resources, steel, getBuildTime } = useGame();
  const { getBuildingSprite } = useTroopSkins();
  const [steelPopup, setSteelPopup] = useState(false);

  const handleBuild = async (type: Exclude<BuildingType, 'empty'>) => {
    const cost = getUpgradeCost(type, 0);
    if (cost.steel > 0 && !canAffordSteel(cost.steel)) {
      setSteelPopup(true);
      return;
    }
    const success = await buildAt(position, type);
    if (success) onClose();
  };

  return (
    <>
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

          <div className="grid grid-cols-2 gap-3">
            {BUILDABLE.map(type => {
              const info = BUILDING_INFO[type];
              const cost = getUpgradeCost(type, 0);
              const affordable = canAfford(cost) && (cost.steel <= 0 || canAffordSteel(cost.steel));
              const sprite = getBuildingSprite(type);
              const buildTime = getBuildTime(type, 0);
              const needsSteel = cost.steel > 0 && !canAffordSteel(cost.steel);

              const resourceCheck: Record<string, boolean> = {
                gold: resources.gold >= cost.gold,
                wood: resources.wood >= cost.wood,
                stone: resources.stone >= cost.stone,
                food: resources.food >= cost.food,
                steel: steel >= cost.steel,
              };

              return (
                <motion.button
                  key={type}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleBuild(type)}
                  disabled={!affordable && !needsSteel}
                  className={`game-panel p-3 rounded-xl text-left transition-all ${
                    affordable ? 'border-glow hover:glow-gold-sm' : 'opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <img src={sprite} alt={info.name} className="w-10 h-10 object-contain" loading="lazy" />
                    <span className="font-display text-sm text-foreground">{info.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-2.5 text-sm text-muted-foreground">
                    {Object.entries(cost).filter(([, v]) => v > 0).map(([key, val]) => {
                      const rType = getResourceType(key);
                      const canAffordThis = resourceCheck[key] !== false;
                      return (
                        <span key={key} className={`flex items-center gap-0.5 ${canAffordThis ? '' : 'text-destructive font-bold'}`}>
                          {rType ? <ResourceIcon type={rType} size={10} /> : key}
                          {val}
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-0.5">
                    <ResourceIcon type="timer" size={10} /> {formatTime(buildTime)}
                  </p>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </motion.div>

      {/* Steel popup */}
      <AnimatePresence>
        {steelPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-6"
            onClick={() => setSteelPopup(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="game-panel border border-destructive/50 rounded-2xl p-5 max-w-sm w-full space-y-3 text-center"
            >
              <div className="text-3xl">⚒️</div>
              <h4 className="font-display text-lg text-destructive">Not enough Steel!</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Steel is obtained by capturing mines on the map. Create some soldiers and go claim them!
              </p>
              <button
                onClick={() => setSteelPopup(false)}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-display text-sm"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
