import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame, TroopType, Resources } from '@/hooks/useGameState';
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

interface TerrainFeature {
  type: 'lake' | 'mountain' | 'island' | 'river';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  // River-specific
  points?: { x: number; y: number }[];
  bridgeAt?: { x: number; y: number }[];
  name: string;
}

interface SteelMine {
  id: string;
  name: string;
  x: number;
  y: number;
  steelPerTick: number;
  power: number; // garrison power to defeat
}

interface ChunkData {
  realms: ProceduralRealm[];
  events: ProceduralEvent[];
  terrain: TerrainFeature[];
  steelMines: SteelMine[];
  regionName: string;
  regionBiome: string;
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

  // Generate region name for this chunk
  const regionName = generateRegionName(rng);
  const regionBiome = BIOME_TYPES[Math.floor(rng() * BIOME_TYPES.length)];

  // 0-2 realms per chunk
  const realmCount = rng() < 0.3 ? 0 : rng() < 0.7 ? 1 : 2;
  const realms: ProceduralRealm[] = [];
  for (let i = 0; i < realmCount; i++) {
    const emojiIdx = Math.floor(rng() * REALM_EMOJIS.length);
    const typeRoll = rng();
    const type = typeRoll < 0.4 ? 'hostile' : typeRoll < 0.7 ? 'neutral' : 'friendly';
    const basePower = 50 + Math.floor(rng() * 300);
    realms.push({
      id: `realm-${chunkX}-${chunkY}-${i}`,
      name: generateName(rng),
      ruler: generateRulerName(rng),
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

  // ── Terrain features ──
  const LAKE_NAMES = ['Mirror Lake', 'Lake Sorrow', 'Azure Pool', 'Dead Mere', 'Crystal Waters', 'Shadow Pond', 'Moonwell', 'Serpent Lake', 'Frozen Tarn', 'Emerald Basin'];
  const MTN_NAMES = ['Mt. Dread', 'Frostpeak', 'Ironjaw Summit', 'The Spire', 'Ashcrown', 'Thunder Ridge', 'Skullcap Peak', 'Dragonspine', 'The Anvil', 'Stormbreak'];
  const RIVER_NAMES = ['River Styx', 'Goldrun', 'Silvervein', 'The Serpent', 'Whitewater', 'Blackflow', 'Crimson Creek', 'Mistbrook', 'Thornstream', 'Deepchannel'];
  const ISLAND_NAMES = ['Isle of Bones', 'Verdant Atoll', 'Skull Rock', 'Trader\'s Rest', 'Phantom Isle', 'Coral Haven', 'Driftwood Key', 'Ember Isle', 'Windward Cay', 'Smuggler\'s Den'];

  const terrain: TerrainFeature[] = [];

  // Lakes (0-2 per chunk, more in Coast/Marsh/Jungle biomes)
  const lakeChance = regionBiome === 'Coast' || regionBiome === 'Marsh' || regionBiome === 'Jungle' ? 0.8 : 0.35;
  const lakeCount = rng() < lakeChance ? (rng() < 0.4 ? 2 : 1) : 0;
  for (let i = 0; i < lakeCount; i++) {
    terrain.push({
      type: 'lake',
      x: worldBaseX + 8000 + rng() * (CHUNK_SIZE - 16000),
      y: worldBaseY + 8000 + rng() * (CHUNK_SIZE - 16000),
      width: 4000 + rng() * 10000,
      height: 3000 + rng() * 7000,
      rotation: rng() * 360,
      name: LAKE_NAMES[Math.floor(rng() * LAKE_NAMES.length)],
    });
  }

  // Mountains (0-3 per chunk, more in Highlands/Tundra/Badlands)
  const mtnChance = regionBiome === 'Highlands' || regionBiome === 'Tundra' || regionBiome === 'Badlands' ? 0.9 : 0.3;
  const mtnCount = rng() < mtnChance ? 1 + Math.floor(rng() * 3) : 0;
  for (let i = 0; i < mtnCount; i++) {
    terrain.push({
      type: 'mountain',
      x: worldBaseX + 5000 + rng() * (CHUNK_SIZE - 10000),
      y: worldBaseY + 5000 + rng() * (CHUNK_SIZE - 10000),
      width: 3000 + rng() * 8000,
      height: 3000 + rng() * 8000,
      name: MTN_NAMES[Math.floor(rng() * MTN_NAMES.length)],
    });
  }

  // Rivers (0-1 per chunk, with bridges)
  if (rng() < 0.45) {
    const riverPoints: { x: number; y: number }[] = [];
    const segments = 5 + Math.floor(rng() * 4);
    const startEdge = Math.floor(rng() * 4); // 0=top, 1=right, 2=bottom, 3=left
    let rx = worldBaseX, ry = worldBaseY;
    if (startEdge === 0) { rx = worldBaseX + rng() * CHUNK_SIZE; ry = worldBaseY; }
    else if (startEdge === 1) { rx = worldBaseX + CHUNK_SIZE; ry = worldBaseY + rng() * CHUNK_SIZE; }
    else if (startEdge === 2) { rx = worldBaseX + rng() * CHUNK_SIZE; ry = worldBaseY + CHUNK_SIZE; }
    else { rx = worldBaseX; ry = worldBaseY + rng() * CHUNK_SIZE; }
    riverPoints.push({ x: rx, y: ry });
    for (let s = 1; s <= segments; s++) {
      const t = s / segments;
      const targetX = startEdge === 1 ? worldBaseX : startEdge === 3 ? worldBaseX + CHUNK_SIZE : worldBaseX + rng() * CHUNK_SIZE;
      const targetY = startEdge === 0 ? worldBaseY + CHUNK_SIZE : startEdge === 2 ? worldBaseY : worldBaseY + rng() * CHUNK_SIZE;
      rx = rx + (targetX - rx) * t + (rng() - 0.5) * 8000;
      ry = ry + (targetY - ry) * t + (rng() - 0.5) * 8000;
      rx = Math.max(worldBaseX, Math.min(worldBaseX + CHUNK_SIZE, rx));
      ry = Math.max(worldBaseY, Math.min(worldBaseY + CHUNK_SIZE, ry));
      riverPoints.push({ x: rx, y: ry });
    }
    // Place 1-2 bridges along the river
    const bridges: { x: number; y: number }[] = [];
    const bridgeCount = 1 + Math.floor(rng() * 2);
    for (let b = 0; b < bridgeCount; b++) {
      const idx = 1 + Math.floor(rng() * (riverPoints.length - 2));
      bridges.push(riverPoints[idx]);
    }
    terrain.push({
      type: 'river',
      x: riverPoints[0].x,
      y: riverPoints[0].y,
      width: 800 + rng() * 1500,
      height: 0,
      points: riverPoints,
      bridgeAt: bridges,
      name: RIVER_NAMES[Math.floor(rng() * RIVER_NAMES.length)],
    });
  }

  // Islands (only in Coast biome or near lakes, 0-1)
  if (regionBiome === 'Coast' || (lakeCount > 0 && rng() < 0.4)) {
    terrain.push({
      type: 'island',
      x: worldBaseX + 10000 + rng() * (CHUNK_SIZE - 20000),
      y: worldBaseY + 10000 + rng() * (CHUNK_SIZE - 20000),
      width: 3000 + rng() * 6000,
      height: 2000 + rng() * 4000,
      rotation: rng() * 360,
      name: ISLAND_NAMES[Math.floor(rng() * ISLAND_NAMES.length)],
    });
  }

  // Steel mines (0-1 per chunk, more common in Highlands/Badlands)
  const MINE_NAMES = ['Iron Vein', 'Deep Forge', 'Obsidian Pit', 'Steelcrag Mine', 'The Black Seam', 'Titan\'s Quarry', 'Shadowsteel Delve', 'Ore Hollow', 'Molten Core', 'The Crucible'];
  const steelMines: SteelMine[] = [];
  const mineChance = regionBiome === 'Highlands' || regionBiome === 'Badlands' ? 0.6 : regionBiome === 'Tundra' ? 0.4 : 0.15;
  if (rng() < mineChance) {
    steelMines.push({
      id: `mine-${chunkX}-${chunkY}`,
      name: MINE_NAMES[Math.floor(rng() * MINE_NAMES.length)],
      x: worldBaseX + 8000 + rng() * (CHUNK_SIZE - 16000),
      y: worldBaseY + 8000 + rng() * (CHUNK_SIZE - 16000),
      steelPerTick: 1 + Math.floor(rng() * 3 * difficultyMult),
      power: Math.floor((30 + rng() * 80) * difficultyMult),
    });
  }

  return { realms, events, terrain, steelMines, regionName, regionBiome };
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
  | { kind: 'mine'; data: SteelMine }
  | null;

export default function WorldMap() {
  const { allVillages, addResources, addSteel, army, totalArmyPower, attackTarget } = useGame();
  const { user } = useAuth();
  const [selected, setSelected] = useState<SelectedItem>(null);
  const [claimedEvents, setClaimedEvents] = useState<Set<string>>(new Set());
  const [capturedMines, setCapturedMines] = useState<Set<string>>(new Set());
  const [marches, setMarches] = useState<{ id: string; targetName: string; arrivalTime: number; action: () => void }[]>([]);
  const [tradeContracts, setTradeContracts] = useState<{ realmId: string; realmName: string; expiresAt: number; bonus: Partial<Record<string, number>> }[]>([]);

  // Steel production from captured mines
  useEffect(() => {
    if (capturedMines.size === 0) return;
    const interval = setInterval(() => {
      let totalSteel = 0;
      // Find all captured mines across visible chunks and sum steel
      for (const mineId of capturedMines) {
        // Parse chunk coords from mine id
        const parts = mineId.split('-');
        const cx = parseInt(parts[1]), cy = parseInt(parts[2]);
        const chunk = getChunk(cx, cy);
        const mine = chunk.steelMines.find(m => m.id === mineId);
        if (mine) totalSteel += mine.steelPerTick;
      }
      if (totalSteel > 0) addSteel(totalSteel);
    }, 10000); // every 10s
    return () => clearInterval(interval);
  }, [capturedMines, addSteel]);

  // Process marches
  useEffect(() => {
    if (marches.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setMarches(prev => {
        const arrived = prev.filter(m => m.arrivalTime <= now);
        const remaining = prev.filter(m => m.arrivalTime > now);
        arrived.forEach(m => {
          toast.success(`Troops arrived at ${m.targetName}!`);
          m.action();
        });
        return remaining;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [marches.length]);

  // Expire trade contracts
  useEffect(() => {
    if (tradeContracts.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setTradeContracts(prev => {
        const expired = prev.filter(c => c.expiresAt <= now);
        expired.forEach(c => toast.info(`Trade contract with ${c.realmName} has expired.`));
        return prev.filter(c => c.expiresAt > now);
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [tradeContracts.length]);

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

  const getPlayerPos = (id: string) => {
    // Deterministic position based solely on village id — no index dependency
    let h = 5381;
    for (let i = 0; i < id.length; i++) {
      h = ((h << 5) + h + id.charCodeAt(i)) >>> 0;
    }
    const h2 = ((h * 2654435761) >>> 0);
    return { x: 80000 + (h % 40000), y: 80000 + (h2 % 40000) };
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

  const calcTravelTime = useCallback((targetX: number, targetY: number) => {
    // Player is near center (100k, 100k). Distance in world units → seconds
    const myPos = user ? getPlayerPos(allVillages.find(v => v.village.user_id === user.id)?.village.id || 'me') : { x: 100000, y: 100000 };
    const dist = Math.sqrt(Math.pow(targetX - myPos.x, 2) + Math.pow(targetY - myPos.y, 2));
    return Math.max(5, Math.floor(dist / 2000)); // min 5 seconds
  }, [user, allVillages]);

  const handleAttackNPC = useCallback((realm: ProceduralRealm) => {
    const hasTroops = Object.values(army).some(v => v > 0);
    if (!hasTroops) { toast.error('You need troops to attack!'); return; }
    const travelSec = calcTravelTime(realm.x, realm.y);
    const arrivalTime = Date.now() + travelSec * 1000;
    toast(`⚔️ Troops marching to ${realm.name}... ETA ${travelSec}s`);
    setMarches(prev => [...prev, {
      id: `atk-${Date.now()}`, targetName: realm.name, arrivalTime,
      action: () => {
        const log = attackTarget(realm.name, realm.power);
        if (log.result === 'victory') toast.success(`Victory against ${realm.name}!`);
        else toast.error(`Defeated by ${realm.name}!`);
      },
    }]);
    setSelected(null);
  }, [army, attackTarget, calcTravelTime]);

  const handleEnvoy = useCallback((realm: ProceduralRealm) => {
    // Check if already have a trade contract with this realm
    if (tradeContracts.some(c => c.realmId === realm.id)) {
      toast.error('You already have a trade contract with this realm!'); return;
    }
    const tribute = { gold: Math.floor(realm.power * 0.3) };
    addResources({ gold: -tribute.gold });
    const travelSec = calcTravelTime(realm.x, realm.y);

    toast(`📜 Envoy dispatched to ${realm.name}... ETA ${travelSec}s`);
    const arrivalTime = Date.now() + travelSec * 1000;
    setMarches(prev => [...prev, {
      id: `envoy-${Date.now()}`, targetName: realm.name, arrivalTime,
      action: () => {
        // Create time-limited trade contract (2-5 minutes based on realm power)
        const contractDuration = (120 + Math.floor(realm.power * 0.6)) * 1000; // ms
        const bonusPerTick = realm.type === 'friendly'
          ? { gold: Math.floor(realm.power * 0.05), food: Math.floor(realm.power * 0.03) }
          : { gold: Math.floor(realm.power * 0.02), wood: Math.floor(realm.power * 0.02) };
        setTradeContracts(prev => [...prev, {
          realmId: realm.id,
          realmName: realm.name,
          expiresAt: Date.now() + contractDuration,
          bonus: bonusPerTick,
        }]);
        toast.success(`Trade contract with ${realm.name} established! (${Math.floor(contractDuration / 1000)}s)`);
      },
    }]);
    setSelected(null);
  }, [addResources, calcTravelTime, tradeContracts]);

  // Collect trade contract resources periodically
  useEffect(() => {
    if (tradeContracts.length === 0) return;
    const interval = setInterval(() => {
      tradeContracts.forEach(c => {
        if (Date.now() < c.expiresAt) {
          addResources(c.bonus as Partial<Resources>);
        }
      });
    }, 10000); // every 10 seconds
    return () => clearInterval(interval);
  }, [tradeContracts, addResources]);

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
        <h2 className="font-display text-sm text-foreground text-shadow-gold">Map</h2>
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
          {marches.length > 0 && <span className="text-primary animate-pulse">🚶{marches.length} marching</span>}
          {tradeContracts.length > 0 && <span className="text-food">📜{tradeContracts.length} trades</span>}
          <span>⚔️{power.attack} 🛡️{power.defense}</span>
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

        {/* ── Terrain Features ── */}
        {visibleChunks.map(chunk => chunk.data.terrain.map((t, ti) => {
          if (t.type === 'lake') {
            const { sx, sy } = worldToScreen(t.x, t.y);
            const w = t.width * camera.ppu;
            const h = t.height * camera.ppu;
            if (w < 6 && h < 6) return null;
            const labelSize = Math.max(7, Math.min(13, w / 6));
            return (
              <div key={`lake-${chunk.cx}-${chunk.cy}-${ti}`} className="absolute pointer-events-none"
                style={{ left: sx, top: sy, transform: `translate(-50%, -50%) rotate(${t.rotation || 0}deg)` }}>
                <div style={{ width: w, height: h, borderRadius: '50%', background: 'radial-gradient(ellipse, hsl(200 70% 45% / 0.5), hsl(210 80% 30% / 0.25) 70%, transparent)', boxShadow: '0 0 20px hsl(200 70% 45% / 0.2)', border: '1px solid hsl(200 60% 50% / 0.15)' }} />
                {w > 30 && (
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-sky-200/60 whitespace-nowrap"
                    style={{ fontSize: labelSize, transform: `translate(-50%, -50%) rotate(${-(t.rotation || 0)}deg)` }}>
                    🌊 {t.name}
                  </span>
                )}
              </div>
            );
          }
          if (t.type === 'mountain') {
            const { sx, sy } = worldToScreen(t.x, t.y);
            const w = t.width * camera.ppu;
            const h = t.height * camera.ppu;
            if (w < 6) return null;
            const labelSize = Math.max(7, Math.min(12, w / 5));
            return (
              <div key={`mtn-${chunk.cx}-${chunk.cy}-${ti}`} className="absolute pointer-events-none"
                style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)' }}>
                <svg width={w} height={h} viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
                  <polygon points="50,5 10,95 90,95" fill="hsl(30 20% 35% / 0.4)" stroke="hsl(30 30% 50% / 0.3)" strokeWidth={1.5} />
                  <polygon points="50,5 40,30 60,30" fill="hsl(210 20% 85% / 0.5)" stroke="none" />
                  <polygon points="35,50 20,95 50,95" fill="hsl(30 15% 30% / 0.25)" stroke="none" />
                </svg>
                {w > 25 && (
                  <span className="absolute left-1/2 whitespace-nowrap font-display text-amber-200/50" style={{ fontSize: labelSize, bottom: -labelSize - 2, transform: 'translateX(-50%)' }}>
                    ⛰️ {t.name}
                  </span>
                )}
              </div>
            );
          }
          if (t.type === 'island') {
            const { sx, sy } = worldToScreen(t.x, t.y);
            const w = t.width * camera.ppu;
            const h = t.height * camera.ppu;
            if (w < 8) return null;
            const labelSize = Math.max(7, Math.min(11, w / 5));
            return (
              <div key={`isle-${chunk.cx}-${chunk.cy}-${ti}`} className="absolute pointer-events-none"
                style={{ left: sx, top: sy, transform: `translate(-50%, -50%) rotate(${t.rotation || 0}deg)` }}>
                {/* Water around island */}
                <div style={{ width: w * 1.5, height: h * 1.5, borderRadius: '50%', background: 'radial-gradient(ellipse, hsl(200 65% 40% / 0.35), transparent 70%)', position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />
                {/* Island mass */}
                <div style={{ width: w, height: h, borderRadius: '45% 55% 60% 40% / 50% 45% 55% 50%', background: 'radial-gradient(ellipse, hsl(100 35% 40% / 0.6), hsl(80 30% 30% / 0.4))', border: '1px solid hsl(50 40% 55% / 0.2)', position: 'relative', zIndex: 1 }} />
                {w > 25 && (
                  <span className="absolute left-1/2 whitespace-nowrap font-display text-emerald-200/50"
                    style={{ fontSize: labelSize, bottom: -labelSize - 4, transform: `translateX(-50%) rotate(${-(t.rotation || 0)}deg)`, zIndex: 2 }}>
                    🏝️ {t.name}
                  </span>
                )}
              </div>
            );
          }
          if (t.type === 'river' && t.points && t.points.length > 1) {
            const screenPoints = t.points.map(p => worldToScreen(p.x, p.y));
            // Check if any point is visible
            const anyVisible = screenPoints.some(p => p.sx > -200 && p.sx < containerSize.w + 200 && p.sy > -200 && p.sy < containerSize.h + 200);
            if (!anyVisible) return null;
            const strokeW = Math.max(2, t.width * camera.ppu);
            // Build SVG path
            let d = `M ${screenPoints[0].sx} ${screenPoints[0].sy}`;
            for (let i = 1; i < screenPoints.length; i++) {
              const prev = screenPoints[i - 1];
              const cur = screenPoints[i];
              const cpx = (prev.sx + cur.sx) / 2 + (i % 2 === 0 ? 10 : -10);
              const cpy = (prev.sy + cur.sy) / 2;
              d += ` Q ${cpx} ${cpy} ${cur.sx} ${cur.sy}`;
            }
            const labelSize = Math.max(8, Math.min(12, strokeW * 2));
            const midIdx = Math.floor(screenPoints.length / 2);
            const midPt = screenPoints[midIdx];
            return (
              <div key={`river-${chunk.cx}-${chunk.cy}-${ti}`} className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
                <svg className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
                  {/* River glow */}
                  <path d={d} fill="none" stroke="hsl(200 70% 50% / 0.15)" strokeWidth={strokeW * 3} strokeLinecap="round" strokeLinejoin="round" />
                  {/* River body */}
                  <path d={d} fill="none" stroke="hsl(205 75% 45% / 0.45)" strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />
                  {/* River highlight */}
                  <path d={d} fill="none" stroke="hsl(195 80% 65% / 0.2)" strokeWidth={strokeW * 0.4} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {/* River name */}
                {strokeW > 3 && (
                  <span className="absolute font-display text-sky-300/40 whitespace-nowrap" style={{ left: midPt.sx, top: midPt.sy - strokeW - 4, fontSize: labelSize, transform: 'translateX(-50%)' }}>
                    {t.name}
                  </span>
                )}
                {/* Bridges */}
                {t.bridgeAt?.map((bp, bi) => {
                  const { sx: bsx, sy: bsy } = worldToScreen(bp.x, bp.y);
                  const bridgeW = Math.max(12, strokeW * 2.5);
                  if (bridgeW < 8) return null;
                  return (
                    <div key={`bridge-${bi}`} className="absolute flex flex-col items-center" style={{ left: bsx, top: bsy, transform: 'translate(-50%, -50%)', zIndex: 5 }}>
                      <div style={{
                        width: bridgeW,
                        height: bridgeW * 0.5,
                        background: 'linear-gradient(180deg, hsl(30 40% 50% / 0.7), hsl(25 35% 35% / 0.6))',
                        borderRadius: `${bridgeW * 0.5}px ${bridgeW * 0.5}px 2px 2px`,
                        border: '1px solid hsl(30 30% 60% / 0.4)',
                        boxShadow: '0 2px 6px hsl(0 0% 0% / 0.3)',
                      }} />
                      {bridgeW > 15 && <span style={{ fontSize: 7 }} className="text-amber-200/50 mt-0.5">🌉</span>}
                    </div>
                  );
                })}
              </div>
            );
          }
          return null;
        }))}

        {visibleChunks.map(chunk => {
          const centerX = chunk.cx * CHUNK_SIZE + CHUNK_SIZE / 2;
          const centerY = chunk.cy * CHUNK_SIZE + CHUNK_SIZE / 2;
          const { sx, sy } = worldToScreen(centerX, centerY);
          const regionSize = CHUNK_SIZE * camera.ppu;
          if (regionSize < 40) return null; // too small to show label
          const biomeEmoji = REGION_EMOJIS[chunk.data.regionBiome] || '🗺️';
          const labelFontSize = Math.max(10, Math.min(18, regionSize / 8));
          return (
            <div key={`region-${chunk.cx}-${chunk.cy}`}
              className="absolute pointer-events-none flex flex-col items-center opacity-40"
              style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)' }}>
              <span style={{ fontSize: labelFontSize * 1.2 }}>{biomeEmoji}</span>
              <span className="font-display text-foreground/50 whitespace-nowrap text-center" style={{ fontSize: labelFontSize }}>
                {chunk.data.regionName}
              </span>
            </div>
          );
        })}

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

        {/* Steel Mines */}
        {visibleChunks.map(chunk => chunk.data.steelMines.map(mine => {
          if (!isVisible(mine.x, mine.y, 60)) return null;
          const { sx, sy } = worldToScreen(mine.x, mine.y);
          const isCaptured = capturedMines.has(mine.id);
          return (
            <button key={mine.id} data-map-item
              onClick={(e) => { e.stopPropagation(); setSelected({ kind: 'mine', data: mine }); }}
              className={`absolute z-20 rounded-lg border-2 flex items-center justify-center shadow-md ${
                isCaptured ? 'border-primary/60 bg-primary/20 animate-pulse-gold' : 'border-muted-foreground/40 bg-muted/60'
              }`}
              style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)', width: eventSize, height: eventSize, fontSize: eventSize * 0.5 }}>
              ⚙️
            </button>
          );
        }))}

        {allVillages.map((pv) => {
          const pos = getPlayerPos(pv.village.id);
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
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ background: 'hsl(200 70% 45% / 0.5)' }} /><span className="text-foreground">Water</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5" style={{ background: 'hsl(30 20% 35% / 0.6)', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} /><span className="text-foreground">Mountain</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ background: 'hsl(100 35% 40% / 0.6)' }} /><span className="text-foreground">Island</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-1" style={{ background: 'hsl(205 75% 45% / 0.6)', borderRadius: 2 }} /><span className="text-foreground">River</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded border border-muted-foreground/40 bg-muted/60 flex items-center justify-center text-[6px]">⚙️</div><span className="text-foreground">Steel Mine</span></div>
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
                        📜 Trade Deal 💰{Math.floor(selected.data.power * 0.3)}
                      </motion.button>
                    )}
                    {tradeContracts.some(c => c.realmId === selected.data.id) && (
                      <span className="text-[9px] text-food font-bold">📜 Active Trade</span>
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
                      onClick={() => {
                        const targetId = selected.data.village.user_id;
                        const targetName = selected.data.profile.display_name;
                        setSelected(null);
                        // Dispatch custom event to switch to messages tab with this player
                        window.dispatchEvent(new CustomEvent('open-dm', { detail: { userId: targetId, name: targetName } }));
                      }}
                      className="flex-1 bg-primary/20 text-primary font-display text-[10px] py-1.5 rounded-lg">
                      📨 Message
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        const hasTroops = Object.values(army).some(v => v > 0);
                        if (!hasTroops) { toast.error('You need troops to attack!'); return; }
                        const targetPos = getPlayerPos(selected.data.village.id);
                        const travelSec = calcTravelTime(targetPos.x, targetPos.y);
                        toast(`⚔️ Troops marching... ETA ${travelSec}s`);
                        setMarches(prev => [...prev, {
                          id: `pvp-${Date.now()}`, targetName: selected.data.village.name, arrivalTime: Date.now() + travelSec * 1000,
                          action: () => {
                            const log = attackTarget(selected.data.village.name, selected.data.village.level * 30);
                            if (log.result === 'victory') toast.success('Victory!');
                            else toast.error('Defeat!');
                          },
                        }]);
                        setSelected(null);
                      }}
                      className="flex-1 bg-destructive/20 text-destructive font-display text-[10px] py-1.5 rounded-lg">
                      ⚔️ Attack
                    </motion.button>
                  </div>
                )}
              </div>
            )}

            {selected.kind === 'mine' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">⚙️</span>
                  <div className="flex-1">
                    <h3 className="font-display text-sm text-foreground">{selected.data.name}</h3>
                    <p className="text-[10px] text-muted-foreground">Steel Mine · Produces ⚙️{selected.data.steelPerTick}/tick</p>
                  </div>
                  {capturedMines.has(selected.data.id) && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary">✅ Captured</span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {capturedMines.has(selected.data.id)
                    ? 'This mine is under your control and producing steel.'
                    : `Defeat the garrison (⚔️${selected.data.power}) to capture this mine and start producing steel.`}
                </p>
                {!capturedMines.has(selected.data.id) && (
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      const hasTroops = Object.values(army).some(v => v > 0);
                      if (!hasTroops) { toast.error('You need troops to capture a mine!'); return; }
                      const travelSec = calcTravelTime(selected.data.x, selected.data.y);
                      const mineData = selected.data;
                      toast(`⚔️ Troops marching to ${mineData.name}... ETA ${travelSec}s`);
                      setMarches(prev => [...prev, {
                        id: `mine-${Date.now()}`, targetName: mineData.name, arrivalTime: Date.now() + travelSec * 1000,
                        action: () => {
                          const log = attackTarget(mineData.name, mineData.power);
                          if (log.result === 'victory') {
                            setCapturedMines(prev => new Set([...prev, mineData.id]));
                            toast.success(`⚙️ ${mineData.name} captured! Producing steel.`);
                          } else {
                            toast.error('Defeat! The garrison held.');
                          }
                        },
                      }]);
                      setSelected(null);
                    }}
                    className="w-full bg-primary text-primary-foreground font-display text-[10px] py-1.5 rounded-lg glow-gold-sm">
                    ⚔️ Capture Mine (Garrison: ⚔️{selected.data.power})
                  </motion.button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
