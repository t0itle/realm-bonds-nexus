// ── Continental World Data ──
// Fixed world: 100,000,000 x 100,000,000 units (100x scale)
// 5 continents separated by ocean, with islands scattered between

export const WORLD_SIZE = 100_000_000;
export const WORLD_MIN = 0;
export const WORLD_MAX = WORLD_SIZE;

export interface ContinentRiver {
  name: string;
  points: { x: number; y: number }[];
  width: number; // 400_000-800_000 world units
  // No pre-built bridges — players must build their own
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
  biome: string;
  rivers: ContinentRiver[];
  mountainRanges: MountainRange[];
  coastNoise: number[];
}

// Generate deterministic coast noise
function generateCoastNoise(seed: number, count: number): number[] {
  let s = seed;
  const noise: number[] = [];
  for (let i = 0; i < count; i++) {
    s = (s * 16807) % 2147483647;
    noise.push(0.75 + ((s - 1) / 2147483646) * 0.5);
  }
  return noise;
}

export const CONTINENTS: Continent[] = [
  // ── NORDHEIM (Northwest) — Forest/Tundra ──
  {
    name: 'Nordheim',
    centerX: 18_000_000,
    centerY: 15_000_000,
    radiusX: 13_000_000,
    radiusY: 10_000_000,
    biome: 'Tundra',
    coastNoise: generateCoastNoise(111, 36),
    rivers: [
      {
        name: 'River Frostmelt',
        width: 500_000,
        points: [
          { x: 10_000_000, y: 8_000_000 },
          { x: 13_000_000, y: 11_000_000 },
          { x: 16_000_000, y: 13_000_000 },
          { x: 20_000_000, y: 15_000_000 },
          { x: 23_000_000, y: 18_000_000 },
          { x: 26_000_000, y: 21_000_000 },
        ],
      },
      {
        name: 'Icevein Run',
        width: 400_000,
        points: [
          { x: 8_000_000, y: 17_000_000 },
          { x: 12_000_000, y: 16_000_000 },
          { x: 16_000_000, y: 17_000_000 },
          { x: 19_000_000, y: 19_000_000 },
        ],
      },
    ],
    mountainRanges: [
      {
        name: 'The Frostspine',
        width: 1_800_000,
        spine: [
          { x: 10_000_000, y: 10_000_000 },
          { x: 13_000_000, y: 9_500_000 },
          { x: 16_500_000, y: 10_000_000 },
          { x: 20_000_000, y: 11_000_000 },
          { x: 23_000_000, y: 12_000_000 },
        ],
      },
    ],
  },

  // ── ASHARA (Northeast) — Desert ──
  {
    name: 'Ashara',
    centerX: 58_000_000,
    centerY: 16_000_000,
    radiusX: 15_000_000,
    radiusY: 11_000_000,
    biome: 'Desert',
    coastNoise: generateCoastNoise(222, 36),
    rivers: [
      {
        name: 'The Sandflow',
        width: 600_000,
        points: [
          { x: 50_000_000, y: 12_000_000 },
          { x: 54_000_000, y: 14_000_000 },
          { x: 58_000_000, y: 15_000_000 },
          { x: 62_000_000, y: 16_000_000 },
          { x: 66_000_000, y: 18_000_000 },
          { x: 70_000_000, y: 22_000_000 },
        ],
      },
    ],
    mountainRanges: [
      {
        name: 'Sunscorch Peaks',
        width: 2_000_000,
        spine: [
          { x: 49_000_000, y: 18_000_000 },
          { x: 53_000_000, y: 17_500_000 },
          { x: 57_000_000, y: 19_000_000 },
          { x: 61_000_000, y: 20_000_000 },
          { x: 65_000_000, y: 19_500_000 },
        ],
      },
      {
        name: 'The Dune Wall',
        width: 1_500_000,
        spine: [
          { x: 53_000_000, y: 10_000_000 },
          { x: 57_000_000, y: 9_000_000 },
          { x: 62_000_000, y: 9_500_000 },
          { x: 66_000_000, y: 10_500_000 },
        ],
      },
    ],
  },

  // ── HEARTLANDS (Center) — Plains/Forest — largest continent ──
  {
    name: 'Heartlands',
    centerX: 42_000_000,
    centerY: 47_000_000,
    radiusX: 20_000_000,
    radiusY: 17_000_000,
    biome: 'Plains',
    coastNoise: generateCoastNoise(333, 36),
    rivers: [
      {
        name: 'The Greatvein',
        width: 800_000,
        points: [
          { x: 30_000_000, y: 38_000_000 },
          { x: 34_000_000, y: 41_000_000 },
          { x: 38_000_000, y: 44_000_000 },
          { x: 42_000_000, y: 46_000_000 },
          { x: 46_000_000, y: 47_000_000 },
          { x: 50_000_000, y: 49_000_000 },
          { x: 54_000_000, y: 52_000_000 },
          { x: 58_000_000, y: 56_000_000 },
        ],
      },
      {
        name: 'Silverbrook',
        width: 500_000,
        points: [
          { x: 35_000_000, y: 53_000_000 },
          { x: 38_000_000, y: 51_000_000 },
          { x: 42_000_000, y: 50_000_000 },
          { x: 46_000_000, y: 51_000_000 },
          { x: 50_000_000, y: 53_000_000 },
        ],
      },
      {
        name: 'Thornstream',
        width: 450_000,
        points: [
          { x: 28_000_000, y: 45_000_000 },
          { x: 31_000_000, y: 47_000_000 },
          { x: 34_000_000, y: 50_000_000 },
          { x: 36_000_000, y: 54_000_000 },
        ],
      },
    ],
    mountainRanges: [
      {
        name: 'The Crownridge',
        width: 2_200_000,
        spine: [
          { x: 32_000_000, y: 40_000_000 },
          { x: 35_000_000, y: 39_000_000 },
          { x: 40_000_000, y: 39_500_000 },
          { x: 44_000_000, y: 41_000_000 },
          { x: 48_000_000, y: 42_000_000 },
          { x: 51_000_000, y: 40_500_000 },
        ],
      },
      {
        name: 'Ironwall Mountains',
        width: 1_600_000,
        spine: [
          { x: 36_000_000, y: 56_000_000 },
          { x: 40_000_000, y: 55_500_000 },
          { x: 44_000_000, y: 56_500_000 },
          { x: 48_000_000, y: 57_000_000 },
        ],
      },
    ],
  },

  // ── JADE REACHES (East) — Jungle/Coast ──
  {
    name: 'Jade Reaches',
    centerX: 78_000_000,
    centerY: 35_000_000,
    radiusX: 12_000_000,
    radiusY: 14_000_000,
    biome: 'Jungle',
    coastNoise: generateCoastNoise(444, 36),
    rivers: [
      {
        name: 'Emerald Torrent',
        width: 600_000,
        points: [
          { x: 72_000_000, y: 28_000_000 },
          { x: 75_000_000, y: 31_000_000 },
          { x: 78_000_000, y: 34_000_000 },
          { x: 80_000_000, y: 37_000_000 },
          { x: 81_000_000, y: 41_000_000 },
          { x: 82_000_000, y: 45_000_000 },
        ],
      },
    ],
    mountainRanges: [
      {
        name: 'Jadepeak Range',
        width: 1_800_000,
        spine: [
          { x: 70_000_000, y: 32_000_000 },
          { x: 74_000_000, y: 31_000_000 },
          { x: 77_000_000, y: 32_000_000 },
          { x: 80_000_000, y: 34_000_000 },
        ],
      },
    ],
  },

  // ── GRIMWILD (South) — Marsh/Badlands ──
  {
    name: 'Grimwild',
    centerX: 50_000_000,
    centerY: 78_000_000,
    radiusX: 16_000_000,
    radiusY: 12_000_000,
    biome: 'Marsh',
    coastNoise: generateCoastNoise(555, 36),
    rivers: [
      {
        name: 'Blacktide',
        width: 700_000,
        points: [
          { x: 40_000_000, y: 72_000_000 },
          { x: 44_000_000, y: 74_000_000 },
          { x: 48_000_000, y: 76_000_000 },
          { x: 52_000_000, y: 77_000_000 },
          { x: 56_000_000, y: 78_000_000 },
          { x: 60_000_000, y: 81_000_000 },
        ],
      },
      {
        name: 'Mistcrawl',
        width: 450_000,
        points: [
          { x: 48_000_000, y: 70_000_000 },
          { x: 50_000_000, y: 73_000_000 },
          { x: 51_000_000, y: 76_000_000 },
          { x: 52_000_000, y: 80_000_000 },
        ],
      },
    ],
    mountainRanges: [
      {
        name: 'Boneridge',
        width: 1_600_000,
        spine: [
          { x: 42_000_000, y: 74_000_000 },
          { x: 46_000_000, y: 73_000_000 },
          { x: 50_000_000, y: 74_000_000 },
          { x: 54_000_000, y: 75_000_000 },
          { x: 58_000_000, y: 74_500_000 },
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
  { name: 'Isle of Bones', x: 35_000_000, y: 28_000_000, radiusX: 1_200_000, radiusY: 800_000, biome: 'Coast' },
  { name: 'Verdant Atoll', x: 15_000_000, y: 32_000_000, radiusX: 1_500_000, radiusY: 1_000_000, biome: 'Jungle' },
  { name: 'Skull Rock', x: 65_000_000, y: 55_000_000, radiusX: 800_000, radiusY: 600_000, biome: 'Badlands' },
  { name: "Trader's Rest", x: 40_000_000, y: 65_000_000, radiusX: 1_800_000, radiusY: 1_200_000, biome: 'Coast' },
  { name: 'Phantom Isle', x: 88_000_000, y: 20_000_000, radiusX: 1_000_000, radiusY: 1_400_000, biome: 'Marsh' },
  { name: 'Coral Haven', x: 10_000_000, y: 50_000_000, radiusX: 1_200_000, radiusY: 900_000, biome: 'Coast' },
  { name: 'Driftwood Key', x: 30_000_000, y: 70_000_000, radiusX: 900_000, radiusY: 700_000, biome: 'Steppe' },
  { name: 'Ember Isle', x: 70_000_000, y: 60_000_000, radiusX: 1_400_000, radiusY: 1_100_000, biome: 'Badlands' },
  { name: 'Windward Cay', x: 20_000_000, y: 60_000_000, radiusX: 1_100_000, radiusY: 800_000, biome: 'Coast' },
  { name: "Smuggler's Den", x: 85_000_000, y: 50_000_000, radiusX: 1_000_000, radiusY: 1_000_000, biome: 'Highlands' },
  { name: 'Sapphire Reef', x: 45_000_000, y: 30_000_000, radiusX: 800_000, radiusY: 600_000, biome: 'Coast' },
  { name: 'Volcanic Shard', x: 68_000_000, y: 68_000_000, radiusX: 1_300_000, radiusY: 1_000_000, biome: 'Badlands' },
  { name: 'Mist Haven', x: 25_000_000, y: 45_000_000, radiusX: 1_000_000, radiusY: 1_200_000, biome: 'Marsh' },
  { name: 'Pearl Shoal', x: 55_000_000, y: 63_000_000, radiusX: 700_000, radiusY: 500_000, biome: 'Coast' },
  { name: 'Iron Outpost', x: 90_000_000, y: 40_000_000, radiusX: 900_000, radiusY: 800_000, biome: 'Highlands' },
  { name: 'The Forgotten Rock', x: 5_000_000, y: 25_000_000, radiusX: 600_000, radiusY: 600_000, biome: 'Tundra' },
  { name: "Dragon's Tooth", x: 75_000_000, y: 15_000_000, radiusX: 800_000, radiusY: 1_200_000, biome: 'Badlands' },
  { name: 'Siren Cove', x: 40_000_000, y: 12_000_000, radiusX: 1_100_000, radiusY: 700_000, biome: 'Coast' },
  { name: 'Thornback Isle', x: 62_000_000, y: 42_000_000, radiusX: 1_000_000, radiusY: 800_000, biome: 'Forest' },
  { name: 'Ashen Atoll', x: 15_000_000, y: 78_000_000, radiusX: 1_200_000, radiusY: 900_000, biome: 'Badlands' },
  { name: 'Moonrise Island', x: 83_000_000, y: 70_000_000, radiusX: 1_400_000, radiusY: 1_100_000, biome: 'Forest' },
  { name: 'Sunken Crown', x: 50_000_000, y: 20_000_000, radiusX: 700_000, radiusY: 700_000, biome: 'Coast' },
  { name: 'Spice Island', x: 32_000_000, y: 58_000_000, radiusX: 900_000, radiusY: 600_000, biome: 'Jungle' },
  { name: 'The Cauldron', x: 78_000_000, y: 80_000_000, radiusX: 1_600_000, radiusY: 1_300_000, biome: 'Badlands' },
  { name: 'Frostbite Isle', x: 7_000_000, y: 8_000_000, radiusX: 800_000, radiusY: 1_000_000, biome: 'Tundra' },
  { name: 'Jade Archipelago', x: 90_000_000, y: 30_000_000, radiusX: 1_500_000, radiusY: 1_000_000, biome: 'Jungle' },
  { name: 'Wraith Island', x: 65_000_000, y: 30_000_000, radiusX: 800_000, radiusY: 600_000, biome: 'Marsh' },
  { name: 'Gilded Shore', x: 42_000_000, y: 83_000_000, radiusX: 1_200_000, radiusY: 800_000, biome: 'Coast' },
  { name: 'Storm Islet', x: 18_000_000, y: 90_000_000, radiusX: 700_000, radiusY: 700_000, biome: 'Steppe' },
  { name: 'Lost Beacon', x: 95_000_000, y: 15_000_000, radiusX: 600_000, radiusY: 800_000, biome: 'Coast' },
];

// ── Biome-to-continent mapping helpers ──

export function isPointOnContinent(px: number, py: number, cont: Continent): boolean {
  const dx = px - cont.centerX;
  const dy = py - cont.centerY;
  const angle = Math.atan2(dy, dx);
  const noiseIdx = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * cont.coastNoise.length) % cont.coastNoise.length;
  const noiseMult = cont.coastNoise[noiseIdx];
  const normDist = (dx / (cont.radiusX * noiseMult)) ** 2 + (dy / (cont.radiusY * noiseMult)) ** 2;
  return normDist <= 1;
}

export function isPointOnIsland(px: number, py: number): OceanIsland | null {
  for (const isle of OCEAN_ISLANDS) {
    const dx = (px - isle.x) / isle.radiusX;
    const dy = (py - isle.y) / isle.radiusY;
    if (dx * dx + dy * dy <= 1) return isle;
  }
  return null;
}

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
 * Rivers are ALWAYS blocking — no pre-built bridges. Players must build their own.
 */
export function isPointOnContinentRiver(px: number, py: number, padding = 0): { river: ContinentRiver } | null {
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
          return { river };
        }
      }
    }
  }
  return null;
}

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
