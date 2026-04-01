// ── Continental World Data ──
// Fixed world: 1,000,000 x 1,000,000 units
// 5 continents separated by ocean, with islands scattered between

export const WORLD_SIZE = 1_000_000;
export const WORLD_MIN = 0;
export const WORLD_MAX = WORLD_SIZE;

export interface ContinentRiver {
  name: string;
  points: { x: number; y: number }[];
  width: number; // 4000-8000 world units
  bridges: { x: number; y: number; health: number; maxHealth: number }[];
}

export interface MountainRange {
  name: string;
  spine: { x: number; y: number }[]; // center line of the range
  width: number; // how wide the range is (radius from spine)
}

export interface Continent {
  name: string;
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  biome: string; // forced biome for all chunks in this continent
  rivers: ContinentRiver[];
  mountainRanges: MountainRange[];
  // Irregularity offsets for coastline (makes ellipse look natural)
  coastNoise: number[];
}

// Generate deterministic coast noise
function generateCoastNoise(seed: number, count: number): number[] {
  let s = seed;
  const noise: number[] = [];
  for (let i = 0; i < count; i++) {
    s = (s * 16807) % 2147483647;
    noise.push(0.75 + ((s - 1) / 2147483646) * 0.5); // 0.75 - 1.25 multiplier
  }
  return noise;
}

export const CONTINENTS: Continent[] = [
  // ── NORDHEIM (Northwest) — Forest/Tundra ──
  {
    name: 'Nordheim',
    centerX: 180_000,
    centerY: 150_000,
    radiusX: 130_000,
    radiusY: 100_000,
    biome: 'Tundra',
    coastNoise: generateCoastNoise(111, 36),
    rivers: [
      {
        name: 'River Frostmelt',
        width: 5000,
        points: [
          { x: 100_000, y: 80_000 },
          { x: 130_000, y: 110_000 },
          { x: 160_000, y: 130_000 },
          { x: 200_000, y: 150_000 },
          { x: 230_000, y: 180_000 },
          { x: 260_000, y: 210_000 },
        ],
        bridges: [
          { x: 145_000, y: 120_000, health: 500, maxHealth: 500 },
          { x: 215_000, y: 165_000, health: 500, maxHealth: 500 },
        ],
      },
      {
        name: 'Icevein Run',
        width: 4000,
        points: [
          { x: 80_000, y: 170_000 },
          { x: 120_000, y: 160_000 },
          { x: 160_000, y: 170_000 },
          { x: 190_000, y: 190_000 },
        ],
        bridges: [
          { x: 140_000, y: 164_000, health: 400, maxHealth: 400 },
        ],
      },
    ],
    mountainRanges: [
      {
        name: 'The Frostspine',
        width: 18_000,
        spine: [
          { x: 100_000, y: 100_000 },
          { x: 130_000, y: 95_000 },
          { x: 165_000, y: 100_000 },
          { x: 200_000, y: 110_000 },
          { x: 230_000, y: 120_000 },
        ],
      },
    ],
  },

  // ── ASHARA (Northeast) — Desert ──
  {
    name: 'Ashara',
    centerX: 580_000,
    centerY: 160_000,
    radiusX: 150_000,
    radiusY: 110_000,
    biome: 'Desert',
    coastNoise: generateCoastNoise(222, 36),
    rivers: [
      {
        name: 'The Sandflow',
        width: 6000,
        points: [
          { x: 500_000, y: 120_000 },
          { x: 540_000, y: 140_000 },
          { x: 580_000, y: 150_000 },
          { x: 620_000, y: 160_000 },
          { x: 660_000, y: 180_000 },
          { x: 700_000, y: 220_000 },
        ],
        bridges: [
          { x: 560_000, y: 145_000, health: 600, maxHealth: 600 },
          { x: 640_000, y: 170_000, health: 600, maxHealth: 600 },
        ],
      },
    ],
    mountainRanges: [
      {
        name: 'Sunscorch Peaks',
        width: 20_000,
        spine: [
          { x: 490_000, y: 180_000 },
          { x: 530_000, y: 175_000 },
          { x: 570_000, y: 190_000 },
          { x: 610_000, y: 200_000 },
          { x: 650_000, y: 195_000 },
        ],
      },
      {
        name: 'The Dune Wall',
        width: 15_000,
        spine: [
          { x: 530_000, y: 100_000 },
          { x: 570_000, y: 90_000 },
          { x: 620_000, y: 95_000 },
          { x: 660_000, y: 105_000 },
        ],
      },
    ],
  },

  // ── HEARTLANDS (Center) — Plains/Forest — largest continent ──
  {
    name: 'Heartlands',
    centerX: 420_000,
    centerY: 470_000,
    radiusX: 200_000,
    radiusY: 170_000,
    biome: 'Plains',
    coastNoise: generateCoastNoise(333, 36),
    rivers: [
      {
        name: 'The Greatvein',
        width: 8000,
        points: [
          { x: 300_000, y: 380_000 },
          { x: 340_000, y: 410_000 },
          { x: 380_000, y: 440_000 },
          { x: 420_000, y: 460_000 },
          { x: 460_000, y: 470_000 },
          { x: 500_000, y: 490_000 },
          { x: 540_000, y: 520_000 },
          { x: 580_000, y: 560_000 },
        ],
        bridges: [
          { x: 360_000, y: 425_000, health: 800, maxHealth: 800 },
          { x: 440_000, y: 464_000, health: 800, maxHealth: 800 },
          { x: 520_000, y: 505_000, health: 800, maxHealth: 800 },
        ],
      },
      {
        name: 'Silverbrook',
        width: 5000,
        points: [
          { x: 350_000, y: 530_000 },
          { x: 380_000, y: 510_000 },
          { x: 420_000, y: 500_000 },
          { x: 460_000, y: 510_000 },
          { x: 500_000, y: 530_000 },
        ],
        bridges: [
          { x: 400_000, y: 504_000, health: 500, maxHealth: 500 },
          { x: 480_000, y: 520_000, health: 500, maxHealth: 500 },
        ],
      },
      {
        name: 'Thornstream',
        width: 4500,
        points: [
          { x: 280_000, y: 450_000 },
          { x: 310_000, y: 470_000 },
          { x: 340_000, y: 500_000 },
          { x: 360_000, y: 540_000 },
        ],
        bridges: [
          { x: 325_000, y: 485_000, health: 400, maxHealth: 400 },
        ],
      },
    ],
    mountainRanges: [
      {
        name: 'The Crownridge',
        width: 22_000,
        spine: [
          { x: 320_000, y: 400_000 },
          { x: 350_000, y: 390_000 },
          { x: 400_000, y: 395_000 },
          { x: 440_000, y: 410_000 },
          { x: 480_000, y: 420_000 },
          { x: 510_000, y: 405_000 },
        ],
      },
      {
        name: 'Ironwall Mountains',
        width: 16_000,
        spine: [
          { x: 360_000, y: 560_000 },
          { x: 400_000, y: 555_000 },
          { x: 440_000, y: 565_000 },
          { x: 480_000, y: 570_000 },
        ],
      },
    ],
  },

  // ── JADE REACHES (East) — Jungle/Coast ──
  {
    name: 'Jade Reaches',
    centerX: 780_000,
    centerY: 350_000,
    radiusX: 120_000,
    radiusY: 140_000,
    biome: 'Jungle',
    coastNoise: generateCoastNoise(444, 36),
    rivers: [
      {
        name: 'Emerald Torrent',
        width: 6000,
        points: [
          { x: 720_000, y: 280_000 },
          { x: 750_000, y: 310_000 },
          { x: 780_000, y: 340_000 },
          { x: 800_000, y: 370_000 },
          { x: 810_000, y: 410_000 },
          { x: 820_000, y: 450_000 },
        ],
        bridges: [
          { x: 765_000, y: 325_000, health: 500, maxHealth: 500 },
          { x: 805_000, y: 390_000, health: 500, maxHealth: 500 },
        ],
      },
    ],
    mountainRanges: [
      {
        name: 'Jadepeak Range',
        width: 18_000,
        spine: [
          { x: 700_000, y: 320_000 },
          { x: 740_000, y: 310_000 },
          { x: 770_000, y: 320_000 },
          { x: 800_000, y: 340_000 },
        ],
      },
    ],
  },

  // ── GRIMWILD (South) — Marsh/Badlands ──
  {
    name: 'Grimwild',
    centerX: 500_000,
    centerY: 780_000,
    radiusX: 160_000,
    radiusY: 120_000,
    biome: 'Marsh',
    coastNoise: generateCoastNoise(555, 36),
    rivers: [
      {
        name: 'Blacktide',
        width: 7000,
        points: [
          { x: 400_000, y: 720_000 },
          { x: 440_000, y: 740_000 },
          { x: 480_000, y: 760_000 },
          { x: 520_000, y: 770_000 },
          { x: 560_000, y: 780_000 },
          { x: 600_000, y: 810_000 },
        ],
        bridges: [
          { x: 460_000, y: 750_000, health: 600, maxHealth: 600 },
          { x: 540_000, y: 775_000, health: 600, maxHealth: 600 },
        ],
      },
      {
        name: 'Mistcrawl',
        width: 4500,
        points: [
          { x: 480_000, y: 700_000 },
          { x: 500_000, y: 730_000 },
          { x: 510_000, y: 760_000 },
          { x: 520_000, y: 800_000 },
        ],
        bridges: [
          { x: 505_000, y: 745_000, health: 400, maxHealth: 400 },
        ],
      },
    ],
    mountainRanges: [
      {
        name: 'Boneridge',
        width: 16_000,
        spine: [
          { x: 420_000, y: 740_000 },
          { x: 460_000, y: 730_000 },
          { x: 500_000, y: 740_000 },
          { x: 540_000, y: 750_000 },
          { x: 580_000, y: 745_000 },
        ],
      },
    ],
  },
];

// ── Ocean Islands ──
export interface OceanIsland {
  name: string;
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  biome: string;
}

export const OCEAN_ISLANDS: OceanIsland[] = [
  { name: 'Isle of Bones', x: 350_000, y: 280_000, radiusX: 12_000, radiusY: 8_000, biome: 'Coast' },
  { name: 'Verdant Atoll', x: 150_000, y: 320_000, radiusX: 15_000, radiusY: 10_000, biome: 'Jungle' },
  { name: 'Skull Rock', x: 650_000, y: 550_000, radiusX: 8_000, radiusY: 6_000, biome: 'Badlands' },
  { name: "Trader's Rest", x: 400_000, y: 650_000, radiusX: 18_000, radiusY: 12_000, biome: 'Coast' },
  { name: 'Phantom Isle', x: 880_000, y: 200_000, radiusX: 10_000, radiusY: 14_000, biome: 'Marsh' },
  { name: 'Coral Haven', x: 100_000, y: 500_000, radiusX: 12_000, radiusY: 9_000, biome: 'Coast' },
  { name: 'Driftwood Key', x: 300_000, y: 700_000, radiusX: 9_000, radiusY: 7_000, biome: 'Steppe' },
  { name: 'Ember Isle', x: 700_000, y: 600_000, radiusX: 14_000, radiusY: 11_000, biome: 'Badlands' },
  { name: 'Windward Cay', x: 200_000, y: 600_000, radiusX: 11_000, radiusY: 8_000, biome: 'Coast' },
  { name: "Smuggler's Den", x: 850_000, y: 500_000, radiusX: 10_000, radiusY: 10_000, biome: 'Highlands' },
  { name: 'Sapphire Reef', x: 450_000, y: 300_000, radiusX: 8_000, radiusY: 6_000, biome: 'Coast' },
  { name: 'Volcanic Shard', x: 680_000, y: 680_000, radiusX: 13_000, radiusY: 10_000, biome: 'Badlands' },
  { name: 'Mist Haven', x: 250_000, y: 450_000, radiusX: 10_000, radiusY: 12_000, biome: 'Marsh' },
  { name: 'Pearl Shoal', x: 550_000, y: 630_000, radiusX: 7_000, radiusY: 5_000, biome: 'Coast' },
  { name: 'Iron Outpost', x: 900_000, y: 400_000, radiusX: 9_000, radiusY: 8_000, biome: 'Highlands' },
  { name: 'The Forgotten Rock', x: 50_000, y: 250_000, radiusX: 6_000, radiusY: 6_000, biome: 'Tundra' },
  { name: "Dragon's Tooth", x: 750_000, y: 150_000, radiusX: 8_000, radiusY: 12_000, biome: 'Badlands' },
  { name: 'Siren Cove', x: 400_000, y: 120_000, radiusX: 11_000, radiusY: 7_000, biome: 'Coast' },
  { name: 'Thornback Isle', x: 620_000, y: 420_000, radiusX: 10_000, radiusY: 8_000, biome: 'Forest' },
  { name: 'Ashen Atoll', x: 150_000, y: 780_000, radiusX: 12_000, radiusY: 9_000, biome: 'Badlands' },
  { name: 'Moonrise Island', x: 830_000, y: 700_000, radiusX: 14_000, radiusY: 11_000, biome: 'Forest' },
  { name: 'Sunken Crown', x: 500_000, y: 200_000, radiusX: 7_000, radiusY: 7_000, biome: 'Coast' },
  { name: 'Spice Island', x: 320_000, y: 580_000, radiusX: 9_000, radiusY: 6_000, biome: 'Jungle' },
  { name: 'The Cauldron', x: 780_000, y: 800_000, radiusX: 16_000, radiusY: 13_000, biome: 'Badlands' },
  { name: 'Frostbite Isle', x: 70_000, y: 80_000, radiusX: 8_000, radiusY: 10_000, biome: 'Tundra' },
  { name: 'Jade Archipelago', x: 900_000, y: 300_000, radiusX: 15_000, radiusY: 10_000, biome: 'Jungle' },
  { name: 'Wraith Island', x: 650_000, y: 300_000, radiusX: 8_000, radiusY: 6_000, biome: 'Marsh' },
  { name: 'Gilded Shore', x: 420_000, y: 830_000, radiusX: 12_000, radiusY: 8_000, biome: 'Coast' },
  { name: 'Storm Islet', x: 180_000, y: 900_000, radiusX: 7_000, radiusY: 7_000, biome: 'Steppe' },
  { name: 'Lost Beacon', x: 950_000, y: 150_000, radiusX: 6_000, radiusY: 8_000, biome: 'Coast' },
];

// ── Biome-to-continent mapping helpers ──

/**
 * Check if a point is inside a continent's irregularly-shaped territory.
 * Uses the base ellipse with coast noise applied per angle segment.
 */
export function isPointOnContinent(px: number, py: number, cont: Continent): boolean {
  const dx = px - cont.centerX;
  const dy = py - cont.centerY;
  const angle = Math.atan2(dy, dx);
  const noiseIdx = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * cont.coastNoise.length) % cont.coastNoise.length;
  const noiseMult = cont.coastNoise[noiseIdx];
  const normDist = (dx / (cont.radiusX * noiseMult)) ** 2 + (dy / (cont.radiusY * noiseMult)) ** 2;
  return normDist <= 1;
}

/**
 * Check if a point is on any ocean island.
 */
export function isPointOnIsland(px: number, py: number): OceanIsland | null {
  for (const isle of OCEAN_ISLANDS) {
    const dx = (px - isle.x) / isle.radiusX;
    const dy = (py - isle.y) / isle.radiusY;
    if (dx * dx + dy * dy <= 1) return isle;
  }
  return null;
}

/**
 * Determine what a world point sits on: continent, island, or ocean.
 */
export function getWorldRegion(px: number, py: number): { type: 'continent'; continent: Continent } | { type: 'island'; island: OceanIsland } | { type: 'ocean' } {
  for (const cont of CONTINENTS) {
    if (isPointOnContinent(px, py, cont)) return { type: 'continent', continent: cont };
  }
  const island = isPointOnIsland(px, py);
  if (island) return { type: 'island', island };
  return { type: 'ocean' };
}

/**
 * Check if a point is near a continent river (for pathfinding blocking).
 */
export function isPointOnContinentRiver(px: number, py: number, padding = 0): { river: ContinentRiver; nearBridge: boolean } | null {
  for (const cont of CONTINENTS) {
    for (const river of cont.rivers) {
      const halfW = river.width / 2 + padding;
      for (let i = 0; i < river.points.length - 1; i++) {
        const p1 = river.points[i];
        const p2 = river.points[i + 1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) continue;
        const t = Math.max(0, Math.min(1, ((px - p1.x) * dx + (py - p1.y) * dy) / lenSq));
        const closestX = p1.x + t * dx;
        const closestY = p1.y + t * dy;
        if (Math.hypot(px - closestX, py - closestY) < halfW) {
          const nearBridge = river.bridges.some(b => Math.hypot(px - b.x, py - b.y) < river.width * 1.5);
          return { river, nearBridge };
        }
      }
    }
  }
  return null;
}

/**
 * Check if a point is inside a mountain range (for pathfinding blocking).
 */
export function isPointInMountainRange(px: number, py: number, padding = 0): MountainRange | null {
  for (const cont of CONTINENTS) {
    for (const range of cont.mountainRanges) {
      const halfW = range.width / 2 + padding;
      for (let i = 0; i < range.spine.length - 1; i++) {
        const p1 = range.spine[i];
        const p2 = range.spine[i + 1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) continue;
        const t = Math.max(0, Math.min(1, ((px - p1.x) * dx + (py - p1.y) * dy) / lenSq));
        const closestX = p1.x + t * dx;
        const closestY = p1.y + t * dy;
        if (Math.hypot(px - closestX, py - closestY) < halfW) {
          return range;
        }
      }
    }
  }
  return null;
}

// Biome sub-variants per continent for decoration variety
export const CONTINENT_SUB_BIOMES: Record<string, string[]> = {
  Tundra: ['Tundra', 'Highlands', 'Forest'],
  Desert: ['Desert', 'Badlands', 'Steppe'],
  Plains: ['Plains', 'Forest', 'Highlands', 'Steppe'],
  Jungle: ['Jungle', 'Forest', 'Marsh', 'Coast'],
  Marsh: ['Marsh', 'Badlands', 'Steppe', 'Highlands'],
};
