import { useState, useEffect, useRef } from 'react';
import { useGame, BUILDING_INFO } from '@/hooks/useGameState';
import type { Building, BuildingType } from '@/lib/gameTypes';
import { motion } from 'framer-motion';
import { useTroopSkins } from '@/hooks/useTroopSkins';
import citizensSprite from '@/assets/sprites/citizens.png';
import townGround from '@/assets/sprites/town-ground.png';

function WalkingCitizen({ type, delay, areaWidth, yBase }: { type: 'worker' | 'soldier' | 'civilian'; delay: number; areaWidth: number; yBase: number }) {
  const clipX = type === 'soldier' ? '50%' : type === 'worker' ? '25%' : '75%';
  const flipped = Math.random() > 0.5;
  const duration = 14 + Math.random() * 10;
  const size = 22 + Math.random() * 8;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ bottom: yBase, zIndex: Math.floor(200 - yBase) }}
      initial={{ x: flipped ? areaWidth + 30 : -30 }}
      animate={{ x: flipped ? -30 : areaWidth + 30 }}
      transition={{ duration, delay, repeat: Infinity, ease: 'linear' }}
    >
      <div style={{ width: size, height: size * 1.25, transform: flipped ? 'scaleX(-1)' : 'none' }} className="overflow-hidden">
        <img src={citizensSprite} alt="" className="h-full object-cover" style={{ objectPosition: `${clipX} center` }} loading="lazy" />
      </div>
    </motion.div>
  );
}

function BuildingSprite({ building, sprite, row }: { building: Building; sprite: string; row: number }) {
  const info = BUILDING_INFO[building.type as Exclude<BuildingType, 'empty'>];
  const baseSize = 56;
  const levelBonus = building.level * 2.5;
  const size = baseSize + levelBonus;
  const isProduction = ['farm', 'lumbermill', 'quarry', 'goldmine'].includes(building.type);
  const isTall = ['watchtower', 'townhall', 'temple', 'wall'].includes(building.type);

  return (
    <motion.div
      className="relative flex flex-col items-center"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: row * 0.1 + Math.random() * 0.2, type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* Smoke for production buildings */}
      {isProduction && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-foreground/10"
              style={{ left: (i - 1) * 4 }}
              animate={{ y: [-2, -16], opacity: [0.3, 0], scale: [0.5, 2] }}
              transition={{ duration: 2.5, delay: i * 0.7, repeat: Infinity }}
            />
          ))}
        </div>
      )}

      {/* Building image */}
      <motion.div
        style={{ width: size, height: isTall ? size * 1.2 : size }}
        animate={isProduction ? { y: [0, -1, 0] } : {}}
        transition={isProduction ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : {}}
      >
        <img
          src={sprite}
          alt={info.name}
          className="w-full h-full object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)]"
          loading="lazy"
        />
      </motion.div>

      {/* Name plate */}
      <div className="mt-0.5 px-1.5 py-px rounded-full bg-background/60 backdrop-blur-sm">
        <span className="text-[7px] font-display text-foreground/80">{info.name} {building.level}</span>
      </div>
    </motion.div>
  );
}

export default function CityView() {
  const { buildings, army, population, workerAssignments } = useGame();
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

  // Depth sort: important/tall in back, small in front
  const depthOrder: Record<string, number> = {
    townhall: 0, wall: 1, watchtower: 2, temple: 3, barracks: 4,
    spyguild: 5, administrator: 6, warehouse: 7, apothecary: 8,
    goldmine: 9, quarry: 10, lumbermill: 11, farm: 12, house: 13,
  };
  const sorted = [...nonEmpty].sort((a, b) => (depthOrder[a.type] ?? 99) - (depthOrder[b.type] ?? 99));
  const cols = containerWidth < 340 ? 3 : containerWidth < 480 ? 4 : 5;
  const rows: Building[][] = [];
  for (let i = 0; i < sorted.length; i += cols) rows.push(sorted.slice(i, i + cols));

  // Citizens
  const totalTroops = Object.values(army).reduce((s: number, v: number) => s + v, 0);
  const totalWorkers = Object.values(workerAssignments).reduce((s: number, v: number) => s + v, 0);
  const count = Math.min(population.current, 16);
  const soldierN = Math.min(totalTroops, Math.floor(count * 0.25));
  const workerN = Math.min(totalWorkers, Math.floor(count * 0.35));
  const civN = count - soldierN - workerN;

  return (
    <div ref={containerRef} className="flex-1 relative overflow-y-auto overflow-x-hidden" style={{
      background: 'linear-gradient(180deg, #7EC8E3 0%, #A8D8EA 18%, #C5E6A6 32%, #6B9F5B 50%, #4A7C3F 100%)',
    }}>
      {/* Sky decorations */}
      <div className="absolute top-3 right-6 w-12 h-12 rounded-full pointer-events-none" style={{
        background: 'radial-gradient(circle, #FFE082 0%, #FFD54F 40%, transparent 70%)',
        boxShadow: '0 0 40px 10px rgba(255,213,79,0.3)',
      }} />

      {/* Clouds */}
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{ top: 8 + i * 18 }}
          animate={{ x: [-(i * 50 + 60), containerWidth + 60] }}
          transition={{ duration: 50 + i * 18, repeat: Infinity, ease: 'linear', delay: i * 10 }}
        >
          <div className="flex gap-px opacity-50">
            <div className="w-6 h-2.5 rounded-full bg-white/70" />
            <div className="w-10 h-3.5 rounded-full bg-white/80 -mt-0.5" />
            <div className="w-5 h-2 rounded-full bg-white/50 mt-0.5" />
          </div>
        </motion.div>
      ))}

      {/* Distant hills */}
      <svg className="absolute top-[18%] left-0 right-0 h-[12%] pointer-events-none" viewBox="0 0 400 50" preserveAspectRatio="none">
        <path d="M0 50 Q40 15 100 35 Q160 5 220 30 Q280 10 340 38 Q380 15 400 25 L400 50Z" fill="#7BAF6B" opacity="0.4" />
        <path d="M0 50 Q70 25 140 40 Q210 18 280 42 Q340 22 400 35 L400 50Z" fill="#6B9F5B" opacity="0.35" />
      </svg>

      {/* Birds */}
      {[0, 1].map(i => (
        <motion.div
          key={`bird${i}`}
          className="absolute pointer-events-none text-[6px] text-foreground/20"
          style={{ top: 30 + i * 14 }}
          animate={{ x: [containerWidth + 10, -20], y: [0, -4, 0, 3, 0] }}
          transition={{ duration: 20 + i * 8, repeat: Infinity, ease: 'linear', delay: i * 12 }}
        >
          ∿
        </motion.div>
      ))}

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

      {/* Town area */}
      <div className="relative mt-[22%] px-3 pb-36">
        {/* Subtle ground texture */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
          backgroundImage: `url(${townGround})`,
          backgroundSize: '100px',
          backgroundRepeat: 'repeat',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 20%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 20%)',
        }} />

        {/* Path running through town */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-8 pointer-events-none" style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(139,115,85,0.25) 10%, rgba(139,115,85,0.3) 90%, transparent 100%)',
          borderRadius: '50%/4px',
        }} />

        {/* Building rows */}
        {rows.map((row, ri) => (
          <div
            key={ri}
            className="flex items-end justify-center gap-1 mb-2 relative"
            style={{
              zIndex: ri + 1,
              transform: `scale(${1 - ri * 0.02})`,
              opacity: 1 - ri * 0.03,
            }}
          >
            {row.map(building => (
              <BuildingSprite
                key={building.id}
                building={building}
                sprite={getBuildingSprite(building.type as Exclude<BuildingType, 'empty'>)}
                row={ri}
              />
            ))}
          </div>
        ))}

        {/* Walking citizens */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: soldierN }).map((_, i) => (
            <WalkingCitizen key={`s${i}`} type="soldier" delay={i * 3} areaWidth={containerWidth} yBase={30 + i * 18} />
          ))}
          {Array.from({ length: workerN }).map((_, i) => (
            <WalkingCitizen key={`w${i}`} type="worker" delay={i * 2.5 + 1} areaWidth={containerWidth} yBase={50 + i * 15} />
          ))}
          {Array.from({ length: civN }).map((_, i) => (
            <WalkingCitizen key={`c${i}`} type="civilian" delay={i * 2 + 0.5} areaWidth={containerWidth} yBase={40 + i * 20} />
          ))}
        </div>
      </div>
    </div>
  );
}
