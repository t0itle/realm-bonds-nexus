import { useState, useEffect } from 'react';
import { useGame, BUILDING_INFO, getUpgradeCost, getProduction, getSteelProduction, BuildingType, Building } from '@/hooks/useGameState';
import { motion, AnimatePresence } from 'framer-motion';
import { BUILDING_SPRITES, WORKERS_SPRITE, WORKER_FOR_BUILDING } from './sprites';
import BuildModal from './BuildModal';
import ResourceIcon, { getResourceType } from './ResourceIcon';

function getGridSize(townhallLevel: number): number {
  if (townhallLevel >= 7) return 16;
  if (townhallLevel >= 5) return 12;
  if (townhallLevel >= 3) return 9;
  return 9;
}

function getGridCols(gridSize: number): number {
  if (gridSize >= 16) return 4;
  if (gridSize >= 12) return 4;
  return 3;
}

function formatTime(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
}

export default function VillageGrid() {
  const { buildings, upgradeBuilding, demolishBuilding, canAfford, canAffordSteel, isBuildingUpgrading, getBuildTime, resources, steel } = useGame();
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [buildPosition, setBuildPosition] = useState<number | null>(null);
  const [, forceUpdate] = useState(0);

  // Force re-render every second for countdown timers
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(v => v + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const townhallLevel = buildings.find(b => b.type === 'townhall')?.level || 1;
  const gridSize = getGridSize(townhallLevel);
  const gridCols = getGridCols(gridSize);

  const grid = Array.from({ length: gridSize }, (_, i) => {
    return buildings.find(b => b.position === i) || null;
  });

  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center px-3 py-3">
        <div className={`grid gap-2.5 w-full max-w-xs`} style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
          {grid.map((building, i) => {
            const type = building?.type as Exclude<BuildingType, 'empty'> | undefined;
            const sprite = type ? BUILDING_SPRITES[type] : null;
            const worker = type ? WORKER_FOR_BUILDING[type] : null;
            const upgrading = building ? isBuildingUpgrading(building.id) : undefined;
            const isUnderConstruction = building && building.level === 0;

            return (
              <motion.button
                key={i}
                whileTap={{ scale: 0.93 }}
                onClick={() => {
                  if (building && !isUnderConstruction) setSelectedBuilding(building);
                  else if (!building) setBuildPosition(i);
                }}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all relative overflow-hidden ${
                  building
                    ? 'game-panel border-glow'
                    : 'border-2 border-dashed border-border/50 bg-muted/30 hover:border-primary/50'
                }`}
              >
                {building && sprite ? (
                  <>
                    <img
                      src={sprite}
                      alt={BUILDING_INFO[type!].name}
                      className={`w-16 h-16 object-contain drop-shadow-lg ${(upgrading || isUnderConstruction) ? 'opacity-50 grayscale' : ''}`}
                      loading="lazy"
                    />
                    {/* Build/upgrade timer overlay */}
                    {(upgrading || isUnderConstruction) && (
                     <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 rounded-xl">
                        <ResourceIcon type="hammer" size={24} className="animate-pulse" />
                        {upgrading && (
                          <span className="text-[10px] font-display text-primary font-bold">
                            {formatTime(upgrading.finishTime - Date.now())}
                          </span>
                        )}
                        <span className="text-[8px] text-muted-foreground">
                          {isUnderConstruction ? 'Building...' : `→ Lv.${upgrading?.targetLevel}`}
                        </span>
                      </div>
                    )}
                    {/* Worker sprite */}
                    {worker && building.level > 0 && !upgrading && (
                      <div className="absolute bottom-7 right-1 w-5 h-5 overflow-hidden">
                        <img
                          src={WORKERS_SPRITE}
                          alt={worker.name}
                          className="h-5 object-cover animate-float"
                          style={{
                            objectPosition: `${worker.clipX}% center`,
                            width: '20px',
                          }}
                          loading="lazy"
                        />
                      </div>
                    )}
                    {!upgrading && !isUnderConstruction && (
                      <>
                        <span className="text-[9px] font-display text-foreground/80 truncate w-full text-center px-1">
                          {BUILDING_INFO[type!].name}
                        </span>
                        <span className="text-[8px] text-primary font-bold bg-background/60 px-1.5 rounded-full">
                          Lv.{building.level}
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <span className="text-2xl opacity-30">＋</span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Building detail sheet */}
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
                  setSelectedBuilding(null);
                }
              }}
              onDemolish={async () => {
                const success = await demolishBuilding(selectedBuilding.id);
                if (success) {
                  setSelectedBuilding(null);
                }
              }}
              canAfford={canAfford}
              canAffordSteel={canAffordSteel}
              resources={resources}
              steel={steel}
              isBuildingUpgrading={isBuildingUpgrading}
              getBuildTime={getBuildTime}
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

function BuildingDetail({ building, onUpgrade, onDemolish, canAfford, canAffordSteel, resources, steel, isBuildingUpgrading, getBuildTime }: {
  building: Building;
  onUpgrade: () => void;
  onDemolish: () => void;
  canAfford: (cost: any) => boolean;
  canAffordSteel: (amount: number) => boolean;
  resources: { gold: number; wood: number; stone: number; food: number };
  steel: number;
  isBuildingUpgrading: (id: string) => any;
  getBuildTime: (type: Exclude<BuildingType, 'empty'>, level: number) => number;
}) {
  const [confirmDemolish, setConfirmDemolish] = useState(false);
  const type = building.type as Exclude<BuildingType, 'empty'>;
  const info = BUILDING_INFO[type];
  const sprite = BUILDING_SPRITES[type];
  const upgradeCost = getUpgradeCost(type, building.level);
  const production = getProduction(type, building.level);
  const steelProd = getSteelProduction(type, building.level);
  const affordable = canAfford(upgradeCost) && (upgradeCost.steel <= 0 || canAffordSteel(upgradeCost.steel));
  const maxed = building.level >= info.maxLevel;
  const upgrading = isBuildingUpgrading(building.id);
  const buildTime = getBuildTime(type, building.level);

  // Per-resource affordability for highlighting
  const resourceCheck: Record<string, boolean> = {
    gold: resources.gold >= upgradeCost.gold,
    wood: resources.wood >= upgradeCost.wood,
    stone: resources.stone >= upgradeCost.stone,
    food: resources.food >= upgradeCost.food,
    steel: steel >= upgradeCost.steel,
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <img src={sprite} alt={info.name} className="w-16 h-16 object-contain" />
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

      {upgrading && (
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-center space-y-1">
          <p className="text-xs font-display text-primary animate-pulse">🔨 Upgrading to Level {upgrading.targetLevel}...</p>
          <p className="text-sm font-bold text-foreground">{formatTime(upgrading.finishTime - Date.now())}</p>
        </div>
      )}

      {!maxed && !upgrading && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-display">Upgrade Cost:</p>
          <div className="flex gap-3 text-xs">
                  {Object.entries(upgradeCost).filter(([, v]) => v > 0).map(([key, val]) => {
                    const rType = getResourceType(key);
                    const canAffordThis = resourceCheck[key] !== false;
                    return (
                      <span key={key} className={`flex items-center gap-0.5 ${canAffordThis ? 'text-foreground' : 'text-destructive font-bold'}`}>
                        {rType ? <ResourceIcon type={rType} size={12} /> : key}
                        {val}
                      </span>
                    );
                  })}
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-0.5"><ResourceIcon type="timer" size={10} /> Build time: {formatTime(buildTime * 1000)}</p>
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

      {maxed && !upgrading && (
        <div className="text-center py-2 text-primary font-display text-sm animate-pulse-gold rounded-lg border border-primary/30">
          ✦ Maximum Level ✦
        </div>
      )}

      {/* Demolish button — not for townhall */}
      {building.type !== 'townhall' && !upgrading && (
        <div className="pt-2 border-t border-border/30">
          {!confirmDemolish ? (
            <button
              onClick={() => setConfirmDemolish(true)}
              className="w-full py-2 rounded-lg font-display text-xs text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors"
            >
              🏚️ Demolish Building
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-destructive text-center">Are you sure? You'll recover 30% of invested resources.</p>
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={onDemolish}
                  className="flex-1 py-2 rounded-lg font-display text-xs bg-destructive text-destructive-foreground">
                  Confirm
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={() => setConfirmDemolish(false)}
                  className="flex-1 py-2 rounded-lg font-display text-xs bg-muted text-muted-foreground">
                  Cancel
                </motion.button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
