import { useState } from 'react';
import { useGame, BUILDING_INFO, getUpgradeCost, getProduction, BuildingType, Building } from '@/hooks/useGameState';
import { motion, AnimatePresence } from 'framer-motion';
import BuildModal from './BuildModal';

const GRID_SIZE = 9;

export default function VillageGrid() {
  const { buildings, upgradeBuilding, canAfford } = useGame();
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [buildPosition, setBuildPosition] = useState<number | null>(null);

  const grid = Array.from({ length: GRID_SIZE }, (_, i) => {
    return buildings.find(b => b.position === i) || null;
  });

  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-4">
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          {grid.map((building, i) => (
            <motion.button
              key={i}
              whileTap={{ scale: 0.93 }}
              whileHover={{ scale: 1.03 }}
              onClick={() => {
                if (building) setSelectedBuilding(building);
                else setBuildPosition(i);
              }}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                building
                  ? 'game-panel border-glow glow-gold-sm'
                  : 'border-2 border-dashed border-border/50 bg-muted/30 hover:border-primary/50'
              }`}
            >
              {building ? (
                <>
                  <span className="text-2xl">{BUILDING_INFO[building.type as Exclude<BuildingType, 'empty'>].icon}</span>
                  <span className="text-[10px] font-display text-foreground/80 truncate w-full text-center px-1">
                    {BUILDING_INFO[building.type as Exclude<BuildingType, 'empty'>].name}
                  </span>
                  <span className="text-[9px] text-primary font-bold">Lv.{building.level}</span>
                </>
              ) : (
                <span className="text-2xl opacity-30">＋</span>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedBuilding && selectedBuilding.type !== 'empty' && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 game-panel border-t border-glow rounded-t-2xl p-4 pb-20 max-h-[60vh]"
          >
            <button
              onClick={() => setSelectedBuilding(null)}
              className="absolute top-3 right-3 text-muted-foreground text-sm"
            >✕</button>
            <BuildingDetail
              building={selectedBuilding}
              onUpgrade={async () => {
                const success = await upgradeBuilding(selectedBuilding.id);
                if (success) {
                  setSelectedBuilding(prev => prev ? { ...prev, level: prev.level + 1 } : null);
                }
              }}
              canAfford={canAfford}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {buildPosition !== null && (
          <BuildModal
            position={buildPosition}
            onClose={() => setBuildPosition(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function BuildingDetail({ building, onUpgrade, canAfford }: {
  building: Building;
  onUpgrade: () => void;
  canAfford: (cost: any) => boolean;
}) {
  const type = building.type as Exclude<BuildingType, 'empty'>;
  const info = BUILDING_INFO[type];
  const upgradeCost = getUpgradeCost(type, building.level);
  const production = getProduction(type, building.level);
  const affordable = canAfford(upgradeCost);
  const maxed = building.level >= info.maxLevel;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-4xl">{info.icon}</span>
        <div>
          <h3 className="font-display text-lg text-foreground">{info.name}</h3>
          <p className="text-xs text-primary font-bold">Level {building.level} / {info.maxLevel}</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{info.description}</p>

      {Object.keys(production).length > 0 && (
        <div className="flex gap-3 text-xs">
          <span className="text-muted-foreground">Production:</span>
          {Object.entries(production).map(([key, val]) => (
            <span key={key} className="text-foreground">+{val} {key}/min</span>
          ))}
        </div>
      )}

      {!maxed && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-display">Upgrade Cost:</p>
          <div className="flex gap-3 text-xs">
            {Object.entries(upgradeCost).filter(([, v]) => v > 0).map(([key, val]) => (
              <span key={key} className="text-foreground">
                {key === 'gold' ? '💰' : key === 'wood' ? '🪵' : key === 'stone' ? '🪨' : '🌾'}
                {val}
              </span>
            ))}
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onUpgrade}
            disabled={!affordable}
            className={`w-full py-2.5 rounded-lg font-display text-sm font-bold transition-all ${
              affordable
                ? 'bg-primary text-primary-foreground glow-gold'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            {affordable ? `Upgrade to Level ${building.level + 1}` : 'Not Enough Resources'}
          </motion.button>
        </div>
      )}

      {maxed && (
        <div className="text-center py-2 text-primary font-display text-sm animate-pulse-gold rounded-lg border border-primary/30">
          ✦ Maximum Level ✦
        </div>
      )}
    </div>
  );
}
