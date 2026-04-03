import { useState, useRef, useEffect, useCallback } from 'react';
import { useGame, BUILDING_INFO } from '@/hooks/useGameState';
import type { Building, BuildingType } from '@/lib/gameTypes';
import { motion, AnimatePresence } from 'framer-motion';

// Pixel-art color palette
const PALETTE = {
  sky: ['#1a1a2e', '#16213e', '#0f3460', '#533483'],
  skyDay: ['#87CEEB', '#B0E0E6', '#E0F7FA', '#FFF9C4'],
  grass: '#4a7c3f',
  grassDark: '#3d6634',
  dirt: '#8B7355',
  road: '#6B5B4B',
  shadow: 'rgba(0,0,0,0.2)',
};

// Building pixel-art renderers
const BUILDING_COLORS: Record<string, { walls: string; roof: string; accent: string }> = {
  townhall: { walls: '#C4A882', roof: '#8B4513', accent: '#FFD700' },
  house: { walls: '#DEB887', roof: '#A0522D', accent: '#F5DEB3' },
  farm: { walls: '#F5DEB3', roof: '#8B8B00', accent: '#90EE90' },
  lumbermill: { walls: '#A0522D', roof: '#654321', accent: '#DEB887' },
  quarry: { walls: '#808080', roof: '#696969', accent: '#A9A9A9' },
  goldmine: { walls: '#8B7355', roof: '#654321', accent: '#FFD700' },
  barracks: { walls: '#4A4A4A', roof: '#2F2F2F', accent: '#DC143C' },
  wall: { walls: '#808080', roof: '#696969', accent: '#A9A9A9' },
  watchtower: { walls: '#8B8682', roof: '#4A4A4A', accent: '#FFD700' },
  temple: { walls: '#F0E68C', roof: '#DAA520', accent: '#FFD700' },
  apothecary: { walls: '#9370DB', roof: '#6A0DAD', accent: '#90EE90' },
  warehouse: { walls: '#CD853F', roof: '#8B4513', accent: '#DEB887' },
  spyguild: { walls: '#2F4F4F', roof: '#1C1C1C', accent: '#7B68EE' },
  administrator: { walls: '#4682B4', roof: '#2E4057', accent: '#E8D5B7' },
};

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
  dir: number; // 0=right, 1=left
}

function drawPixelBuilding(
  ctx: CanvasRenderingContext2D,
  type: BuildingType,
  level: number,
  x: number,
  y: number,
  w: number,
  h: number,
  isSelected: boolean,
  isUpgrading: boolean,
) {
  if (type === 'empty') return;
  const colors = BUILDING_COLORS[type] || BUILDING_COLORS.house;
  const scale = Math.min(1, 0.6 + level * 0.08);
  const bw = w * scale;
  const bh = h * scale;
  const bx = x + (w - bw) / 2;
  const by = y + (h - bh);

  // Shadow
  ctx.fillStyle = PALETTE.shadow;
  ctx.fillRect(bx + 2, by + bh - 4, bw, 6);

  // Walls
  ctx.fillStyle = colors.walls;
  ctx.fillRect(bx, by + bh * 0.35, bw, bh * 0.65);

  // Door
  ctx.fillStyle = '#3E2723';
  const doorW = bw * 0.18;
  const doorH = bh * 0.25;
  ctx.fillRect(bx + bw / 2 - doorW / 2, by + bh - doorH, doorW, doorH);

  // Windows
  ctx.fillStyle = '#87CEEB';
  const winSize = Math.max(3, bw * 0.1);
  if (bw > 20) {
    ctx.fillRect(bx + bw * 0.2, by + bh * 0.5, winSize, winSize);
    ctx.fillRect(bx + bw * 0.7, by + bh * 0.5, winSize, winSize);
  }

  // Roof
  ctx.fillStyle = colors.roof;
  ctx.beginPath();
  ctx.moveTo(bx - 4, by + bh * 0.35);
  ctx.lineTo(bx + bw / 2, by);
  ctx.lineTo(bx + bw + 4, by + bh * 0.35);
  ctx.closePath();
  ctx.fill();

  // Accent details based on type
  ctx.fillStyle = colors.accent;
  if (type === 'townhall') {
    // Flag
    ctx.fillRect(bx + bw / 2 - 1, by - 8, 2, 10);
    ctx.fillRect(bx + bw / 2 + 1, by - 8, 6, 4);
  } else if (type === 'farm') {
    // Wheat
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(bx + bw + 4 + i * 4, by + bh - 8 - i * 2, 2, 8 + i * 2);
    }
  } else if (type === 'watchtower') {
    // Tall spire
    ctx.fillRect(bx + bw / 2 - 1, by - 12, 2, 14);
    ctx.fillStyle = '#FF4500';
    ctx.fillRect(bx + bw / 2 - 2, by - 14, 4, 3);
  } else if (type === 'barracks') {
    // Weapon rack
    ctx.fillRect(bx - 3, by + bh * 0.4, 2, bh * 0.4);
    ctx.fillRect(bx + bw + 1, by + bh * 0.4, 2, bh * 0.4);
  } else if (type === 'temple') {
    // Cross
    ctx.fillRect(bx + bw / 2 - 1, by - 6, 2, 8);
    ctx.fillRect(bx + bw / 2 - 3, by - 4, 6, 2);
  }

  // Level indicator
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`Lv${level}`, bx + bw / 2, by + bh + 10);

  // Selection glow
  if (isSelected) {
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx - 3, by - 3, bw + 6, bh + 6);
  }

  // Upgrading sparkle
  if (isUpgrading) {
    ctx.fillStyle = '#FFD700';
    const sparkle = Date.now() % 1000 / 1000;
    for (let i = 0; i < 3; i++) {
      const sx = bx + Math.sin(sparkle * Math.PI * 2 + i * 2) * bw * 0.4 + bw / 2;
      const sy = by + Math.cos(sparkle * Math.PI * 2 + i * 2) * bh * 0.3 + bh * 0.3;
      ctx.fillRect(sx - 1, sy - 1, 3, 3);
    }
  }
}

function drawCitizen(ctx: CanvasRenderingContext2D, c: Citizen) {
  const bodyColor = c.type === 'soldier' ? '#DC143C' : c.type === 'worker' ? '#8B4513' : c.color;
  // Head
  ctx.fillStyle = '#FFDAB9';
  ctx.fillRect(c.x - 2, c.y - 8, 4, 4);
  // Body
  ctx.fillStyle = bodyColor;
  ctx.fillRect(c.x - 2, c.y - 4, 4, 5);
  // Legs (animated)
  const legOffset = Math.sin(c.frame * 0.3) * 2;
  ctx.fillStyle = '#4A4A4A';
  ctx.fillRect(c.x - 2, c.y + 1, 2, 3 + (legOffset > 0 ? 1 : 0));
  ctx.fillRect(c.x, c.y + 1, 2, 3 + (legOffset < 0 ? 1 : 0));
  // Soldier weapon
  if (c.type === 'soldier') {
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(c.dir === 0 ? c.x + 2 : c.x - 4, c.y - 6, 2, 8);
  }
}

const CITIZEN_COLORS = ['#4169E1', '#228B22', '#DAA520', '#8B008B', '#FF6347', '#20B2AA'];

export default function CityView() {
  const { buildings, buildQueue, army, population, workerAssignments, upgradeBuilding, assignWorker, unassignWorker, isBuildingUpgrading } = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const citizensRef = useRef<Citizen[]>([]);
  const animFrameRef = useRef<number>(0);
  const [canvasSize, setCanvasSize] = useState({ w: 384, h: 500 });

  // Generate citizens based on population
  useEffect(() => {
    const count = Math.min(population.current, 40);
    const existing = citizensRef.current;
    if (existing.length === count) return;

    const soldiers = Math.min(Object.values(army).reduce((s: number, v: number) => s + v, 0), Math.floor(count * 0.3));
    const totalWorkers = Math.min(Object.values(workerAssignments).reduce((s: number, v: number) => s + v, 0), Math.floor(count * 0.4));

    const newCitizens: Citizen[] = [];
    for (let i = 0; i < count; i++) {
      const type = i < soldiers ? 'soldier' : i < soldiers + workers ? 'worker' : 'civilian';
      const x = 20 + Math.random() * (canvasSize.w - 40);
      const y = 100 + Math.random() * (canvasSize.h - 160);
      newCitizens.push({
        id: i,
        x, y,
        targetX: x,
        targetY: y,
        speed: 0.3 + Math.random() * 0.5,
        color: CITIZEN_COLORS[i % CITIZEN_COLORS.length],
        type,
        frame: Math.random() * 100,
        dir: Math.random() > 0.5 ? 0 : 1,
      });
    }
    citizensRef.current = newCitizens;
  }, [population.current, army, workerAssignments, canvasSize.w, canvasSize.h]);

  // Resize handler
  useEffect(() => {
    const resize = () => {
      const w = Math.min(window.innerWidth, 600);
      setCanvasSize({ w, h: Math.max(400, window.innerHeight - 200) });
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Layout buildings in a grid pattern
  const getLayout = useCallback(() => {
    const nonEmpty = buildings.filter(b => b.type !== 'empty');
    const cols = Math.ceil(Math.sqrt(nonEmpty.length));
    const cellW = (canvasSize.w - 40) / Math.max(cols, 1);
    const cellH = 70;
    const startY = 60;
    return nonEmpty.map((b, i) => ({
      building: b,
      x: 20 + (i % cols) * cellW,
      y: startY + Math.floor(i / cols) * (cellH + 15),
      w: cellW - 8,
      h: cellH,
    }));
  }, [buildings, canvasSize.w]);

  // Canvas click handler
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
      ctx.imageSmoothingEnabled = false;
      canvas.width = canvasSize.w;
      canvas.height = canvasSize.h;

      // Sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, canvasSize.h * 0.4);
      skyGrad.addColorStop(0, '#87CEEB');
      skyGrad.addColorStop(1, '#B0E0E6');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, canvasSize.w, canvasSize.h * 0.4);

      // Ground
      ctx.fillStyle = PALETTE.grass;
      ctx.fillRect(0, canvasSize.h * 0.3, canvasSize.w, canvasSize.h * 0.7);

      // Grass texture
      ctx.fillStyle = PALETTE.grassDark;
      for (let i = 0; i < 60; i++) {
        const gx = (i * 37 + 13) % canvasSize.w;
        const gy = canvasSize.h * 0.35 + (i * 23 + 7) % (canvasSize.h * 0.6);
        ctx.fillRect(gx, gy, 2, 3);
      }

      // Road
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(canvasSize.w * 0.45, canvasSize.h * 0.3, canvasSize.w * 0.1, canvasSize.h * 0.7);
      // Road texture
      ctx.fillStyle = PALETTE.dirt;
      for (let i = 0; i < 10; i++) {
        ctx.fillRect(canvasSize.w * 0.47, canvasSize.h * 0.35 + i * 30, 4, 8);
      }

      // Draw buildings
      const layout = getLayout();
      for (const item of layout) {
        const isUpgrading = !!isBuildingUpgrading(item.building.id);
        drawPixelBuilding(
          ctx,
          item.building.type,
          item.building.level,
          item.x,
          item.y,
          item.w,
          item.h,
          selectedBuilding?.id === item.building.id,
          isUpgrading,
        );
      }

      // Update and draw citizens
      const citizens = citizensRef.current;
      for (const c of citizens) {
        // Move toward target
        const dx = c.targetX - c.x;
        const dy = c.targetY - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 2) {
          // Pick new target
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

      // Settlement name
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
        className="w-full cursor-pointer"
        style={{ imageRendering: 'pixelated', height: canvasSize.h }}
      />

      {/* Building management panel */}
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
