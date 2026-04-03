import { useState, useRef, useEffect, useCallback } from 'react';
import { useGame, BUILDING_INFO } from '@/hooks/useGameState';
import type { Building, BuildingType } from '@/lib/gameTypes';
import { motion, AnimatePresence } from 'framer-motion';
import { BUILDING_SPRITES } from './sprites';
import { useTroopSkins } from '@/hooks/useTroopSkins';

interface Citizen {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  color: string;
  type: 'worker' | 'soldier' | 'civilian';
  frame: number;
  dir: number;
}

const CITIZEN_COLORS = ['#4169E1', '#228B22', '#DAA520', '#8B008B', '#FF6347', '#20B2AA'];

function drawCitizen(ctx: CanvasRenderingContext2D, c: Citizen) {
  const bodyColor = c.type === 'soldier' ? '#DC143C' : c.type === 'worker' ? '#8B4513' : c.color;
  ctx.fillStyle = '#FFDAB9';
  ctx.fillRect(c.x - 2, c.y - 8, 4, 4);
  ctx.fillStyle = bodyColor;
  ctx.fillRect(c.x - 2, c.y - 4, 4, 5);
  const legOffset = Math.sin(c.frame * 0.3) * 2;
  ctx.fillStyle = '#4A4A4A';
  ctx.fillRect(c.x - 2, c.y + 1, 2, 3 + (legOffset > 0 ? 1 : 0));
  ctx.fillRect(c.x, c.y + 1, 2, 3 + (legOffset < 0 ? 1 : 0));
  if (c.type === 'soldier') {
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(c.dir === 0 ? c.x + 2 : c.x - 4, c.y - 6, 2, 8);
  }
}

export default function CityView() {
  const { buildings, buildQueue, army, population, workerAssignments, upgradeBuilding, assignWorker, unassignWorker, isBuildingUpgrading, getMaxWorkers } = useGame();
  const { getBuildingSprite } = useTroopSkins();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const citizensRef = useRef<Citizen[]>([]);
  const animFrameRef = useRef<number>(0);
  const spriteImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [canvasSize, setCanvasSize] = useState({ w: 384, h: 500 });

  // Preload building sprite images for canvas
  useEffect(() => {
    const nonEmpty = buildings.filter(b => b.type !== 'empty');
    const types = [...new Set(nonEmpty.map(b => b.type))] as Exclude<BuildingType, 'empty'>[];
    for (const type of types) {
      if (spriteImagesRef.current.has(type)) continue;
      const src = getBuildingSprite(type);
      const img = new Image();
      img.src = src;
      spriteImagesRef.current.set(type, img);
    }
  }, [buildings, getBuildingSprite]);

  // Generate citizens
  useEffect(() => {
    const count = Math.min(population.current, 40);
    const existing = citizensRef.current;
    if (existing.length === count) return;

    const soldierCount = Math.min(
      Object.values(army).reduce((s: number, v: number) => s + v, 0),
      Math.floor(count * 0.3)
    );
    const workerCount = Math.min(
      Object.values(workerAssignments).reduce((s: number, v: number) => s + v, 0),
      Math.floor(count * 0.4)
    );

    const newCitizens: Citizen[] = [];
    for (let i = 0; i < count; i++) {
      const type = i < soldierCount ? 'soldier' : i < soldierCount + workerCount ? 'worker' : 'civilian';
      const x = 20 + Math.random() * (canvasSize.w - 40);
      const y = canvasSize.h * 0.45 + Math.random() * (canvasSize.h * 0.45);
      newCitizens.push({
        id: i, x, y, targetX: x, targetY: y,
        speed: 0.3 + Math.random() * 0.5,
        color: CITIZEN_COLORS[i % CITIZEN_COLORS.length],
        type, frame: Math.random() * 100, dir: Math.random() > 0.5 ? 0 : 1,
      });
    }
    citizensRef.current = newCitizens;
  }, [population.current, army, workerAssignments, canvasSize]);

  useEffect(() => {
    const resize = () => {
      const w = Math.min(window.innerWidth, 600);
      setCanvasSize({ w, h: Math.max(400, window.innerHeight - 200) });
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Layout buildings
  const getLayout = useCallback(() => {
    const nonEmpty = buildings.filter(b => b.type !== 'empty');
    const cols = Math.ceil(Math.sqrt(nonEmpty.length));
    const cellW = (canvasSize.w - 40) / Math.max(cols, 1);
    const cellH = 70;
    const startY = 60;
    return nonEmpty.map((b, i) => ({
      building: b,
      x: 20 + (i % cols) * cellW,
      y: startY + Math.floor(i / cols) * (cellH + 20),
      w: cellW - 8,
      h: cellH,
    }));
  }, [buildings, canvasSize.w]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const layout = getLayout();
    for (const item of layout) {
      if (mx >= item.x && mx <= item.x + item.w && my >= item.y && my <= item.y + item.h + 12) {
        setSelectedBuilding(item.building);
        return;
      }
    }
    setSelectedBuilding(null);
  }, [getLayout]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    const render = () => {
      if (!running) return;
      canvas.width = canvasSize.w;
      canvas.height = canvasSize.h;

      // Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, canvasSize.h * 0.4);
      skyGrad.addColorStop(0, '#87CEEB');
      skyGrad.addColorStop(1, '#B0E0E6');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, canvasSize.w, canvasSize.h * 0.4);

      // Ground
      ctx.fillStyle = '#4a7c3f';
      ctx.fillRect(0, canvasSize.h * 0.3, canvasSize.w, canvasSize.h * 0.7);

      // Grass detail
      ctx.fillStyle = '#3d6634';
      for (let i = 0; i < 60; i++) {
        const gx = (i * 37 + 13) % canvasSize.w;
        const gy = canvasSize.h * 0.35 + (i * 23 + 7) % (canvasSize.h * 0.6);
        ctx.fillRect(gx, gy, 2, 3);
      }

      // Road
      ctx.fillStyle = '#6B5B4B';
      ctx.fillRect(canvasSize.w * 0.45, canvasSize.h * 0.3, canvasSize.w * 0.1, canvasSize.h * 0.7);
      ctx.fillStyle = '#8B7355';
      for (let i = 0; i < 10; i++) {
        ctx.fillRect(canvasSize.w * 0.47, canvasSize.h * 0.35 + i * 30, 4, 8);
      }

      // Draw buildings using sprites
      const layout = getLayout();
      for (const item of layout) {
        const type = item.building.type as Exclude<BuildingType, 'empty'>;
        const img = spriteImagesRef.current.get(type);
        const isUpgrading = !!isBuildingUpgrading(item.building.id);
        const isSelected = selectedBuilding?.id === item.building.id;
        const scale = Math.min(1, 0.6 + item.building.level * 0.08);
        const bw = item.w * scale;
        const bh = item.h * scale;
        const bx = item.x + (item.w - bw) / 2;
        const by = item.y + (item.h - bh);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(bx + 2, by + bh - 4, bw, 6);

        // Draw sprite image
        if (img && img.complete) {
          if (isUpgrading) {
            ctx.globalAlpha = 0.5;
          }
          ctx.drawImage(img, bx, by, bw, bh);
          ctx.globalAlpha = 1;

          // Upgrading sparkle
          if (isUpgrading) {
            ctx.fillStyle = '#FFD700';
            const sparkle = Date.now() % 1000 / 1000;
            for (let s = 0; s < 3; s++) {
              const sx = bx + Math.sin(sparkle * Math.PI * 2 + s * 2) * bw * 0.4 + bw / 2;
              const sy = by + Math.cos(sparkle * Math.PI * 2 + s * 2) * bh * 0.3 + bh * 0.3;
              ctx.fillRect(sx - 1, sy - 1, 3, 3);
            }
          }
        } else {
          // Fallback rectangle
          ctx.fillStyle = '#C4A882';
          ctx.fillRect(bx, by, bw, bh);
        }

        // Selection glow
        if (isSelected) {
          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 2;
          ctx.strokeRect(bx - 3, by - 3, bw + 6, bh + 6);
        }

        // Level label
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 3;
        ctx.fillText(`Lv${item.building.level}`, bx + bw / 2, by + bh + 10);
        ctx.shadowBlur = 0;
      }

      // Citizens
      const citizens = citizensRef.current;
      for (const c of citizens) {
        const dx = c.targetX - c.x;
        const dy = c.targetY - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 2) {
          c.targetX = 20 + Math.random() * (canvasSize.w - 40);
          c.targetY = canvasSize.h * 0.4 + Math.random() * (canvasSize.h * 0.5);
        } else {
          c.x += (dx / dist) * c.speed;
          c.y += (dy / dist) * c.speed;
          c.dir = dx > 0 ? 0 : 1;
        }
        c.frame++;
        drawCitizen(ctx, c);
      }

      // HUD
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(`Population: ${population.current}/${population.max}`, canvasSize.w / 2, 20);
      ctx.fillText(`Happiness: ${population.happiness}%`, canvasSize.w / 2, 36);
      ctx.shadowBlur = 0;

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => { running = false; cancelAnimationFrame(animFrameRef.current); };
  }, [canvasSize, buildings, selectedBuilding, getLayout, population, isBuildingUpgrading]);

  const selectedInfo = selectedBuilding && selectedBuilding.type !== 'empty'
    ? BUILDING_INFO[selectedBuilding.type]
    : null;
  const upgrading = selectedBuilding ? isBuildingUpgrading(selectedBuilding.id) : undefined;
  const workers = selectedBuilding ? (workerAssignments[selectedBuilding.id] || 0) : 0;

  return (
    <div className="flex flex-col h-full">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full cursor-pointer flex-1"
        style={{ imageRendering: 'auto' }}
      />

      <AnimatePresence>
        {selectedBuilding && selectedInfo && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="game-panel border-t border-primary/30 p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{selectedInfo.icon}</span>
                <div>
                  <h3 className="font-display text-sm font-bold text-foreground">{selectedInfo.name}</h3>
                  <span className="text-[10px] text-muted-foreground">Level {selectedBuilding.level}/{selectedInfo.maxLevel}</span>
                </div>
              </div>
              <button onClick={() => setSelectedBuilding(null)} className="text-muted-foreground text-xs">✕</button>
            </div>

            <p className="text-[10px] text-muted-foreground">{selectedInfo.description}</p>

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
                    disabled={workers <= 0}
                    className="px-2 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs disabled:opacity-30"
                  >−</button>
                  <span className="text-xs font-display text-foreground min-w-[40px] text-center">
                    👷 {workers}
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
