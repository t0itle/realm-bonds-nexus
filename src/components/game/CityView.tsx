import { useRef, useEffect, useState } from 'react';
import { useGame, BUILDING_INFO } from '@/hooks/useGameState';
import type { Building, BuildingType } from '@/lib/gameTypes';
import { motion } from 'framer-motion';
import { useTroopSkins } from '@/hooks/useTroopSkins';
import townGround from '@/assets/sprites/town-ground.png';
import workerMiner from '@/assets/sprites/worker-miner.png';
import workerWoodcutter from '@/assets/sprites/worker-woodcutter.png';
import workerFarmer from '@/assets/sprites/worker-farmer.png';
import workerMason from '@/assets/sprites/worker-mason.png';
import workerGuard from '@/assets/sprites/worker-guard.png';
import workerCivilian from '@/assets/sprites/worker-civilian.png';

const TASK_SPRITES: Record<string, string> = {
  goldmine: workerMiner,
  quarry: workerMason,
  lumbermill: workerWoodcutter,
  farm: workerFarmer,
  barracks: workerGuard,
  watchtower: workerGuard,
};

// Animated worker next to a building
function TaskWorker({ buildingType, delay, side }: { buildingType: string; delay: number; side: 'left' | 'right' }) {
  const sprite = TASK_SPRITES[buildingType];
  if (!sprite) return null;

  const isAnimated = ['goldmine', 'quarry', 'lumbermill', 'farm'].includes(buildingType);

  return (
    <motion.div
      className={`absolute ${side === 'left' ? '-left-4' : '-right-4'} bottom-2 z-10`}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: delay + 0.5, type: 'spring' }}
    >
      <motion.img
        src={sprite}
        alt="worker"
        className="w-7 h-7 object-contain drop-shadow-md"
        style={{ transform: side === 'left' ? 'scaleX(-1)' : 'none' }}
        animate={isAnimated ? { y: [0, -2, 0], rotate: [0, -3, 0, 3, 0] } : {}}
        transition={isAnimated ? { duration: 1.5, repeat: Infinity, delay: delay * 0.3 } : {}}
        loading="lazy"
      />
      {/* Task particles */}
      {buildingType === 'goldmine' && (
        <>
          {[0, 1].map(i => (
            <motion.div key={i} className="absolute w-1 h-1 rounded-full bg-yellow-400"
              style={{ bottom: 4, left: side === 'left' ? -2 + i * 4 : 20 + i * 4 }}
              animate={{ y: [-2, -10], opacity: [0.8, 0], scale: [1, 0.5] }}
              transition={{ duration: 0.8, delay: i * 0.4, repeat: Infinity }} />
          ))}
        </>
      )}
      {buildingType === 'lumbermill' && (
        <>
          {[0, 1].map(i => (
            <motion.div key={i} className="absolute w-1 h-1 rounded bg-amber-700/60"
              style={{ bottom: 8, left: side === 'left' ? 0 : 22 }}
              animate={{ x: [0, (i === 0 ? -6 : 6)], y: [-2, -8], opacity: [0.7, 0], rotate: [0, 90] }}
              transition={{ duration: 0.6, delay: i * 0.3, repeat: Infinity }} />
          ))}
        </>
      )}
      {buildingType === 'quarry' && (
        <>
          {[0, 1].map(i => (
            <motion.div key={i} className="absolute w-0.5 h-0.5 rounded-full bg-stone-400"
              style={{ bottom: 6, left: side === 'left' ? 2 : 18 }}
              animate={{ x: [0, (i === 0 ? -4 : 4)], y: [-2, -6], opacity: [0.6, 0] }}
              transition={{ duration: 0.5, delay: i * 0.25, repeat: Infinity }} />
          ))}
        </>
      )}
    </motion.div>
  );
}

// Walking civilian on the road
function RoadCivilian({ delay, areaWidth }: { delay: number; areaWidth: number }) {
  const flipped = Math.random() > 0.5;
  const duration = 16 + Math.random() * 10;
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ bottom: 20 + Math.random() * 30, zIndex: 50 }}
      initial={{ x: flipped ? areaWidth + 20 : -20 }}
      animate={{ x: flipped ? -20 : areaWidth + 20 }}
      transition={{ duration, delay, repeat: Infinity, ease: 'linear' }}
    >
      <motion.img
        src={workerCivilian}
        alt=""
        className="w-6 h-7 object-contain"
        style={{ transform: flipped ? 'scaleX(-1)' : 'none' }}
        animate={{ y: [0, -1, 0] }}
        transition={{ duration: 0.6, repeat: Infinity }}
        loading="lazy"
      />
    </motion.div>
  );
}

// Individual building with sprite
function CityBuilding({ building, sprite, animDelay, workerAssigned }: {
  building: Building; sprite: string; animDelay: number; workerAssigned: boolean;
}) {
  const info = BUILDING_INFO[building.type as Exclude<BuildingType, 'empty'>];
  const baseSize = building.type === 'townhall' ? 80 : 52;
  const size = baseSize + building.level * 2;
  const isProduction = ['farm', 'lumbermill', 'quarry', 'goldmine'].includes(building.type);

  return (
    <motion.div
      className="relative flex flex-col items-center"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: animDelay, type: 'spring', stiffness: 200, damping: 18 }}
    >
      {/* Smoke */}
      {isProduction && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 pointer-events-none z-20">
          {[0, 1, 2].map(i => (
            <motion.div key={i} className="absolute w-1 h-1 rounded-full bg-foreground/8"
              style={{ left: (i - 1) * 3 }}
              animate={{ y: [-2, -14], opacity: [0.25, 0], scale: [0.6, 2] }}
              transition={{ duration: 3, delay: i * 0.8, repeat: Infinity }} />
          ))}
        </div>
      )}

      <div className="relative">
        {/* Building sprite */}
        <motion.img
          src={sprite}
          alt={info.name}
          style={{ width: size, height: building.type === 'watchtower' ? size * 1.3 : size }}
          className="object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)]"
          animate={isProduction ? { y: [0, -1, 0] } : {}}
          transition={isProduction ? { duration: 4, repeat: Infinity, ease: 'easeInOut' } : {}}
          loading="lazy"
        />

        {/* Task worker */}
        {workerAssigned && TASK_SPRITES[building.type] && (
          <TaskWorker buildingType={building.type} delay={animDelay} side={Math.random() > 0.5 ? 'left' : 'right'} />
        )}
      </div>

      {/* Label */}
      <div className="mt-0.5 px-1.5 py-px rounded-full bg-background/50 backdrop-blur-sm">
        <span className="text-[7px] font-display text-foreground/70">{info.name} {building.level}</span>
      </div>
    </motion.div>
  );
}

export default function CityView() {
  const { buildings, army, population, workerAssignments, settlementType } = useGame();
  const { getBuildingSprite } = useTroopSkins();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(384);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => setContainerWidth(entries[0].contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const nonEmpty = buildings.filter(b => b.type !== 'empty');
  // Handle both camp (campfire) and village+ (townhall) center buildings
  const centerBuilding = nonEmpty.find(b => b.type === 'townhall' || b.type === 'campfire');
  const walls = nonEmpty.filter(b => b.type === 'wall');
  const rest = nonEmpty.filter(b => b.type !== 'townhall' && b.type !== 'campfire' && b.type !== 'wall');
  const isCamp = settlementType === 'camp';

  // Separate into zones
  const military = rest.filter(b => ['barracks', 'watchtower', 'spyguild'].includes(b.type));
  const production = rest.filter(b => ['farm', 'lumbermill', 'quarry', 'goldmine'].includes(b.type));
  const civic = rest.filter(b => ['house', 'temple', 'apothecary', 'warehouse', 'administrator'].includes(b.type));

  const totalTroops = Object.values(army).reduce((s: number, v: number) => s + v, 0);
  const civCount = Math.min(Math.floor(population.current * 0.3), 8);

  return (
    <div ref={containerRef} className="flex-1 relative overflow-y-auto overflow-x-hidden" style={{
      background: 'linear-gradient(180deg, #7EC8E3 0%, #A8D8EA 20%, #C5E6A6 35%, #6B9F5B 55%, #4A7C3F 100%)',
    }}>
      {/* Sun */}
      <div className="absolute top-4 right-8 pointer-events-none">
        <div className="w-12 h-12 rounded-full" style={{
          background: 'radial-gradient(circle, #FFE082 0%, #FFD54F 40%, transparent 70%)',
          boxShadow: '0 0 40px 10px rgba(255,213,79,0.3)',
        }} />
      </div>

      {/* Clouds */}
      {[0, 1, 2].map(i => (
        <motion.div key={i} className="absolute pointer-events-none" style={{ top: 10 + i * 16 }}
          animate={{ x: [-(i * 50 + 60), containerWidth + 60] }}
          transition={{ duration: 50 + i * 18, repeat: Infinity, ease: 'linear', delay: i * 10 }}>
          <div className="flex gap-px opacity-40">
            <div className="w-6 h-2.5 rounded-full bg-white/70" />
            <div className="w-10 h-3.5 rounded-full bg-white/80 -mt-0.5" />
            <div className="w-5 h-2 rounded-full bg-white/50 mt-0.5" />
          </div>
        </motion.div>
      ))}

      {/* Distant hills */}
      <svg className="absolute top-[16%] left-0 right-0 h-[14%] pointer-events-none" viewBox="0 0 400 50" preserveAspectRatio="none">
        <path d="M0 50 Q40 15 100 35 Q160 5 220 30 Q280 10 340 38 Q380 15 400 25 L400 50Z" fill="#7BAF6B" opacity="0.4" />
        <path d="M0 50 Q70 25 140 40 Q210 18 280 42 Q340 22 400 35 L400 50Z" fill="#6B9F5B" opacity="0.35" />
      </svg>

      {/* HUD */}
      <div className="sticky top-0 z-30 flex justify-center gap-2 py-2 px-3">
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/50 backdrop-blur-md border border-white/10 shadow-sm">
          <span className="text-[10px]">👥</span>
          <span className="text-[9px] font-display text-foreground/90">{population.current}/{population.max}</span>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/50 backdrop-blur-md border border-white/10 shadow-sm">
          <span className="text-[10px]">{population.happiness >= 60 ? '😊' : population.happiness >= 30 ? '😐' : '😠'}</span>
          <span className="text-[9px] font-display text-foreground/90">{population.happiness}%</span>
        </div>
        {totalTroops > 0 && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/50 backdrop-blur-md border border-white/10 shadow-sm">
            <span className="text-[10px]">⚔️</span>
            <span className="text-[9px] font-display text-foreground/90">{totalTroops}</span>
          </div>
        )}
      </div>

      {/* Town scene */}
      <div className="relative mt-[18%] px-2 pb-40">
        {/* Ground texture */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
          backgroundImage: `url(${townGround})`,
          backgroundSize: '100px',
          backgroundRepeat: 'repeat',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%)',
        }} />

        {/* === WALL PERIMETER === */}
        {walls.length > 0 && (
          <div className="relative mb-2">
            {/* Top wall row */}
            <div className="flex justify-center gap-0 overflow-hidden">
              {Array.from({ length: Math.max(walls.length, 3) }).map((_, i) => {
                const wallBuilding = walls[i % walls.length];
                return (
                  <motion.img
                    key={`top-${i}`}
                    src={getBuildingSprite('wall')}
                    alt="Wall"
                    className="h-8 object-contain opacity-90"
                    style={{ width: containerWidth / Math.max(walls.length, 3) - 2 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.9 }}
                    transition={{ delay: i * 0.1 }}
                    loading="lazy"
                  />
                );
              })}
            </div>
            {/* Guard on wall */}
            {totalTroops > 0 && (
              <motion.img
                src={workerGuard}
                alt="Guard"
                className="absolute -top-3 left-4 w-5 h-6 object-contain drop-shadow-md z-10"
                animate={{ x: [0, 10, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                loading="lazy"
              />
            )}
          </div>
        )}

        {/* Left & right wall columns */}
        {walls.length > 0 && (
          <>
            <div className="absolute left-0 top-12 bottom-32 flex flex-col justify-center gap-0 pointer-events-none">
              {Array.from({ length: 3 }).map((_, i) => (
                <motion.img key={`left-${i}`} src={getBuildingSprite('wall')} alt="Wall"
                  className="w-6 h-10 object-contain opacity-70 -rotate-90"
                  initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ delay: 0.3 + i * 0.1 }}
                  loading="lazy" />
              ))}
            </div>
            <div className="absolute right-0 top-12 bottom-32 flex flex-col justify-center gap-0 pointer-events-none">
              {Array.from({ length: 3 }).map((_, i) => (
                <motion.img key={`right-${i}`} src={getBuildingSprite('wall')} alt="Wall"
                  className="w-6 h-10 object-contain opacity-70 rotate-90"
                  initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ delay: 0.3 + i * 0.1 }}
                  loading="lazy" />
              ))}
            </div>
          </>
        )}

        {/* === INNER TOWN === */}
        <div className="relative px-4">
          {/* Military zone - back row */}
          {military.length > 0 && (
            <div className="flex items-end justify-center gap-3 mb-3" style={{ zIndex: 1 }}>
              {military.map((b, i) => (
                <CityBuilding
                  key={b.id}
                  building={b}
                  sprite={getBuildingSprite(b.type as Exclude<BuildingType, 'empty'>)}
                  animDelay={0.1 + i * 0.15}
                  workerAssigned={(workerAssignments[b.id] || 0) > 0}
                />
              ))}
            </div>
          )}

          {/* Civic buildings - middle row */}
          {civic.length > 0 && (
            <div className="flex items-end justify-center gap-2 mb-3 flex-wrap" style={{ zIndex: 2 }}>
              {civic.map((b, i) => (
                <CityBuilding
                  key={b.id}
                  building={b}
                  sprite={getBuildingSprite(b.type as Exclude<BuildingType, 'empty'>)}
                  animDelay={0.3 + i * 0.12}
                  workerAssigned={(workerAssignments[b.id] || 0) > 0}
                />
              ))}
            </div>
          )}

          {/* === TOWNHALL - CENTER FOCAL POINT === */}
          {townhall && (
            <div className="flex justify-center mb-4 relative" style={{ zIndex: 5 }}>
              {/* Glow underneath */}
              <div className="absolute bottom-0 w-24 h-4 rounded-full bg-amber-400/10 blur-md" />
              <CityBuilding
                building={townhall}
                sprite={getBuildingSprite('townhall')}
                animDelay={0}
                workerAssigned={false}
              />
              {/* Banner flags */}
              <motion.div className="absolute -top-1 left-1/2 -translate-x-6 text-[8px] pointer-events-none"
                animate={{ rotate: [-5, 5, -5] }}
                transition={{ duration: 2, repeat: Infinity }}>
                🚩
              </motion.div>
              <motion.div className="absolute -top-1 left-1/2 translate-x-3 text-[8px] pointer-events-none"
                animate={{ rotate: [5, -5, 5] }}
                transition={{ duration: 2.2, repeat: Infinity }}>
                🚩
              </motion.div>
            </div>
          )}

          {/* Production buildings - front row */}
          {production.length > 0 && (
            <div className="flex items-end justify-center gap-3 mb-2 flex-wrap" style={{ zIndex: 3 }}>
              {production.map((b, i) => (
                <CityBuilding
                  key={b.id}
                  building={b}
                  sprite={getBuildingSprite(b.type as Exclude<BuildingType, 'empty'>)}
                  animDelay={0.5 + i * 0.12}
                  workerAssigned={(workerAssignments[b.id] || 0) > 0}
                />
              ))}
            </div>
          )}

          {/* Road / path through center */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-6 pointer-events-none" style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(139,115,85,0.2) 15%, rgba(139,115,85,0.25) 85%, transparent 100%)',
          }} />
        </div>

        {/* Bottom wall */}
        {walls.length > 0 && (
          <div className="flex justify-center gap-0 overflow-hidden mt-2">
            {Array.from({ length: Math.max(walls.length, 3) }).map((_, i) => (
              <motion.img
                key={`bottom-${i}`}
                src={getBuildingSprite('wall')}
                alt="Wall"
                className="h-8 object-contain opacity-85"
                style={{ width: containerWidth / Math.max(walls.length, 3) - 2 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.85 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                loading="lazy"
              />
            ))}
            {/* Gate opening in center */}
            <div className="absolute left-1/2 -translate-x-3 bottom-0 w-6 h-8 bg-gradient-to-t from-amber-900/40 to-transparent rounded-t-lg" />
          </div>
        )}

        {/* Walking civilians on paths */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: civCount }).map((_, i) => (
            <RoadCivilian key={i} delay={i * 2.5} areaWidth={containerWidth} />
          ))}
        </div>
      </div>
    </div>
  );
}
