/**
 * World Generation: Continent-based world with oceans
 * 
 * 5 continents separated by large oceans.
 * Central continent is where all players start.
 */

// ── Seeded random ──
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Simple 1D noise for coastline wobble ──
function noise1D(x: number, seed: number): number {
  const rng = seededRandom(Math.abs(Math.floor(x * 100)) + seed);
  return rng() * 2 - 1; // -1 to 1
}

function smoothNoise(angle: number, seed: number, octaves = 3): number {
  let val = 0;
  let amp = 1;
  let freq = 1;
  let maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    const a = Math.floor(angle * freq * 10);
    const frac = (angle * freq * 10) - a;
    const v0 = noise1D(a, seed + i * 1000);
    const v1 = noise1D(a + 1, seed + i * 1000);
    val += amp * (v0 * (1 - frac) + v1 * frac);
    maxAmp += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / maxAmp;
}

// ── Continent Definitions ──
export interface Continent {
  id: string;
  name: string;
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  rotation: number; // degrees
  biome: string;
  biomeSecondary: string;
  description: string;
  emoji: string;
  seed: number; // for coastline noise
  // Large-scale terrain features baked into the continent
  mountainRanges: { x1: number; y1: number; x2: number; y2: number; width: number; name: string }[];
  majorRivers: { points: { x: number; y: number }[]; width: number; name: string }[];
}

// Central continent where players spawn
// ~300k radius = ~2.3 phone screens across at default zoom
// Ocean gaps of ~1.2M units = ~9.4 phone screens of open water
export const CONTINENTS: Continent[] = [
  {
    id: 'heartlands',
    name: 'The Heartlands',
    centerX: 100000,
    centerY: 100000,
    radiusX: 320000,
    radiusY: 280000,
    rotation: -8,
    biome: 'Plains',
    biomeSecondary: 'Forest',
    description: 'The fertile central continent where civilizations first arose. Rich farmland and dense forests.',
    emoji: '🌾',
    seed: 42,
    mountainRanges: [
      { x1: -50000, y1: -120000, x2: 200000, y2: -80000, width: 30000, name: 'The Iron Spine' },
      { x1: 220000, y1: 0, x2: 280000, y2: 180000, width: 25000, name: 'Eastern Ramparts' },
    ],
    majorRivers: [
      { points: [
        { x: 100000, y: -180000 },
        { x: 80000, y: -80000 },
        { x: 120000, y: 20000 },
        { x: 60000, y: 100000 },
        { x: 90000, y: 200000 },
        { x: 70000, y: 300000 },
      ], width: 1500, name: 'The Lifevein' },
    ],
  },
  {
    id: 'frostpeaks',
    name: 'The Frostpeaks',
    centerX: 80000,
    centerY: -1500000,
    radiusX: 280000,
    radiusY: 240000,
    rotation: 12,
    biome: 'Tundra',
    biomeSecondary: 'Highlands',
    description: 'A frozen continent of towering peaks and eternal glaciers. Hardy peoples eke out a living.',
    emoji: '🧊',
    seed: 137,
    mountainRanges: [
      { x1: -100000, y1: -1600000, x2: 200000, y2: -1550000, width: 40000, name: 'The Worldspine' },
      { x1: 50000, y1: -1450000, x2: 180000, y2: -1300000, width: 35000, name: 'Glaciercrown Range' },
    ],
    majorRivers: [
      { points: [
        { x: 150000, y: -1650000 },
        { x: 100000, y: -1500000 },
        { x: 50000, y: -1380000 },
        { x: -30000, y: -1300000 },
      ], width: 1200, name: 'Frostmelt River' },
    ],
  },
  {
    id: 'sunscorch',
    name: 'The Sunscorch',
    centerX: 1600000,
    centerY: 50000,
    radiusX: 300000,
    radiusY: 260000,
    rotation: -15,
    biome: 'Desert',
    biomeSecondary: 'Badlands',
    description: 'An arid continent of vast dunes, ancient ruins, and oasis cities. The sun reigns supreme.',
    emoji: '🏜️',
    seed: 256,
    mountainRanges: [
      { x1: 1400000, y1: -60000, x2: 1500000, y2: 120000, width: 35000, name: 'The Sandwall' },
      { x1: 1650000, y1: 100000, x2: 1800000, y2: 200000, width: 28000, name: 'Scorchpeak Mesa' },
    ],
    majorRivers: [
      { points: [
        { x: 1500000, y: -100000 },
        { x: 1550000, y: 0 },
        { x: 1600000, y: 80000 },
        { x: 1700000, y: 150000 },
      ], width: 1200, name: 'The Mirage Run' },
    ],
  },
  {
    id: 'jadewilds',
    name: 'The Jade Wilds',
    centerX: 200000,
    centerY: 1600000,
    radiusX: 260000,
    radiusY: 230000,
    rotation: 20,
    biome: 'Jungle',
    biomeSecondary: 'Coast',
    description: 'A lush tropical continent choked with ancient jungles, teeming with exotic creatures.',
    emoji: '🌴',
    seed: 389,
    mountainRanges: [
      { x1: 100000, y1: 1500000, x2: 300000, y2: 1520000, width: 25000, name: 'Cloudveil Peaks' },
    ],
    majorRivers: [
      { points: [
        { x: 300000, y: 1450000 },
        { x: 250000, y: 1550000 },
        { x: 200000, y: 1620000 },
        { x: 130000, y: 1700000 },
        { x: 80000, y: 1780000 },
      ], width: 1500, name: 'The Emerald Serpent' },
      { points: [
        { x: 50000, y: 1500000 },
        { x: 100000, y: 1580000 },
        { x: 200000, y: 1620000 },
      ], width: 1000, name: 'Jade Tributary' },
    ],
  },
  {
    id: 'ashlands',
    name: 'The Ashlands',
    centerX: -1400000,
    centerY: 150000,
    radiusX: 270000,
    radiusY: 250000,
    rotation: 5,
    biome: 'Badlands',
    biomeSecondary: 'Marsh',
    description: 'A scarred continent of volcanic wastes and toxic marshes. Rich in minerals but perilous.',
    emoji: '🌋',
    seed: 512,
    mountainRanges: [
      { x1: -1550000, y1: 50000, x2: -1350000, y2: 80000, width: 30000, name: 'Ashspine Ridge' },
      { x1: -1300000, y1: 100000, x2: -1250000, y2: 300000, width: 25000, name: 'The Black Teeth' },
    ],
    majorRivers: [
      { points: [
        { x: -1500000, y: 0 },
        { x: -1450000, y: 100000 },
        { x: -1380000, y: 200000 },
        { x: -1300000, y: 300000 },
      ], width: 1200, name: 'Sulfur Creek' },
    ],
  },
];

export const CENTRAL_CONTINENT = CONTINENTS[0]; // Heartlands

// ── Continent detection ──
// Uses rotated ellipse with noise-based coastline wobble

function rotatePoint(px: number, py: number, cx: number, cy: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: dx * cos + dy * sin,
    y: -dx * sin + dy * cos,
  };
}

/**
 * Returns how "deep" a point is inside a continent.
 * 0 = on edge, positive = inside, negative = outside
 * Uses normalized distance (1 = at edge, <1 = inside)
 */
export function continentDepth(wx: number, wy: number, c: Continent): number {
  const rotated = rotatePoint(wx, wy, c.centerX, c.centerY, c.rotation);
  const nx = rotated.x / c.radiusX;
  const ny = rotated.y / c.radiusY;
  const baseDist = Math.sqrt(nx * nx + ny * ny);

  // Add coastline wobble based on angle
  const angle = Math.atan2(ny, nx);
  const wobble = smoothNoise(angle, c.seed) * 0.15; // ±15% radius variation
  const effectiveDist = baseDist - wobble;

  return 1 - effectiveDist; // positive = inside
}

/**
 * Get the continent a world point belongs to, or null if ocean.
 * Also returns the depth (how far inland).
 */
export function getContinent(wx: number, wy: number): { continent: Continent; depth: number } | null {
  let bestContinent: Continent | null = null;
  let bestDepth = -Infinity;

  for (const c of CONTINENTS) {
    const depth = continentDepth(wx, wy, c);
    if (depth > 0 && depth > bestDepth) {
      bestContinent = c;
      bestDepth = depth;
    }
  }

  if (bestContinent) {
    return { continent: bestContinent, depth: bestDepth };
  }
  return null;
}

export function isOcean(wx: number, wy: number): boolean {
  return getContinent(wx, wy) === null;
}

export function isCoastal(wx: number, wy: number): boolean {
  const result = getContinent(wx, wy);
  if (!result) return false;
  return result.depth < 0.12; // within 12% of edge
}

/**
 * Get the biome for a chunk based on its continent and position.
 * Chunks near the center use the primary biome, edges use secondary.
 */
export function getChunkBiome(wx: number, wy: number): { biome: string; continentId: string | null } {
  const result = getContinent(wx, wy);
  if (!result) return { biome: 'Ocean', continentId: null };

  const { continent, depth } = result;
  // Use secondary biome near edges
  if (depth < 0.2) {
    return { biome: continent.biomeSecondary, continentId: continent.id };
  }
  return { biome: continent.biome, continentId: continent.id };
}

/**
 * Check if a world point is near a continent-scale mountain range.
 * Returns the mountain range name if blocked, null otherwise.
 */
export function isOnMountainRange(wx: number, wy: number): { name: string; continent: string } | null {
  for (const c of CONTINENTS) {
    for (const mtn of c.mountainRanges) {
      // Convert mountain segment to offset coords
      const realX1 = c.centerX + mtn.x1;
      const realY1 = c.centerY + mtn.y1;
      const realX2 = c.centerX + mtn.x2;
      const realY2 = c.centerY + mtn.y2;

      // Point-to-segment distance
      const dx = realX2 - realX1;
      const dy = realY2 - realY1;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;
      const t = Math.max(0, Math.min(1, ((wx - realX1) * dx + (wy - realY1) * dy) / lenSq));
      const closestX = realX1 + t * dx;
      const closestY = realY1 + t * dy;
      const dist = Math.hypot(wx - closestX, wy - closestY);
      if (dist < mtn.width / 2) {
        return { name: mtn.name, continent: c.id };
      }
    }
  }
  return null;
}

/**
 * Check if a world point is near a continent-scale river.
 */
export function isOnMajorRiver(wx: number, wy: number): { name: string; continent: string; width: number } | null {
  for (const c of CONTINENTS) {
    for (const river of c.majorRivers) {
      const realPoints = river.points.map(p => ({
        x: c.centerX + p.x,
        y: c.centerY + p.y,
      }));
      for (let i = 0; i < realPoints.length - 1; i++) {
        const p1 = realPoints[i];
        const p2 = realPoints[i + 1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) continue;
        const t = Math.max(0, Math.min(1, ((wx - p1.x) * dx + (wy - p1.y) * dy) / lenSq));
        const closestX = p1.x + t * dx;
        const closestY = p1.y + t * dy;
        const dist = Math.hypot(wx - closestX, wy - closestY);
        if (dist < river.width) {
          return { name: river.name, continent: c.id, width: river.width };
        }
      }
    }
  }
  return null;
}

/**
 * Get all continent mountain range segments as TerrainFeature-compatible data
 * for a given chunk area.
 */
export function getContinentTerrainForChunk(chunkCenterX: number, chunkCenterY: number, chunkSize: number) {
  const mountains: { x: number; y: number; width: number; height: number; name: string }[] = [];
  const rivers: { points: { x: number; y: number }[]; width: number; name: string }[] = [];

  const pad = chunkSize * 0.8;
  const minX = chunkCenterX - pad;
  const maxX = chunkCenterX + pad;
  const minY = chunkCenterY - pad;
  const maxY = chunkCenterY + pad;

  for (const c of CONTINENTS) {
    for (const mtn of c.mountainRanges) {
      const realX1 = c.centerX + mtn.x1;
      const realY1 = c.centerY + mtn.y1;
      const realX2 = c.centerX + mtn.x2;
      const realY2 = c.centerY + mtn.y2;

      // Check if any part of the mountain range crosses this chunk
      const mtnMinX = Math.min(realX1, realX2) - mtn.width;
      const mtnMaxX = Math.max(realX1, realX2) + mtn.width;
      const mtnMinY = Math.min(realY1, realY2) - mtn.width;
      const mtnMaxY = Math.max(realY1, realY2) + mtn.width;

      if (mtnMaxX < minX || mtnMinX > maxX || mtnMaxY < minY || mtnMinY > maxY) continue;

      // Subdivide the mountain range into chunks that intersect
      const segLen = Math.hypot(realX2 - realX1, realY2 - realY1);
      const numSections = Math.max(1, Math.ceil(segLen / (chunkSize * 0.5)));
      for (let s = 0; s < numSections; s++) {
        const t = (s + 0.5) / numSections;
        const mx = realX1 + (realX2 - realX1) * t;
        const my = realY1 + (realY2 - realY1) * t;
        if (mx >= minX && mx <= maxX && my >= minY && my <= maxY) {
          mountains.push({
            x: mx, y: my,
            width: mtn.width * 0.8,
            height: mtn.width * 0.6,
            name: mtn.name,
          });
        }
      }
    }

    for (const river of c.majorRivers) {
      const realPoints = river.points.map(p => ({
        x: c.centerX + p.x,
        y: c.centerY + p.y,
      }));

      // Check if any river segment crosses this chunk
      const relevantPoints = realPoints.filter(p =>
        p.x >= minX - river.width * 2 && p.x <= maxX + river.width * 2 &&
        p.y >= minY - river.width * 2 && p.y <= maxY + river.width * 2
      );
      if (relevantPoints.length >= 2) {
        rivers.push({
          points: relevantPoints,
          width: river.width,
          name: river.name,
        });
      }
    }
  }

  return { mountains, rivers };
}

/**
 * Generate a random position on the central continent (for new village spawns).
 * Avoids mountain ranges and rivers. Places within inner 60% of continent.
 */
export function getRandomHeartlandPosition(seed: number): { x: number; y: number } {
  const c = CENTRAL_CONTINENT;
  const rng = seededRandom(seed);

  for (let attempt = 0; attempt < 50; attempt++) {
    // Random point within inner region of continent
    const angle = rng() * Math.PI * 2;
    const radiusFrac = 0.1 + rng() * 0.5; // 10-60% of radius
    const x = c.centerX + Math.cos(angle) * c.radiusX * radiusFrac;
    const y = c.centerY + Math.sin(angle) * c.radiusY * radiusFrac;

    // Check not on mountain or river
    if (isOnMountainRange(x, y)) continue;
    if (isOnMajorRiver(x, y)) continue;

    return { x, y };
  }

  // Fallback: center of continent
  return { x: c.centerX, y: c.centerY };
}

// ── Biome color palettes for map rendering ──
export const BIOME_COLORS: Record<string, { land: string; landLight: string; accent: string }> = {
  Plains: { land: 'hsl(100 30% 25% / 0.35)', landLight: 'hsl(90 25% 35% / 0.2)', accent: 'hsl(80 40% 40% / 0.15)' },
  Forest: { land: 'hsl(130 35% 20% / 0.4)', landLight: 'hsl(120 30% 30% / 0.25)', accent: 'hsl(140 40% 25% / 0.2)' },
  Tundra: { land: 'hsl(200 15% 40% / 0.3)', landLight: 'hsl(210 10% 50% / 0.2)', accent: 'hsl(195 20% 60% / 0.15)' },
  Highlands: { land: 'hsl(30 20% 30% / 0.35)', landLight: 'hsl(25 15% 40% / 0.2)', accent: 'hsl(35 25% 35% / 0.15)' },
  Desert: { land: 'hsl(40 50% 40% / 0.35)', landLight: 'hsl(45 45% 50% / 0.25)', accent: 'hsl(35 55% 45% / 0.2)' },
  Badlands: { land: 'hsl(15 30% 25% / 0.35)', landLight: 'hsl(10 25% 35% / 0.2)', accent: 'hsl(20 35% 30% / 0.15)' },
  Jungle: { land: 'hsl(145 40% 18% / 0.4)', landLight: 'hsl(140 35% 25% / 0.25)', accent: 'hsl(150 45% 22% / 0.2)' },
  Coast: { land: 'hsl(50 30% 35% / 0.3)', landLight: 'hsl(55 25% 45% / 0.2)', accent: 'hsl(45 35% 40% / 0.15)' },
  Marsh: { land: 'hsl(160 25% 22% / 0.35)', landLight: 'hsl(155 20% 30% / 0.2)', accent: 'hsl(165 30% 25% / 0.15)' },
  Steppe: { land: 'hsl(70 25% 30% / 0.3)', landLight: 'hsl(65 20% 40% / 0.2)', accent: 'hsl(75 30% 35% / 0.15)' },
  Lava: { land: 'hsl(10 70% 25% / 0.4)', landLight: 'hsl(5 60% 30% / 0.25)', accent: 'hsl(15 80% 35% / 0.2)' },
  Ocean: { land: 'transparent', landLight: 'transparent', accent: 'transparent' },
};
