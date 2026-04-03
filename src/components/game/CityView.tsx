import { useState, useEffect, useRef } from 'react';
import { useGame, BUILDING_INFO } from '@/hooks/useGameState';
import type { Building, BuildingType } from '@/lib/gameTypes';
import { motion, AnimatePresence } from 'framer-motion';
import { useTroopSkins } from '@/hooks/useTroopSkins';
import citizensSprite from '@/assets/sprites/citizens.png';
import townGround from '@/assets/sprites/town-ground.png';

// Citizen walking component
function WalkingCitizen({ type, delay, areaWidth }: { type: 'worker' | 'soldier' | 'civilian'; delay: number; areaWidth: number }) {
  const clipX = type === 'soldier' ? '50%' : type === 'worker' ? '25%' : type === 'civilian' ? '75%' : '0%';
  const startX = -40 + Math.random() * 20;
  const yPos = 70 + Math.random() * 25;
  const duration = 12 + Math.random() * 8;
  const flipped = Math.random() > 0.5;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        bottom: `${yPos}px`,
        zIndex: Math.floor(100 - yPos),
      }}
      initial={{ x: flipped ? areaWidth + 40 : startX }}
      animate={{ x: flipped ? startX : areaWidth + 40 }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      <div
        className="w-8 h-10 overflow-hidden"
        style={{ transform: flipped ? 'scaleX(-1)' : 'none' }}
      >
        <img
          src={citizensSprite}
          alt=""
          className="h-full object-cover animate-float"
          style={{ objectPosition: `${clipX} center` }}
          loading="lazy"
        />
      </div>
    </motion.div>
  );
}

// Building plot in the town
function TownBuilding({
  building,
  sprite,
  isUpgrading,
  isSelected,
  onClick,
}: {
  building: Building;
  sprite: string;
  isUpgrading: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const info = building.type !== 'empty' ? BUILDING_INFO[building.type as Exclude<BuildingType, 'empty'>] : null;
  if (!info) return null;

  const sizeClass = building.level >= 8 ? 'w-20 h-20' : building.level >= 4 ? 'w-16 h-16' : 'w-14 h-14';

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      className={`relative flex flex-col items-center group transition-all ${isSelected ? 'z-20' : 'z-10'}`}
    >
      {/* Ground shadow */}
      <div className="absolute bottom-0 w-full h-2 bg-black/15 rounded-full blur-sm" />

      {/* Building sprite */}
      <motion.div
        className={`${sizeClass} relative`}
        animate={isUpgrading ? { y: [0, -2, 0] } : {}}
        transition={isUpgrading ? { duration: 0.8, repeat: Infinity } : {}}
      >
        <img
          src={sprite}
          alt={info.name}
          className={`w-full h-full object-contain drop-shadow-lg ${isUpgrading ? 'brightness-75' : ''}`}
          loading="lazy"
        />

        {/* Upgrading overlay */}
        {isUpgrading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg animate-pulse">🔨</span>
          </div>
        )}

        {/* Selection ring */}
        {isSelected && (
          <motion.div
            className="absolute -inset-1 rounded-xl border-2 border-amber-400"
            style={{ boxShadow: '0 0 12px rgba(251,191,36,0.4)' }}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </motion.div>

      {/* Label */}
      <div className="mt-0.5 px-1.5 py-0.5 rounded-md bg-background/80 backdrop-blur-sm border border-border/30 flex items-center gap-1">
        <span className="text-[8px] font-display text-foreground truncate max-w-[60px]">{info.name}</span>
        <span className="text-[8px] font-bold text-primary">Lv{building.level}</span>
      </div>

      {/* Smoke for active production buildings */}
      {!isUpgrading && ['farm', 'lumbermill', 'quarry', 'goldmine'].includes(building.type) && (
        <div className="absolute -top-3 left-1/2 pointer-events-none">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-muted-foreground/20"
              initial={{ y: 0, x: (i - 1) * 3, opacity: 0.4, scale: 0.5 }}
              animate={{ y: -12, opacity: 0, scale: 1.5 }}
              transition={{ duration: 2, delay: i * 0.6, repeat: Infinity }}
            />
          ))}
        </div>
      )}
    </motion.button>
  );
}

export default function CityView() {
  const {
    buildings, army, population, workerAssignments,
    upgradeBuilding, assignWorker, unassignWorker,
    isBuildingUpgrading, getMaxWorkers,
  } = useGame();
  const { getBuildingSprite } = useTroopSkins();
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(384);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const nonEmpty = buildings.filter(b => b.type !== 'empty');

  // Arrange into rows: important buildings in back, smaller in front
  const priorityOrder: Record<string, number> = {
    townhall: 0, barracks: 1, temple: 2, wall: 3, watchtower: 4,
    warehouse: 5, spyguild: 6, administrator: 7, apothecary: 8,
    goldmine: 9, quarry: 10, lumbermill: 11, farm: 12, house: 13,
  };
  const sorted = [...nonEmpty].sort((a, b) => (priorityOrder[a.type] ?? 99) - (priorityOrder[b.type] ?? 99));

  const cols = containerWidth < 350 ? 3 : containerWidth < 500 ? 4 : 5;
  const rows: Building[][] = [];
  for (let i = 0; i < sorted.length; i += cols) {
    rows.push(sorted.slice(i, i + cols));
  }

  // Citizen counts
  const totalTroops = Object.values(army).reduce((s: number, v: number) => s + v, 0);
  const totalWorkers = Object.values(workerAssignments).reduce((s: number, v: number) => s + v, 0);
  const citizenCount = Math.min(population.current, 20);
  const soldiers = Math.min(totalTroops, Math.floor(citizenCount * 0.3));
  const workers = Math.min(totalWorkers, Math.floor(citizenCount * 0.4));
  const civs = citizenCount - soldiers - workers;

  const selectedInfo = selectedBuilding && selectedBuilding.type !== 'empty'
    ? BUILDING_INFO[selectedBuilding.type]
    : null;
  const upgrading = selectedBuilding ? isBuildingUpgrading(selectedBuilding.id) : undefined;
  const workerCount = selectedBuilding ? (workerAssignments[selectedBuilding.id] || 0) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Town scene */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-y-auto overflow-x-hidden"
        style={{
          background: 'linear-gradient(180deg, #87CEEB 0%, #B0E0E6 25%, #90C695 35%, #5A8F4A 100%)',
        }}
      >
        {/* Distant hills */}
        <div className="absolute top-[20%] left-0 right-0 h-[15%] pointer-events-none">
          <svg viewBox="0 0 400 60" className="w-full h-full" preserveAspectRatio="none">
            <path d="M0 60 Q50 10 100 40 Q150 5 200 35 Q250 15 300 45 Q350 8 400 30 L400 60 Z" fill="#6B9F5B" opacity="0.5" />
            <path d="M0 60 Q80 25 160 45 Q240 20 320 50 Q360 30 400 40 L400 60 Z" fill="#5A8F4A" opacity="0.4" />
          </svg>
        </div>

        {/* Sun */}
        <div className="absolute top-4 right-8 w-10 h-10 rounded-full bg-yellow-300 blur-sm opacity-80 pointer-events-none" />
        <div className="absolute top-5 right-9 w-8 h-8 rounded-full bg-yellow-200 pointer-events-none" />

        {/* Clouds */}
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="absolute pointer-events-none opacity-60"
            style={{ top: 12 + i * 20 }}
            animate={{ x: [-(i * 60 + 80), containerWidth + 40] }}
            transition={{ duration: 40 + i * 15, repeat: Infinity, ease: 'linear', delay: i * 8 }}
          >
            <div className="flex gap-0.5">
              <div className="w-8 h-3 rounded-full bg-white/70" />
              <div className="w-12 h-4 rounded-full bg-white/80 -mt-1" />
              <div className="w-6 h-3 rounded-full bg-white/60" />
            </div>
          </motion.div>
        ))}

        {/* Population HUD */}
        <div className="sticky top-0 z-30 flex justify-center gap-3 py-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/70 backdrop-blur-md border border-border/30">
            <span className="text-xs">👥</span>
            <span className="text-[10px] font-display text-foreground">{population.current}/{population.max}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/70 backdrop-blur-md border border-border/30">
            <span className="text-xs">{population.happiness >= 60 ? '😊' : population.happiness >= 30 ? '😐' : '😠'}</span>
            <span className="text-[10px] font-display text-foreground">{population.happiness}%</span>
          </div>
        </div>

        {/* Town ground area */}
        <div className="relative mt-[25%] px-2 pb-32">
          {/* Ground texture */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: `url(${townGround})`,
              backgroundSize: '120px',
              backgroundRepeat: 'repeat',
            }}
          />

          {/* Building rows - back to front for depth */}
          {rows.map((row, ri) => (
            <div
              key={ri}
              className="flex items-end justify-center gap-2 mb-3 relative"
              style={{ zIndex: ri + 1 }}
            >
              {row.map(building => {
                const type = building.type as Exclude<BuildingType, 'empty'>;
                return (
                  <TownBuilding
                    key={building.id}
                    building={building}
                    sprite={getBuildingSprite(type)}
                    isUpgrading={!!isBuildingUpgrading(building.id)}
                    isSelected={selectedBuilding?.id === building.id}
                    onClick={() => setSelectedBuilding(
                      selectedBuilding?.id === building.id ? null : building
                    )}
                  />
                );
              })}
            </div>
          ))}

          {/* Walking citizens */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: soldiers }).map((_, i) => (
              <WalkingCitizen key={`s${i}`} type="soldier" delay={i * 2.5} areaWidth={containerWidth} />
            ))}
            {Array.from({ length: workers }).map((_, i) => (
              <WalkingCitizen key={`w${i}`} type="worker" delay={i * 3 + 1} areaWidth={containerWidth} />
            ))}
            {Array.from({ length: civs }).map((_, i) => (
              <WalkingCitizen key={`c${i}`} type="civilian" delay={i * 2 + 0.5} areaWidth={containerWidth} />
            ))}
          </div>
        </div>
      </div>

      {/* Building management panel */}
      <AnimatePresence>
        {selectedBuilding && selectedInfo && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="shrink-0 game-panel border-t border-primary/30 p-3 space-y-2 z-40"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={getBuildingSprite(selectedBuilding.type as Exclude<BuildingType, 'empty'>)}
                  alt={selectedInfo.name}
                  className="w-8 h-8 object-contain"
                />
                <div>
                  <h3 className="font-display text-sm font-bold text-foreground">{selectedInfo.name}</h3>
                  <span className="text-[10px] text-muted-foreground">Level {selectedBuilding.level}/{selectedInfo.maxLevel}</span>
                </div>
              </div>
              <button onClick={() => setSelectedBuilding(null)} className="text-muted-foreground text-xs px-1">✕</button>
            </div>

            <p className="text-[10px] text-muted-foreground leading-relaxed">{selectedInfo.description}</p>

            {upgrading && (
              <div className="flex items-center gap-2 text-[10px] text-primary animate-pulse">
                <span>🔨</span>
                <span>Upgrading to level {upgrading.targetLevel}...</span>
              </div>
            )}

            <div className="flex gap-2">
              {selectedBuilding.level < selectedInfo.maxLevel && !upgrading && (
                <button
                  onClick={() => upgradeBuilding(selectedBuilding.id)}
                  className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground font-display text-xs"
                >
                  ⬆️ Upgrade to Lv{selectedBuilding.level + 1}
                </button>
              )}

              {selectedInfo.workersPerLevel > 0 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => unassignWorker(selectedBuilding.id)}
                    disabled={workerCount <= 0}
                    className="px-2 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs disabled:opacity-30"
                  >−</button>
                  <span className="text-xs font-display text-foreground min-w-[40px] text-center">
                    👷 {workerCount}
                  </span>
                  <button
                    onClick={() => assignWorker(selectedBuilding.id)}
                    className="px-2 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs"
                  >+</button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
