import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame, TroopType } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// ── Seeded random for deterministic procedural generation ──
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashCoords(cx: number, cy: number, salt = 0): number {
  let h = 2166136261 ^ salt;
  h = Math.imul(h ^ cx, 16777619);
  h = Math.imul(h ^ cy, 16777619);
  return h >>> 0;
}

// ── Chunk-based procedural world ──
const CHUNK_SIZE = 50000; // world units per chunk

interface ChunkData {
  realms: ProceduralRealm[];
  events: ProceduralEvent[];
}

interface ProceduralRealm {
  id: string;
  name: string;
  ruler: string;
  power: number;
  x: number;
  y: number;
  emoji: string;
  type: 'hostile' | 'neutral' | 'friendly';
  desc: string;
  territory: number;
}

interface ProceduralEvent {
  id: string;
  name: string;
  description: string;
  emoji: string;
  x: number;
  y: number;
  type: 'danger' | 'opportunity' | 'mystery';
  reward: { gold?: number; wood?: number; stone?: number; food?: number };
  power: number;
}

// ── Procedural name generation ──
const NAME_PREFIXES = ['Iron', 'Thorn', 'Ash', 'Frost', 'Sun', 'Shadow', 'Storm', 'Ember', 'Moon', 'Dusk', 'Bright', 'Black', 'Silver', 'Rot', 'Jade', 'Wind', 'Deep', 'Star', 'Crimson', 'Gold', 'Obsidian', 'Whispering', 'Crystal', 'Verdant', 'Blighted', 'Mist', 'Dragon', 'Blood', 'Raven', 'Oak', 'Copper', 'Ghost', 'Hollow', 'Grim', 'Stone', 'Wolf', 'Bone', 'Flame', 'Silk', 'Rust'];
const NAME_MIDS = ['wood', 'fall', 'gate', 'spire', 'maw', 'port', 'fen', 'reach', 'moor', 'thorn', 'claw', 'veil', 'stone', 'shade', 'helm', 'vale', 'haven', 'peak', 'brook', 'ford', 'mere', 'glen', 'ridge', 'holm', 'dell', 'crest', 'bane', 'mark', 'burn', 'wold'];
const NAME_SUFFIXES = ['Dominion', 'Enclave', 'Citadel', 'Hold', 'Sanctum', 'Coven', 'Wastes', 'Forge', 'Ruins', 'Marshes', 'Eyrie', 'Republic', 'Horde', 'Depths', 'Keep', 'Abbey', 'Bastion', 'Bog', 'Garrison', 'Plateau', 'Mines', 'Grotto', 'Kingdom', 'Reach', 'Barony', 'Expanse'];

const RULER_TITLES = ['King', 'Queen', 'Elder', 'Warlord', 'Jarl', 'High Priestess', 'Baron', 'Duchess', 'Archmage', 'Prophet', 'Khan', 'Commander', 'Lord', 'Lady', 'Chancellor', 'Chieftain'];
const RULER_FIRST = ['Valthor', 'Cindra', 'Solara', 'Mordrath', 'Sirena', 'Kragg', 'Miretha', 'Aethon', 'Thalia', 'Auric', 'Prismo', 'Ignatius', 'Nightbloom', 'Steelgaze', 'Lunaris', 'Hrimfaxi', 'Draven', 'Serith', 'Kael', 'Ysolde', 'Tharion', 'Morgause', 'Balric', 'Fennara', 'Ozrik', 'Veyra', 'Quillan', 'Ashara', 'Tormund', 'Lirael'];

const REALM_EMOJIS = ['👑', '🌿', '🔥', '❄️', '☀️', '🐉', '🌙', '⚓', '💀', '🌊', '🔨', '🏛️', '🐊', '⚡', '🏰', '🐺', '💎', '⛪', '🦅', '🕸️'];

// ── Region / biome name generation ──
const BIOME_TYPES = ['Plains', 'Highlands', 'Marsh', 'Desert', 'Tundra', 'Forest', 'Steppe', 'Badlands', 'Coast', 'Jungle'];
const BIOME_ADJECTIVES = ['Scorched', 'Frozen', 'Verdant', 'Ashen', 'Golden', 'Twilight', 'Shattered', 'Ancient', 'Cursed', 'Sacred', 'Howling', 'Silent', 'Bleeding', 'Ethereal', 'Sunken', 'Wailing', 'Eternal', 'Forsaken', 'Glimmering', 'Savage'];

function generateName(rng: () => number): string {
  const style = rng();
  if (style < 0.4) {
    // "Prefix + Mid + Suffix" e.g. "Irongate Hold"
    return `${NAME_PREFIXES[Math.floor(rng() * NAME_PREFIXES.length)]}${NAME_MIDS[Math.floor(rng() * NAME_MIDS.length)]} ${NAME_SUFFIXES[Math.floor(rng() * NAME_SUFFIXES.length)]}`;
  } else if (style < 0.7) {
    // "The Prefix Suffix" e.g. "The Crimson Wastes"
    return `The ${NAME_PREFIXES[Math.floor(rng() * NAME_PREFIXES.length)]} ${NAME_SUFFIXES[Math.floor(rng() * NAME_SUFFIXES.length)]}`;
  } else {
    // "Prefix's Mid" e.g. "Dragon's Reach"
    const prefix = NAME_PREFIXES[Math.floor(rng() * NAME_PREFIXES.length)];
    const suffix = NAME_SUFFIXES[Math.floor(rng() * NAME_SUFFIXES.length)];
    return `${prefix}'s ${suffix}`;
  }
}

function generateRulerName(rng: () => number): string {
  return `${RULER_TITLES[Math.floor(rng() * RULER_TITLES.length)]} ${RULER_FIRST[Math.floor(rng() * RULER_FIRST.length)]}`;
}

function generateRegionName(rng: () => number): string {
  const adj = BIOME_ADJECTIVES[Math.floor(rng() * BIOME_ADJECTIVES.length)];
  const biome = BIOME_TYPES[Math.floor(rng() * BIOME_TYPES.length)];
  return `${adj} ${biome}`;
}

const REGION_EMOJIS: Record<string, string> = {
  Plains: '🌾', Highlands: '⛰️', Marsh: '🐸', Desert: '🏜️', Tundra: '🧊',
  Forest: '🌲', Steppe: '🌿', Badlands: '🌋', Coast: '⚓', Jungle: '🌴',
};
const EVENT_TEMPLATES = [
  { name: 'Goblin Raid', description: 'A horde of goblins terrorizes nearby.', emoji: '👺', type: 'danger' as const, power: 40 },
  { name: 'Ancient Ruins', description: 'Crumbling ruins with hidden treasures.', emoji: '🏛️', type: 'mystery' as const, power: 30 },
  { name: 'Wandering Merchant', description: 'A rare merchant offers exotic goods.', emoji: '🧙', type: 'opportunity' as const, power: 0 },
  { name: 'Dragon Sighting', description: 'A young dragon roams. Slay or tame it?', emoji: '🐲', type: 'danger' as const, power: 100 },
  { name: 'Harvest Festival', description: 'A nearby village celebrates harvest.', emoji: '🎪', type: 'opportunity' as const, power: 0 },
  { name: 'Dark Portal', description: 'A mysterious portal pulses with energy.', emoji: '🌀', type: 'mystery' as const, power: 80 },
  { name: 'Bandit Camp', description: 'Bandits block a trade route. Clear them!', emoji: '🗡️', type: 'danger' as const, power: 50 },
  { name: 'Lost Caravan', description: 'An abandoned supply caravan. Claim it!', emoji: '🏕️', type: 'opportunity' as const, power: 0 },
  { name: 'Cursed Tomb', description: 'An ancient tomb emanates eerie glow.', emoji: '⚰️', type: 'mystery' as const, power: 70 },
  { name: 'Sacred Grove', description: 'A hidden grove with magical energy.', emoji: '✨', type: 'opportunity' as const, power: 0 },
  { name: 'Orc Warband', description: 'Orcs march towards settlements!', emoji: '👹', type: 'danger' as const, power: 60 },
  { name: 'Fairy Ring', description: 'Mysterious mushroom circle glows.', emoji: '🍄', type: 'mystery' as const, power: 20 },
  { name: 'Iron Deposits', description: 'Rich mineral veins discovered!', emoji: '⛰️', type: 'opportunity' as const, power: 0 },
  { name: 'Pirate Cove', description: 'Pirates hoard stolen treasure here.', emoji: '🏴‍☠️', type: 'danger' as const, power: 90 },
];

function generateChunk(chunkX: number, chunkY: number): ChunkData {
  const seed = hashCoords(chunkX, chunkY, 42);
  const rng = seededRandom(seed);
  const worldBaseX = chunkX * CHUNK_SIZE;
  const worldBaseY = chunkY * CHUNK_SIZE;

  // Distance from origin affects difficulty
  const dist = Math.sqrt(chunkX * chunkX + chunkY * chunkY);
  const difficultyMult = 1 + dist * 0.15;

  // 0-2 realms per chunk
  const realmCount = rng() < 0.3 ? 0 : rng() < 0.7 ? 1 : 2;
  const realms: ProceduralRealm[] = [];
  for (let i = 0; i < realmCount; i++) {
    const nameIdx = Math.floor(rng() * REALM_NAMES.length);
    const rulerIdx = Math.floor(rng() * RULER_NAMES.length);
    const emojiIdx = Math.floor(rng() * REALM_EMOJIS.length);
    const typeRoll = rng();
    const type = typeRoll < 0.4 ? 'hostile' : typeRoll < 0.7 ? 'neutral' : 'friendly';
    const basePower = 50 + Math.floor(rng() * 300);
    realms.push({
      id: `realm-${chunkX}-${chunkY}-${i}`,
      name: REALM_NAMES[nameIdx],
      ruler: RULER_NAMES[rulerIdx],
      power: Math.floor(basePower * difficultyMult),
      x: worldBaseX + 5000 + rng() * (CHUNK_SIZE - 10000),
      y: worldBaseY + 5000 + rng() * (CHUNK_SIZE - 10000),
      emoji: REALM_EMOJIS[emojiIdx],
      type,
      desc: `A ${type} kingdom in the ${dist < 3 ? 'heartlands' : dist < 8 ? 'frontier' : 'deep wilds'}. Power grows with distance from the center.`,
      territory: 6000 + Math.floor(rng() * 14000),
    });
  }

  // 1-4 events per chunk
  const eventCount = 1 + Math.floor(rng() * 4);
  const events: ProceduralEvent[] = [];
  for (let i = 0; i < eventCount; i++) {
    const tplIdx = Math.floor(rng() * EVENT_TEMPLATES.length);
    const tpl = EVENT_TEMPLATES[tplIdx];
    const rewardMult = difficultyMult;
    events.push({
      ...tpl,
      id: `event-${chunkX}-${chunkY}-${i}`,
      power: Math.floor(tpl.power * difficultyMult),
      x: worldBaseX + 2000 + rng() * (CHUNK_SIZE - 4000),
      y: worldBaseY + 2000 + rng() * (CHUNK_SIZE - 4000),
      reward: {
        gold: Math.floor((50 + rng() * 200) * rewardMult),
        wood: tpl.type === 'opportunity' ? Math.floor((30 + rng() * 100) * rewardMult) : 0,
        stone: tpl.type === 'mystery' ? Math.floor((40 + rng() * 120) * rewardMult) : 0,
        food: tpl.type === 'opportunity' ? Math.floor((30 + rng() * 80) * rewardMult) : 0,
      },
    });
  }

  return { realms, events };
}

// ── Chunk cache ──
const chunkCache = new Map<string, ChunkData>();
function getChunk(cx: number, cy: number): ChunkData {
  const key = `${cx},${cy}`;
  if (!chunkCache.has(key)) {
    chunkCache.set(key, generateChunk(cx, cy));
    // Evict old chunks if cache gets too large
    if (chunkCache.size > 200) {
      const first = chunkCache.keys().next().value;
      if (first) chunkCache.delete(first);
    }
  }
  return chunkCache.get(key)!;
}

const TYPE_COLORS = { hostile: 'bg-destructive', neutral: 'bg-muted-foreground', friendly: 'bg-food' };
const EVENT_COLORS = { danger: 'border-destructive/60 bg-destructive/20', opportunity: 'border-primary/60 bg-primary/20', mystery: 'border-accent/60 bg-accent/20' };

type SelectedItem =
  | { kind: 'npc'; data: ProceduralRealm }
  | { kind: 'event'; data: ProceduralEvent; chunkKey: string; index: number }
  | { kind: 'player'; data: any }
  | null;

export default function WorldMap() {
  const { allVillages, addResources, army, totalArmyPower, attackTarget } = useGame();
  const { user } = useAuth();
  const [selected, setSelected] = useState<SelectedItem>(null);
  const [claimedEvents, setClaimedEvents] = useState<Set<string>>(new Set());

  const DEFAULT_CAMERA = { cx: 100000, cy: 100000, ppu: 0.003 };
  const [camera, setCamera] = useState(DEFAULT_CAMERA);
  const safeSetCamera = useCallback((updater: (prev: typeof DEFAULT_CAMERA) => typeof DEFAULT_CAMERA) => {
    setCamera(prev => {
      const safe = prev ?? DEFAULT_CAMERA;
      return updater(safe);
    });
  }, []);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const lastTouchDist = useRef<number | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 400, h: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const worldToScreen = useCallback((wx: number, wy: number) => ({
    sx: (wx - camera.cx) * camera.ppu + containerSize.w / 2,
    sy: (wy - camera.cy) * camera.ppu + containerSize.h / 2,
  }), [camera, containerSize]);

  const isVisible = useCallback((wx: number, wy: number, margin = 60) => {
    const { sx, sy } = worldToScreen(wx, wy);
    return sx > -margin && sx < containerSize.w + margin && sy > -margin && sy < containerSize.h + margin;
  }, [worldToScreen, containerSize]);

  // ── Determine visible chunks ──
  const visibleChunks = useMemo(() => {
    const { w, h } = containerSize;
    if (w === 0 || h === 0) return [];
    const halfW = w / 2 / camera.ppu;
    const halfH = h / 2 / camera.ppu;
    const minCX = Math.floor((camera.cx - halfW) / CHUNK_SIZE);
    const maxCX = Math.floor((camera.cx + halfW) / CHUNK_SIZE);
    const minCY = Math.floor((camera.cy - halfH) / CHUNK_SIZE);
    const maxCY = Math.floor((camera.cy + halfH) / CHUNK_SIZE);

    // Cap to max ~30 visible chunks to avoid rendering too many elements
    const rangeX = maxCX - minCX + 1;
    const rangeY = maxCY - minCY + 1;
    if (rangeX * rangeY > 30) {
      // Too zoomed out — show only nearby chunks
      const r = 2;
      const ccx = Math.floor(camera.cx / CHUNK_SIZE);
      const ccy = Math.floor(camera.cy / CHUNK_SIZE);
      const chunks: { cx: number; cy: number; data: ChunkData }[] = [];
      for (let x = ccx - r; x <= ccx + r; x++) {
        for (let y = ccy - r; y <= ccy + r; y++) {
          chunks.push({ cx: x, cy: y, data: getChunk(x, y) });
        }
      }
      return chunks;
    }

    const chunks: { cx: number; cy: number; data: ChunkData }[] = [];
    for (let x = minCX; x <= maxCX; x++) {
      for (let y = minCY; y <= maxCY; y++) {
        chunks.push({ cx: x, cy: y, data: getChunk(x, y) });
      }
    }
    return chunks;
  }, [camera.cx, camera.cy, camera.ppu, containerSize]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-map-item]')) return;
    dragStart.current = { x: e.clientX, y: e.clientY, cx: camera.cx, cy: camera.cy };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [camera]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragStart.current;
    if (!drag) return;

    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    const startCx = drag.cx;
    const startCy = drag.cy;

    safeSetCamera(prev => ({
      ...prev,
      cx: startCx - dx / prev.ppu,
      cy: startCy - dy / prev.ppu,
    }));
  }, [safeSetCamera]);

  const handlePointerUp = useCallback(() => { dragStart.current = null; }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      lastTouchDist.current = d;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDist.current) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const scale = d / lastTouchDist.current;
      safeSetCamera(prev => ({ ...prev, ppu: Math.max(0.00005, Math.min(0.05, prev.ppu * scale)) }));
      lastTouchDist.current = d;
    }
  }, [safeSetCamera]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.85 : 1.18;
    safeSetCamera(prev => ({ ...prev, ppu: Math.max(0.00005, Math.min(0.05, prev.ppu * factor)) }));
  }, [safeSetCamera]);

  const getPlayerPos = (id: string, index: number) => {
    const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return { x: 80000 + (hash * 1300 + index * 13700) % 40000, y: 80000 + (hash * 1700 + index * 17300) % 40000 };
  };

  const goHome = useCallback(() => {
    setCamera({ cx: 100000, cy: 100000, ppu: 0.003 });
  }, []);

  const handleInvestigate = useCallback((event: ProceduralEvent) => {
    if (claimedEvents.has(event.id)) return;
    const hasTroops = Object.values(army).some(v => v > 0);
    if (event.power > 0 && !hasTroops) { toast.error('You need troops to investigate dangerous events!'); return; }
    if (event.power > 0) {
      const log = attackTarget(event.name, event.power);
      if (log.result === 'victory') {
        addResources(event.reward);
        setClaimedEvents(prev => new Set(prev).add(event.id));
        toast.success(`Victory at ${event.name}! Resources gained.`);
      } else {
        toast.error(`Defeated at ${event.name}! Your troops suffered losses.`);
      }
    } else {
      addResources(event.reward);
      setClaimedEvents(prev => new Set(prev).add(event.id));
      toast.success(`${event.name} — Resources claimed!`);
    }
    setSelected(null);
  }, [army, attackTarget, addResources, claimedEvents]);

  const handleAttackNPC = useCallback((realm: ProceduralRealm) => {
    const hasTroops = Object.values(army).some(v => v > 0);
    if (!hasTroops) { toast.error('You need troops to attack!'); return; }
    const log = attackTarget(realm.name, realm.power);
    if (log.result === 'victory') {
      toast.success(`Victory against ${realm.name}! Spoils of war collected.`);
    } else {
      toast.error(`Defeated by ${realm.name}! Retreat and rebuild.`);
    }
    setSelected(null);
  }, [army, attackTarget]);

  const handleEnvoy = useCallback((realm: ProceduralRealm) => {
    const tribute = { gold: Math.floor(realm.power * 0.3) };
    addResources({ gold: -tribute.gold });
    const reward = realm.type === 'friendly'
      ? { gold: Math.floor(realm.power * 0.5), food: Math.floor(realm.power * 0.3) }
      : { gold: Math.floor(realm.power * 0.2), wood: Math.floor(realm.power * 0.15) };
    setTimeout(() => {
      addResources(reward);
      toast.success(`${realm.name} accepted your envoy! Trade deal secured.`);
    }, 1000);
    toast('Envoy dispatched with tribute...');
    setSelected(null);
  }, [addResources]);

  const power = totalArmyPower();
  const iconSize = Math.max(24, Math.min(64, camera.ppu * 8000));
  const fontSize = Math.max(9, Math.min(14, camera.ppu * 3000));
  const eventSize = Math.max(20, Math.min(48, camera.ppu * 6000));

  // Collect all visible realms and events from chunks
  const visibleRealms: ProceduralRealm[] = [];
  const visibleEvents: ProceduralEvent[] = [];
  for (const chunk of visibleChunks) {
    for (const realm of chunk.data.realms) {
      if (isVisible(realm.x, realm.y, 100)) visibleRealms.push(realm);
    }
    for (const event of chunk.data.events) {
      if (!claimedEvents.has(event.id) && isVisible(event.x, event.y, 60)) visibleEvents.push(event);
    }
  }

  // Cap rendered items when very zoomed out
  const maxItems = 60;
  const renderRealms = visibleRealms.slice(0, maxItems);
  const renderEvents = visibleEvents.slice(0, maxItems);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-3 pt-2 pb-1 flex items-center justify-between">
        <h2 className="font-display text-sm text-foreground text-shadow-gold">World Map</h2>
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
          <span>⚔️{power.attack} 🛡️{power.defense}</span>
          <span>×{(camera.ppu * 1000).toFixed(1)}</span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing touch-none"
        style={{ background: 'linear-gradient(135deg, hsl(var(--map-bg-1)), hsl(var(--map-bg-2)), hsl(var(--map-bg-3)))' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onWheel={handleWheel}
      >
        {/* Grid lines — capped count */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
          {(() => {
            const w = containerSize.w;
            const h = containerSize.h;
            if (w === 0 || h === 0) return null;
            // Adaptive grid step — ensure max ~20 lines per axis
            const viewW = w / camera.ppu;
            const rawStep = viewW / 8;
            const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
            const gridStep = rawStep / mag < 2 ? mag : rawStep / mag < 5 ? mag * 2 : mag * 5;

            const lines: JSX.Element[] = [];
            const startX = Math.floor((camera.cx - w / 2 / camera.ppu) / gridStep) * gridStep;
            const endX = camera.cx + w / 2 / camera.ppu;
            const startY = Math.floor((camera.cy - h / 2 / camera.ppu) / gridStep) * gridStep;
            const endY = camera.cy + h / 2 / camera.ppu;

            let count = 0;
            const MAX_LINES = 40;
            for (let gx = startX; gx <= endX && count < MAX_LINES; gx += gridStep) {
              const { sx } = worldToScreen(gx, 0);
              lines.push(<line key={`gx-${gx}`} x1={sx} y1={0} x2={sx} y2={h} stroke="hsl(42 72% 52% / 0.08)" strokeWidth={1} />);
              lines.push(<text key={`lx-${gx}`} x={sx + 4} y={14} fill="hsl(42 72% 52% / 0.3)" fontSize={10} fontFamily="Inter">{(gx / 1000).toFixed(0)}k</text>);
              count++;
            }
            for (let gy = startY; gy <= endY && count < MAX_LINES * 2; gy += gridStep) {
              const { sy } = worldToScreen(0, gy);
              lines.push(<line key={`gy-${gy}`} x1={0} y1={sy} x2={w} y2={sy} stroke="hsl(42 72% 52% / 0.08)" strokeWidth={1} />);
              lines.push(<text key={`ly-${gy}`} x={4} y={sy - 4} fill="hsl(42 72% 52% / 0.3)" fontSize={10} fontFamily="Inter">{(gy / 1000).toFixed(0)}k</text>);
              count++;
            }
            return lines;
          })()}
        </svg>

        {/* Territory circles */}
        {renderRealms.map(realm => {
          const { sx, sy } = worldToScreen(realm.x, realm.y);
          const r = realm.territory * camera.ppu;
          if (r < 3) return null;
          const borderColor = realm.type === 'hostile' ? 'hsl(0 72% 50% / 0.15)' : realm.type === 'friendly' ? 'hsl(130 45% 40% / 0.15)' : 'hsl(216 12% 50% / 0.15)';
          return (
            <div key={`t-${realm.id}`} className="absolute rounded-full pointer-events-none"
              style={{ left: sx - r, top: sy - r, width: r * 2, height: r * 2, background: `radial-gradient(circle, ${borderColor}, transparent 70%)` }} />
          );
        })}

        {/* NPC Realms */}
        {renderRealms.map(realm => {
          const { sx, sy } = worldToScreen(realm.x, realm.y);
          return (
            <button key={realm.id} data-map-item
              onClick={(e) => { e.stopPropagation(); setSelected({ kind: 'npc', data: realm }); }}
              className="absolute flex flex-col items-center z-10 hover:z-20"
              style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)' }}>
              <div className={`rounded-full ${TYPE_COLORS[realm.type]} flex items-center justify-center shadow-lg border-2 border-background/30`}
                style={{ width: iconSize, height: iconSize, fontSize: iconSize * 0.5 }}>
                {realm.emoji}
              </div>
              {iconSize > 28 && (
                <div className="text-center bg-background/80 rounded mt-0.5 px-1.5 py-0.5">
                  <p className="font-display text-foreground leading-tight whitespace-nowrap" style={{ fontSize: Math.max(8, fontSize - 2) }}>{realm.name}</p>
                  <p className="text-muted-foreground" style={{ fontSize: Math.max(7, fontSize - 3) }}>⚔️{realm.power}</p>
                </div>
              )}
              {realm.type === 'hostile' && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-destructive animate-pulse border border-background" />
              )}
            </button>
          );
        })}

        {/* Events */}
        {renderEvents.map((event) => {
          const { sx, sy } = worldToScreen(event.x, event.y);
          return (
            <button key={event.id} data-map-item
              onClick={(e) => { e.stopPropagation(); setSelected({ kind: 'event', data: event, chunkKey: '', index: 0 }); }}
              className={`absolute z-20 rounded-full border-2 ${EVENT_COLORS[event.type]} flex items-center justify-center shadow-md animate-float`}
              style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)', width: eventSize, height: eventSize, fontSize: eventSize * 0.5 }}>
              {event.emoji}
            </button>
          );
        })}

        {/* Player villages */}
        {allVillages.map((pv, i) => {
          const pos = getPlayerPos(pv.village.id, i);
          if (!isVisible(pos.x, pos.y, 80)) return null;
          const { sx, sy } = worldToScreen(pos.x, pos.y);
          const isMe = pv.village.user_id === user?.id;
          return (
            <button key={pv.village.id} data-map-item
              onClick={(e) => { e.stopPropagation(); setSelected({ kind: 'player', data: pv }); }}
              className="absolute z-30 flex flex-col items-center hover:z-40"
              style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)' }}>
              <div className={`rounded-lg flex items-center justify-center shadow-lg ${
                isMe ? 'bg-primary animate-pulse-gold ring-2 ring-primary/50' : 'bg-secondary border border-border'
              }`} style={{ width: iconSize * 0.9, height: iconSize * 0.9, fontSize: iconSize * 0.45 }}>🏰</div>
              {iconSize > 28 && (
                <div className="text-center bg-background/80 rounded mt-0.5 px-1 py-0.5">
                  <p className="font-display text-foreground whitespace-nowrap" style={{ fontSize: Math.max(7, fontSize - 2) }}>{isMe ? '⭐ You' : pv.profile.display_name}</p>
                  <p className="text-muted-foreground" style={{ fontSize: Math.max(6, fontSize - 3) }}>Lv.{pv.village.level}</p>
                </div>
              )}
            </button>
          );
        })}

        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-50">
          <button onClick={() => safeSetCamera(prev => ({ ...prev, ppu: Math.min(0.05, prev.ppu * 1.5) }))}
            className="w-8 h-8 game-panel border-glow rounded-lg flex items-center justify-center text-foreground text-sm font-bold">+</button>
          <button onClick={() => safeSetCamera(prev => ({ ...prev, ppu: Math.max(0.00005, prev.ppu / 1.5) }))}
            className="w-8 h-8 game-panel border-glow rounded-lg flex items-center justify-center text-foreground text-sm font-bold">−</button>
          <button onClick={goHome}
            className="w-8 h-8 game-panel border-glow rounded-lg flex items-center justify-center text-foreground text-[9px]">⌂</button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg p-2 space-y-1 text-[8px] z-50 border border-border">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-destructive" /><span className="text-foreground">Hostile</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-muted-foreground" /><span className="text-foreground">Neutral</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-food" /><span className="text-foreground">Friendly</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full border border-primary bg-primary/20" /><span className="text-foreground">Event</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-lg bg-secondary" /><span className="text-foreground">Player</span></div>
        </div>
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-14 inset-x-0 z-50 mx-3 game-panel border-glow rounded-xl p-3">
            <button onClick={() => setSelected(null)} className="absolute top-2 right-2 text-muted-foreground text-xs">✕</button>

            {selected.kind === 'npc' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">{selected.data.emoji}</span>
                  <div className="flex-1">
                    <h3 className="font-display text-sm text-foreground">{selected.data.name}</h3>
                    <p className="text-[10px] text-muted-foreground">Ruled by {selected.data.ruler}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    selected.data.type === 'hostile' ? 'bg-destructive/20 text-destructive' :
                    selected.data.type === 'friendly' ? 'bg-food/20 text-food' : 'bg-muted text-muted-foreground'
                  }`}>{selected.data.type}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{selected.data.desc}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-foreground font-bold">⚔️ Power: {selected.data.power}</span>
                  <div className="flex gap-1.5">
                    {selected.data.type !== 'hostile' && (
                      <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleEnvoy(selected.data)}
                        className="bg-primary/20 text-primary font-display text-[10px] py-1.5 px-3 rounded-lg">
                        Send Envoy 💰{Math.floor(selected.data.power * 0.3)}
                      </motion.button>
                    )}
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleAttackNPC(selected.data)}
                      className="bg-destructive/20 text-destructive font-display text-[10px] py-1.5 px-3 rounded-lg">
                      ⚔️ Attack
                    </motion.button>
                  </div>
                </div>
              </div>
            )}

            {selected.kind === 'event' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">{selected.data.emoji}</span>
                  <div className="flex-1">
                    <h3 className="font-display text-sm text-foreground">{selected.data.name}</h3>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      selected.data.type === 'danger' ? 'bg-destructive/20 text-destructive' :
                      selected.data.type === 'opportunity' ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent-foreground'
                    }`}>{selected.data.type}{selected.data.power > 0 ? ` ⚔️${selected.data.power}` : ''}</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">{selected.data.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5 text-[10px] text-primary font-bold">
                    {Object.entries(selected.data.reward).filter(([, v]) => v && v > 0).map(([k, v]) => (
                      <span key={k}>+{v} {k}</span>
                    ))}
                  </div>
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => handleInvestigate(selected.data)}
                    className="bg-primary text-primary-foreground font-display text-[10px] py-1.5 px-4 rounded-lg glow-gold-sm">
                    {selected.data.power > 0 ? '⚔️ Fight & Claim' : '✋ Claim'}
                  </motion.button>
                </div>
              </div>
            )}

            {selected.kind === 'player' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">🏰</span>
                  <div>
                    <h3 className="font-display text-sm text-foreground">{selected.data.village.name}</h3>
                    <p className="text-[10px] text-muted-foreground">{selected.data.profile.display_name} • Lv.{selected.data.village.level}</p>
                  </div>
                </div>
                {selected.data.village.user_id !== user?.id && (
                  <div className="flex gap-2">
                    <motion.button whileTap={{ scale: 0.95 }}
                      className="flex-1 bg-primary/20 text-primary font-display text-[10px] py-1.5 rounded-lg">
                      📨 Message
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        const hasTroops = Object.values(army).some(v => v > 0);
                        if (!hasTroops) { toast.error('You need troops to attack!'); return; }
                        attackTarget(selected.data.village.name, selected.data.village.level * 30);
                        toast.success('Attack launched!');
                        setSelected(null);
                      }}
                      className="flex-1 bg-destructive/20 text-destructive font-display text-[10px] py-1.5 rounded-lg">
                      ⚔️ Attack
                    </motion.button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
