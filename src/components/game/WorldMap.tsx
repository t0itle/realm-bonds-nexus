import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '@/hooks/useGameState';
import { calcMarchTime, getMaxRange, BUILDING_INFO, getSlowestTroopSpeed, WATCHTOWER_RANGE_BONUS } from '@/lib/gameConstants';
import type { TroopType, Resources, Building } from '@/lib/gameTypes';
import { useAuth } from '@/hooks/useAuth';
import { useNPCState } from '@/hooks/useNPCState';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import NPCInteractionPanel from './NPCInteractionPanel';
import { useTroopSkins } from '@/hooks/useTroopSkins';
import AttackConfigPanel from './AttackConfigPanel';
import TroopTransferPanel from './TroopTransferPanel';
import { FACTION_MAP_SPRITES, FACTION_SOLDIER_SPRITES } from './factionMapSprites';
import { getMineSteelPerTickForChunk } from '@/lib/mineProduction';

// Map sprites
import mapCastleHostile from '@/assets/sprites/map-castle-hostile.png';
import mapCastleNeutral from '@/assets/sprites/map-castle-neutral.png';
import mapCastleFriendly from '@/assets/sprites/map-castle-friendly.png';
import mapEventDanger from '@/assets/sprites/map-event-danger.png';
import mapEventOpportunity from '@/assets/sprites/map-event-opportunity.png';
import mapEventMystery from '@/assets/sprites/map-event-mystery.png';
import mapMine from '@/assets/sprites/map-mine.png';
import mapPlayer from '@/assets/sprites/map-player.png';
// Fantasy terrain sprites
import mapTrees from '@/assets/sprites/map-trees.png';
import mapGrass from '@/assets/sprites/map-grass.png';
import mapRocks from '@/assets/sprites/map-rocks.png';
import mapVillage from '@/assets/sprites/map-village.png';
import mapVillageTier from '@/assets/sprites/map-village-tier.png';
import mapTownTier from '@/assets/sprites/map-town-tier.png';
import mapCityTier from '@/assets/sprites/map-city-tier.png';
import mapRuins from '@/assets/sprites/map-ruins.png';
import mapSoldier from '@/assets/sprites/map-soldier.png';
import mapMountain from '@/assets/sprites/map-mountain.png';

const REALM_SPRITES: Record<string, string> = {
  hostile: mapCastleHostile,
  neutral: mapCastleNeutral,
  friendly: mapCastleFriendly,
};

const EVENT_SPRITES: Record<string, string> = {
  danger: mapEventDanger,
  opportunity: mapEventOpportunity,
  mystery: mapEventMystery,
};

// ── A* Pathfinding around terrain obstacles ──
const PATH_GRID_CELL = 2000; // world units per pathfinding cell

function isPointInEllipse(px: number, py: number, cx: number, cy: number, rw: number, rh: number): boolean {
  const dx = (px - cx) / rw;
  const dy = (py - cy) / rh;
  return dx * dx + dy * dy <= 1;
}

// Line segment intersection test (for wall blocking)
function segmentsIntersect(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): boolean {
  const det = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(det) < 1e-10) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / det;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / det;
  return t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99;
}

function isPointNearRiverSegment(px: number, py: number, p1: { x: number; y: number }, p2: { x: number; y: number }, riverWidth: number): boolean {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - p1.x, py - p1.y) < riverWidth;
  const t = Math.max(0, Math.min(1, ((px - p1.x) * dx + (py - p1.y) * dy) / lenSq));
  const closestX = p1.x + t * dx;
  const closestY = p1.y + t * dy;
  return Math.hypot(px - closestX, py - closestY) < riverWidth;
}

function isPointNearBridge(px: number, py: number, bridges: { x: number; y: number }[], radius: number): boolean {
  return bridges.some(b => Math.hypot(px - b.x, py - b.y) < radius);
}

function isCellBlocked(wx: number, wy: number, terrainFeatures: TerrainFeature[], bridgeOutpostPositions?: { x: number; y: number }[]): boolean {
  // Block movement into ocean chunks
  const chunkX = Math.floor(wx / CHUNK_SIZE);
  const chunkY = Math.floor(wy / CHUNK_SIZE);
  if (isOceanChunk(chunkX, chunkY)) return true;
  const pad = PATH_GRID_CELL * 0.5;
  for (const t of terrainFeatures) {
    if (t.type === 'mountain') {
      if (isPointInEllipse(wx, wy, t.x, t.y, t.width / 2 + pad, t.height / 2 + pad)) return true;
    }
    if (t.type === 'lake') {
      if (isPointInEllipse(wx, wy, t.x, t.y, t.width / 2 + pad, t.height / 2 + pad)) return true;
    }
    if (t.type === 'river' && t.points && t.points.length > 1) {
      const riverW = (t.width || 1000) + pad;
      // Check if near river but NOT near a bridge (auto or player-built)
      for (let i = 0; i < t.points.length - 1; i++) {
        if (isPointNearRiverSegment(wx, wy, t.points[i], t.points[i + 1], riverW)) {
          // Check auto-bridges (legacy, should be empty now)
          if (t.bridgeAt && isPointNearBridge(wx, wy, t.bridgeAt, riverW * 2)) return false;
          // Check player-built bridge outposts
          if (bridgeOutpostPositions && isPointNearBridge(wx, wy, bridgeOutpostPositions, riverW * 2)) return false;
          return true;
        }
      }
    }
  }
  return false;
}

interface PathNode {
  x: number; y: number;
  g: number; h: number; f: number;
  parent: PathNode | null;
}

function findPath(startX: number, startY: number, endX: number, endY: number, terrainFeatures: TerrainFeature[], bridgeOutpostPositions?: { x: number; y: number }[]): { x: number; y: number }[] {
  const cell = PATH_GRID_CELL;
  const toGrid = (v: number) => Math.round(v / cell);
  const fromGrid = (g: number) => g * cell;
  
  const sx = toGrid(startX), sy = toGrid(startY);
  const ex = toGrid(endX), ey = toGrid(endY);
  
  // If start == end, return direct
  if (sx === ex && sy === ey) return [{ x: startX, y: startY }, { x: endX, y: endY }];
  
  // Limit search area to avoid performance issues
  const maxSearch = 800;
  const key = (gx: number, gy: number) => `${gx},${gy}`;
  
  const open: PathNode[] = [{ x: sx, y: sy, g: 0, h: Math.abs(ex - sx) + Math.abs(ey - sy), f: Math.abs(ex - sx) + Math.abs(ey - sy), parent: null }];
  const closed = new Set<string>();
  const gScores = new Map<string, number>();
  gScores.set(key(sx, sy), 0);
  
  let iterations = 0;
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
  
  while (open.length > 0 && iterations < maxSearch) {
    iterations++;
    // Find lowest f
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open[bestIdx];
    open.splice(bestIdx, 1);
    
    if (current.x === ex && current.y === ey) {
      // Reconstruct path
      const path: { x: number; y: number }[] = [];
      let node: PathNode | null = current;
      while (node) {
        path.unshift({ x: fromGrid(node.x), y: fromGrid(node.y) });
        node = node.parent;
      }
      // Replace first and last with exact positions
      path[0] = { x: startX, y: startY };
      path[path.length - 1] = { x: endX, y: endY };
      // Simplify: remove collinear points
      return simplifyPath(path);
    }
    
    const ck = key(current.x, current.y);
    if (closed.has(ck)) continue;
    closed.add(ck);
    
    for (const [dx, dy] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      
      const worldX = fromGrid(nx);
      const worldY = fromGrid(ny);
      if (isCellBlocked(worldX, worldY, terrainFeatures, bridgeOutpostPositions)) continue;
      
      const moveCost = dx !== 0 && dy !== 0 ? 1.414 : 1;
      const ng = current.g + moveCost;
      const existingG = gScores.get(nk);
      if (existingG !== undefined && ng >= existingG) continue;
      
      gScores.set(nk, ng);
      const h = Math.sqrt((ex - nx) ** 2 + (ey - ny) ** 2);
      open.push({ x: nx, y: ny, g: ng, h, f: ng + h, parent: current });
    }
  }
  
  // No path found — return empty to signal blocked
  return [];
}

function simplifyPath(path: { x: number; y: number }[]): { x: number; y: number }[] {
  if (path.length <= 2) return path;
  const result = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const prev = result[result.length - 1];
    const cur = path[i];
    const next = path[i + 1];
    // Check if collinear (within tolerance)
    const cross = (cur.x - prev.x) * (next.y - prev.y) - (cur.y - prev.y) * (next.x - prev.x);
    if (Math.abs(cross) > PATH_GRID_CELL * PATH_GRID_CELL * 0.1) {
      result.push(cur);
    }
  }
  result.push(path[path.length - 1]);
  return result;
}

function getPathLength(waypoints: { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 1; i < waypoints.length; i++) {
    len += Math.hypot(waypoints[i].x - waypoints[i - 1].x, waypoints[i].y - waypoints[i - 1].y);
  }
  return len;
}

function interpolateAlongPath(waypoints: { x: number; y: number }[], progress: number): { x: number; y: number } {
  if (waypoints.length < 2 || progress <= 0) return waypoints[0];
  if (progress >= 1) return waypoints[waypoints.length - 1];
  
  const totalLen = getPathLength(waypoints);
  const targetDist = totalLen * progress;
  
  let accumulated = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const segLen = Math.hypot(waypoints[i].x - waypoints[i - 1].x, waypoints[i].y - waypoints[i - 1].y);
    if (accumulated + segLen >= targetDist) {
      const segProgress = (targetDist - accumulated) / segLen;
      return {
        x: waypoints[i - 1].x + (waypoints[i].x - waypoints[i - 1].x) * segProgress,
        y: waypoints[i - 1].y + (waypoints[i].y - waypoints[i - 1].y) * segProgress,
      };
    }
    accumulated += segLen;
  }
  return waypoints[waypoints.length - 1];
}

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
const CHUNK_SIZE = 90000; // world units per chunk — spread out for cleaner map

interface TerrainFeature {
  type: 'lake' | 'mountain' | 'island' | 'river';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  points?: { x: number; y: number }[];
  bridgeAt?: { x: number; y: number }[];
  name: string;
}

interface Decoration {
  type: 'trees' | 'grass' | 'rocks';
  x: number;
  y: number;
  size: number;
  rotation: number;
  opacity: number;
}

const DECO_SPRITES: Record<Decoration['type'], string> = {
  trees: mapTrees,
  grass: mapGrass,
  rocks: mapRocks,
};

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
  decorations: Decoration[];
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
  Forest: '🌲', Steppe: '🌿', Badlands: '🌋', Coast: '⚓', Jungle: '🌴', Ocean: '🌊',
};
// ── Event variety system ──
const EVENT_BASES = [
  // DANGER events
  { names: ['Goblin Raid', 'Goblin Ambush', 'Goblin Warparty', 'Goblin Scouts', 'Goblin Pillagers'], descs: ['terrorizes nearby travelers', 'has set up camp along the road', 'is raiding supply lines', 'prowls the countryside', 'demands tribute from passersby'], emoji: '👺', type: 'danger' as const, basePower: 40 },
  { names: ['Dragon Sighting', 'Dragon\'s Lair', 'Wyrm Awakening', 'Drake Hunt', 'Wyvern Nest'], descs: ['roams the skies above', 'has been spotted near settlements', 'threatens livestock and farms', 'guards a hoard of treasure', 'circles overhead menacingly'], emoji: '🐲', type: 'danger' as const, basePower: 100 },
  { names: ['Bandit Camp', 'Highwayman\'s Den', 'Outlaw Hideout', 'Rogue Encampment', 'Brigand Stronghold'], descs: ['blocks a key trade route', 'ambushes merchant caravans', 'extorts travelers for safe passage', 'has been raiding nearby villages', 'hoards stolen goods in the hills'], emoji: '🗡️', type: 'danger' as const, basePower: 50 },
  { names: ['Orc Warband', 'Orcish Vanguard', 'Orc Siege Force', 'Orc Raiding Party', 'Orcish War Camp'], descs: ['marches towards settlements', 'burns farmsteads in its path', 'is mustering for a larger assault', 'demands submission or destruction', 'has enslaved local villagers'], emoji: '👹', type: 'danger' as const, basePower: 60 },
  { names: ['Pirate Cove', 'Smuggler\'s Bay', 'Sea Raider Camp', 'Corsair Haven', 'Buccaneer Inlet'], descs: ['hoards stolen treasure here', 'launches raids on coastal towns', 'shelters a fleet of raider ships', 'trades in stolen goods', 'terrorizes fishermen and merchants'], emoji: '🏴‍☠️', type: 'danger' as const, basePower: 90 },
  { names: ['Undead Rising', 'Skeleton Horde', 'Zombie Outbreak', 'Revenant March', 'Ghoul Swarm'], descs: ['claws its way from ancient graves', 'shambles across the countryside', 'has overrun a nearby graveyard', 'is drawn to the scent of the living', 'grows stronger each night'], emoji: '💀', type: 'danger' as const, basePower: 55 },
  { names: ['Troll Bridge', 'Hill Troll\'s Domain', 'Cave Troll Lair', 'Swamp Troll Crossing', 'Stone Troll Blockade'], descs: ['demands payment to cross', 'attacks anyone who approaches', 'has claimed the only bridge for miles', 'lurks beneath the stonework', 'regenerates from every wound'], emoji: '🧌', type: 'danger' as const, basePower: 45 },
  { names: ['Dark Cult Gathering', 'Blood Ritual Site', 'Heretic Assembly', 'Shadow Coven', 'Forbidden Ceremony'], descs: ['channels dark energies', 'sacrifices captives under moonlight', 'summons entities from beyond', 'corrupts the land around them', 'spreads madness to the unwary'], emoji: '🕯️', type: 'danger' as const, basePower: 70 },
  { names: ['Giant Spider Nest', 'Arachnid Colony', 'Webbed Hollow', 'Silk Spinner Den', 'Broodmother\'s Lair'], descs: ['has cocooned several travelers', 'spreads webs across the path', 'breeds at an alarming rate', 'ambushes prey from above', 'guards egg sacs the size of barrels'], emoji: '🕷️', type: 'danger' as const, basePower: 35 },
  { names: ['Wolves\' Hunting Ground', 'Dire Wolf Pack', 'Warg Riders', 'Shadow Wolves', 'Alpha\'s Territory'], descs: ['hunts in packs at dusk', 'has grown bold near settlements', 'attacks livestock nightly', 'eyes glow in the darkness', 'howls echo through the valley'], emoji: '🐺', type: 'danger' as const, basePower: 30 },
  // OPPORTUNITY events
  { names: ['Wandering Merchant', 'Traveling Trader', 'Exotic Bazaar', 'Nomad Market', 'Caravan Rest Stop'], descs: ['offers exotic goods from distant lands', 'sells rare materials at fair prices', 'barters wonders from across the sea', 'has unusual artifacts for sale', 'trades stories as freely as wares'], emoji: '🧙', type: 'opportunity' as const, basePower: 0 },
  { names: ['Harvest Festival', 'Autumn Celebration', 'Mead Hall Feast', 'Village Fair', 'Summer Solstice Gathering'], descs: ['welcomes all travelers to join', 'fills the air with music and laughter', 'offers bountiful food and drink', 'trades goods and shares news', 'celebrates a record harvest season'], emoji: '🎪', type: 'opportunity' as const, basePower: 0 },
  { names: ['Lost Caravan', 'Abandoned Wagons', 'Overturned Supply Cart', 'Deserted Merchant Train', 'Forgotten Stockpile'], descs: ['sits untouched by the road', 'was abandoned in haste — supplies intact', 'contains barrels of provisions', 'still has valuable cargo aboard', 'shows no sign of its owners returning'], emoji: '🏕️', type: 'opportunity' as const, basePower: 0 },
  { names: ['Sacred Grove', 'Enchanted Glade', 'Blessed Spring', 'Druid Circle', 'Ancient Wellspring'], descs: ['hums with restorative energy', 'heals wounds and lifts spirits', 'grants visions of the future', 'blooms with rare medicinal herbs', 'is tended by forest spirits'], emoji: '✨', type: 'opportunity' as const, basePower: 0 },
  { names: ['Iron Deposits', 'Mineral Vein', 'Ore Outcrop', 'Crystal Formation', 'Rich Lode'], descs: ['glints in the hillside', 'promises excellent yields', 'has been exposed by a landslide', 'could supply a forge for months', 'is remarkably pure and abundant'], emoji: '⛰️', type: 'opportunity' as const, basePower: 0 },
  { names: ['Refugee Camp', 'Displaced Villagers', 'War Survivors', 'Homeless Settlers', 'Orphaned Hamlet'], descs: ['seeks a safe place to settle', 'would join a kind lord willingly', 'offers labor in exchange for shelter', 'brings skilled craftsmen among them', 'has nowhere else to go'], emoji: '🏚️', type: 'opportunity' as const, basePower: 0 },
  { names: ['Fishing Bounty', 'River Shoal', 'Spawning Run', 'Lake of Plenty', 'Teeming Waters'], descs: ['overflows with fish this season', 'promises a season of full nets', 'attracts fishermen from miles away', 'provides food for any who cast a line', 'is a natural wonder of abundance'], emoji: '🐟', type: 'opportunity' as const, basePower: 0 },
  // MYSTERY events
  { names: ['Ancient Ruins', 'Crumbling Temple', 'Forgotten Citadel', 'Lost Library', 'Sunken Palace'], descs: ['hides secrets beneath the rubble', 'contains inscriptions in a dead language', 'may hold artifacts of immense power', 'echoes with whispers of the past', 'is partially reclaimed by nature'], emoji: '🏛️', type: 'mystery' as const, basePower: 30 },
  { names: ['Dark Portal', 'Void Rift', 'Dimensional Tear', 'Shadow Gate', 'Eldritch Doorway'], descs: ['pulses with unstable energy', 'warps reality around it', 'crackles with otherworldly light', 'draws creatures from other realms', 'could lead anywhere — or nowhere'], emoji: '🌀', type: 'mystery' as const, basePower: 80 },
  { names: ['Cursed Tomb', 'Haunted Crypt', 'Sealed Mausoleum', 'Pharaoh\'s Rest', 'Witch King\'s Barrow'], descs: ['emanates an eerie, cold glow', 'is sealed with ancient wards', 'whispers to those who draw near', 'promises treasure and terrible curses', 'has been undisturbed for millennia'], emoji: '⚰️', type: 'mystery' as const, basePower: 70 },
  { names: ['Fairy Ring', 'Mushroom Circle', 'Fey Crossing', 'Pixie Hollow', 'Sprite Clearing'], descs: ['glows softly at midnight', 'transports the unwary to strange places', 'is surrounded by dancing lights', 'grants wishes with a terrible price', 'shifts position with the seasons'], emoji: '🍄', type: 'mystery' as const, basePower: 20 },
  { names: ['Meteor Crash Site', 'Star Fall Crater', 'Sky Stone Impact', 'Celestial Fragment', 'Fallen Star'], descs: ['smolders with otherworldly heat', 'contains a strange glowing metal', 'has warped the ground around it', 'draws scholars and fortune seekers', 'pulses with an unknown energy'], emoji: '☄️', type: 'mystery' as const, basePower: 65 },
  { names: ['Whispering Stones', 'Standing Monoliths', 'Runestone Circle', 'Oracle Pillars', 'Singing Megaliths'], descs: ['hum with ancient power', 'reveal visions when touched', 'align with the stars above', 'speak prophecies to the worthy', 'were placed here by a forgotten race'], emoji: '🗿', type: 'mystery' as const, basePower: 25 },
  { names: ['Floating Island', 'Sky Ruin', 'Levitating Sanctuary', 'Cloud Fortress', 'Aerial Temple'], descs: ['drifts silently overhead', 'defies all known laws of nature', 'casts a vast shadow below', 'is accessible only by magic or flight', 'holds treasures from the Age of Wonders'], emoji: '🏝️', type: 'mystery' as const, basePower: 85 },
];

// Adjective modifiers for extra name variety
const EVENT_ADJECTIVES = ['Ancient', 'Fearsome', 'Legendary', 'Mysterious', 'Forgotten', 'Cursed', 'Hidden', 'Burning', 'Frozen', 'Savage', 'Haunted', 'Sacred', 'Dire', 'Grand', 'Lesser', 'Greater', 'Elder', 'Young', 'Spectral', 'Corrupted'];
const EVENT_LOCATIONS = ['of the Northern Pass', 'by the River Crossing', 'near the Old Road', 'in the Deep Valley', 'at the Mountain\'s Base', 'beyond the Treeline', 'along the Coast', 'beneath the Cliffs', 'on the High Plains', 'within the Mist', 'beside the Ancient Oak', 'atop the Hill', 'under the Crags', 'past the Ruins', 'outside the Swamp'];

// ── Ocean zone detection ──
// Uses seeded noise to create irregular ocean boundaries with bays, peninsulas, and straits
const OCEAN_NAMES = ['The Abyssal Deep', 'Sea of Storms', 'The Endless Blue', 'Drowned Expanse', 'Shattered Sea', 'The Void Waters', 'Mare Tenebris', 'Sea of Whispers', 'The Sunken Reach', 'Leviathan\'s Domain'];

// ── Distant exotic continent definitions ──
interface ExoticContinent {
  cx: number; cy: number; // center in chunk coords
  radius: number; // radius in chunks
  biome: string;
  name: string;
  seed: number;
}

const EXOTIC_CONTINENTS: ExoticContinent[] = [
  // Desert continent - east (was 55, now 28)
  { cx: 28, cy: 0, radius: 10, biome: 'Desert', name: 'The Scorchlands', seed: 3001 },
  // Jungle continent - south (was -10,55 now -5,28)
  { cx: -5, cy: 28, radius: 9, biome: 'Jungle', name: 'The Jade Wilds', seed: 3002 },
  // Lava continent - west (was -55, now -28)
  { cx: -28, cy: -3, radius: 8, biome: 'Lava', name: 'The Ashforge', seed: 3003 },
  // Island archipelago - northeast (was 40,-45 now 22,-24)
  { cx: 22, cy: -24, radius: 12, biome: 'Islands', name: 'The Shattered Isles', seed: 3004 },
  // Desert + jungle mix - southwest (was -40,50 now -20,25)
  { cx: -20, cy: 25, radius: 9, biome: 'Oasis', name: 'The Mirage Coast', seed: 3005 },
  // Volcanic islands - northwest (was -45,-45 now -23,-23)
  { cx: -23, cy: -23, radius: 7, biome: 'VolcanicIslands', name: 'The Cinderchain', seed: 3006 },
  // Deep jungle - southeast (was 45,45 now 23,23)
  { cx: 23, cy: 23, radius: 8, biome: 'DeepJungle', name: 'The Verdant Abyss', seed: 3007 },
];

function getExoticContinent(cx: number, cy: number): ExoticContinent | null {
  for (const ec of EXOTIC_CONTINENTS) {
    const dx = cx - ec.cx;
    const dy = cy - ec.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const wobbleSeed = hashCoords(Math.floor(angle * 6), 0, ec.seed);
    const wobble = (seededRandom(wobbleSeed)() - 0.5) * ec.radius * 0.3;
    if (dist < ec.radius + wobble) return ec;
  }
  return null;
}

function isOceanChunk(cx: number, cy: number): boolean {
  const dist = Math.sqrt(cx * cx + cy * cy);
  // Inner homeland is always land
  if (dist < 10) return false;
  
  // Check if on an exotic continent beyond the ocean
  if (getExoticContinent(cx, cy)) return false;
  
  // Transition zone (10-18): irregular coastline of the homeland
  if (dist <= 18) {
    const angle = Math.atan2(cy, cx);
    const coastSeed = hashCoords(Math.floor(angle * 8), 0, 7777);
    const coastRng = seededRandom(coastSeed);
    const coastThreshold = 11 + coastRng() * 7; // 11-18 chunks
    return dist > coastThreshold;
  }
  
  // Beyond 25 and not on exotic continent = ocean
  return true;
}

function isCoastalChunk(cx: number, cy: number): boolean {
  if (isOceanChunk(cx, cy)) return false;
  // Check if any neighbor is ocean
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      if (isOceanChunk(cx + dx, cy + dy)) return true;
    }
  }
  return false;
}

function generateChunk(chunkX: number, chunkY: number): ChunkData {
  const seed = hashCoords(chunkX, chunkY, 42);
  const rng = seededRandom(seed);
  const worldBaseX = chunkX * CHUNK_SIZE;
  const worldBaseY = chunkY * CHUNK_SIZE;

  // Distance from origin affects difficulty
  const dist = Math.sqrt(chunkX * chunkX + chunkY * chunkY);
  const difficultyMult = 1 + dist * 0.15;

  // ── Ocean chunks: deep water, no land content ──
  if (isOceanChunk(chunkX, chunkY)) {
    const oceanName = OCEAN_NAMES[Math.floor(rng() * OCEAN_NAMES.length)];
    // Occasional small islands in the ocean for exploration
    const terrain: TerrainFeature[] = [];
    if (rng() < 0.08) { // 8% chance of a tiny island
      terrain.push({
        type: 'island',
        x: worldBaseX + CHUNK_SIZE * 0.3 + rng() * CHUNK_SIZE * 0.4,
        y: worldBaseY + CHUNK_SIZE * 0.3 + rng() * CHUNK_SIZE * 0.4,
        width: 5000 + rng() * 10000,
        height: 4000 + rng() * 8000,
        rotation: rng() * 360,
        name: ['Lost Atoll', 'Shipwreck Isle', 'Skull Rock', 'Marooner\'s Key', 'Phantom Island', 'Coral Haven', 'Driftwood Reef', 'Siren\'s Rest'][Math.floor(rng() * 8)],
      });
    }
    // Rare sea events
    const events: ProceduralEvent[] = [];
    if (rng() < 0.15) {
      const seaEventBases = [
        { name: 'Kraken Sighting', desc: 'Massive tentacles breach the waves.', emoji: '🦑', type: 'danger' as const, power: 120 },
        { name: 'Ghost Ship', desc: 'A spectral vessel drifts aimlessly through the fog.', emoji: '⛵', type: 'mystery' as const, power: 80 },
        { name: 'Floating Wreckage', desc: 'Cargo from a sunken merchant vessel bobs in the waves.', emoji: '📦', type: 'opportunity' as const, power: 0 },
        { name: 'Sea Serpent', desc: 'A massive creature glides beneath the surface.', emoji: '🐍', type: 'danger' as const, power: 100 },
        { name: 'Treasure Map Fragment', desc: 'A waterlogged scrap of parchment washed ashore.', emoji: '🗺️', type: 'mystery' as const, power: 15 },
      ];
      const seaEvent = seaEventBases[Math.floor(rng() * seaEventBases.length)];
      const timeSeed = Math.floor(Date.now() / (1000 * 60 * 30));
      events.push({
        id: `event-${chunkX}-${chunkY}-sea-${timeSeed}`,
        name: seaEvent.name,
        description: `${seaEvent.name} ${seaEvent.desc}`,
        emoji: seaEvent.emoji,
        type: seaEvent.type,
        power: Math.floor(seaEvent.power * difficultyMult),
        x: worldBaseX + 15000 + rng() * (CHUNK_SIZE - 30000),
        y: worldBaseY + 15000 + rng() * (CHUNK_SIZE - 30000),
        reward: {
          gold: Math.floor((80 + rng() * 300) * difficultyMult),
          wood: seaEvent.type === 'opportunity' ? Math.floor(50 * difficultyMult) : 0,
          stone: 0,
          food: seaEvent.type === 'opportunity' ? Math.floor(40 * difficultyMult) : 0,
        },
      });
    }
    return { realms: [], events, terrain, steelMines: [], decorations: [], regionName: oceanName, regionBiome: 'Ocean' };
  }

  // ── Exotic continent chunks: unique biomes far from spawn ──
  const exoticContinent = getExoticContinent(chunkX, chunkY);
  if (exoticContinent) {
    const ecBiome = exoticContinent.biome;
    const ecName = exoticContinent.name;
    const terrain: TerrainFeature[] = [];
    const events: ProceduralEvent[] = [];

    // Exotic terrain based on biome type
    if (ecBiome === 'Lava' || ecBiome === 'VolcanicIslands') {
      // Lava rivers and volcanic mountains
      if (rng() < 0.4) {
        terrain.push({
          type: 'mountain', x: worldBaseX + rng() * CHUNK_SIZE, y: worldBaseY + rng() * CHUNK_SIZE,
          width: 12000 + rng() * 20000, height: 10000 + rng() * 15000, rotation: rng() * 360,
          name: ['Mt. Inferno', 'Ashpeak', 'The Crucible', 'Magma Spire', 'Ember Summit'][Math.floor(rng() * 5)],
        });
      }
      if (rng() < 0.3) {
        const p1 = { x: worldBaseX + rng() * CHUNK_SIZE * 0.3, y: worldBaseY + rng() * CHUNK_SIZE };
        const p2 = { x: worldBaseX + CHUNK_SIZE * 0.5 + rng() * CHUNK_SIZE * 0.5, y: worldBaseY + rng() * CHUNK_SIZE };
        terrain.push({
          type: 'river', points: [p1, p2], width: 3000 + rng() * 4000, x: p1.x, y: p1.y, height: 0,
          name: ['Lava Flow', 'Molten Run', 'Magma Stream', 'Fire River'][Math.floor(rng() * 4)],
        });
      }
    } else if (ecBiome === 'Desert' || ecBiome === 'Oasis') {
      // Sand dunes as mountains, oasis lakes
      if (rng() < 0.35) {
        terrain.push({
          type: 'mountain', x: worldBaseX + rng() * CHUNK_SIZE, y: worldBaseY + rng() * CHUNK_SIZE,
          width: 15000 + rng() * 25000, height: 8000 + rng() * 12000, rotation: rng() * 360,
          name: ['The Great Dune', 'Sandspire', 'Dustwall', 'Golden Mesa', 'Sun Anvil'][Math.floor(rng() * 5)],
        });
      }
      if (ecBiome === 'Oasis' && rng() < 0.25) {
        terrain.push({
          type: 'lake', x: worldBaseX + CHUNK_SIZE * 0.3 + rng() * CHUNK_SIZE * 0.4,
          y: worldBaseY + CHUNK_SIZE * 0.3 + rng() * CHUNK_SIZE * 0.4,
          width: 6000 + rng() * 10000, height: 5000 + rng() * 8000, rotation: rng() * 60,
          name: ['Crystal Oasis', 'Mirage Pool', 'Palm Spring', 'Hidden Waters'][Math.floor(rng() * 4)],
        });
      }
    } else if (ecBiome === 'Jungle' || ecBiome === 'DeepJungle') {
      // Dense rivers and thick terrain
      if (rng() < 0.5) {
        const pts = [];
        const numPts = 3 + Math.floor(rng() * 3);
        for (let p = 0; p < numPts; p++) {
          pts.push({ x: worldBaseX + (p / numPts) * CHUNK_SIZE, y: worldBaseY + CHUNK_SIZE * 0.3 + rng() * CHUNK_SIZE * 0.4 });
        }
        terrain.push({
          type: 'river', points: pts, width: 4000 + rng() * 6000, x: pts[0].x, y: pts[0].y, height: 0,
          name: ['Emerald River', 'Serpent Flow', 'Canopy Creek', 'Vine Run', 'Jade Stream'][Math.floor(rng() * 5)],
        });
      }
      if (rng() < 0.25) {
        terrain.push({
          type: 'mountain', x: worldBaseX + rng() * CHUNK_SIZE, y: worldBaseY + rng() * CHUNK_SIZE,
          width: 10000 + rng() * 15000, height: 8000 + rng() * 12000, rotation: rng() * 360,
          name: ['Canopy Peak', 'Misty Summit', 'Overgrown Crag'][Math.floor(rng() * 3)],
        });
      }
    } else if (ecBiome === 'Islands') {
      // Scattered islands with water between
      const islandCount = 1 + Math.floor(rng() * 3);
      for (let il = 0; il < islandCount; il++) {
        terrain.push({
          type: 'island', x: worldBaseX + CHUNK_SIZE * 0.15 + rng() * CHUNK_SIZE * 0.7,
          y: worldBaseY + CHUNK_SIZE * 0.15 + rng() * CHUNK_SIZE * 0.7,
          width: 8000 + rng() * 15000, height: 6000 + rng() * 12000, rotation: rng() * 360,
          name: ['Coral Isle', 'Driftwood Key', 'Palm Atoll', 'Turtle Beach', 'Reef Haven', 'Storm Rock'][Math.floor(rng() * 6)],
        });
      }
    }

    // Exotic events
    const exoticEventBases: { name: string; desc: string; emoji: string; type: 'danger' | 'mystery' | 'opportunity'; power: number }[] = ecBiome === 'Lava' || ecBiome === 'VolcanicIslands' ? [
      { name: 'Eruption Warning', desc: 'The ground trembles with volcanic fury.', emoji: '🌋', type: 'danger', power: 200 },
      { name: 'Obsidian Cache', desc: 'Glassy black stone worth a fortune.', emoji: '💎', type: 'opportunity', power: 50 },
      { name: 'Fire Elemental', desc: 'A being of pure flame guards this pass.', emoji: '🔥', type: 'danger', power: 180 },
    ] : ecBiome === 'Desert' || ecBiome === 'Oasis' ? [
      { name: 'Sandstorm', desc: 'A wall of choking sand approaches.', emoji: '🌪️', type: 'danger', power: 150 },
      { name: 'Ancient Tomb', desc: 'A buried pharaoh\'s treasure awaits.', emoji: '🏛️', type: 'mystery', power: 100 },
      { name: 'Nomad Caravan', desc: 'Traders from distant lands offer exotic goods.', emoji: '🐪', type: 'opportunity', power: 30 },
    ] : ecBiome === 'Jungle' || ecBiome === 'DeepJungle' ? [
      { name: 'Temple Ruins', desc: 'Ancient carvings hint at hidden treasure.', emoji: '🏯', type: 'mystery', power: 120 },
      { name: 'Predator Pack', desc: 'Dangerous beasts prowl the undergrowth.', emoji: '🐆', type: 'danger', power: 160 },
      { name: 'Rare Herbs', desc: 'Medicinal plants grow in abundance.', emoji: '🌿', type: 'opportunity', power: 20 },
    ] : [
      { name: 'Shipwreck', desc: 'A vessel run aground on the reef.', emoji: '🚢', type: 'opportunity', power: 40 },
      { name: 'Sea Monster', desc: 'Something massive lurks in the shallows.', emoji: '🐙', type: 'danger', power: 170 },
      { name: 'Pirate Hideout', desc: 'Buccaneers have stashed their loot here.', emoji: '☠️', type: 'mystery', power: 90 },
    ];
    if (rng() < 0.3) {
      const ev = exoticEventBases[Math.floor(rng() * exoticEventBases.length)];
      const timeSeed = Math.floor(Date.now() / (1000 * 60 * 30));
      events.push({
        id: `event-${chunkX}-${chunkY}-exotic-${timeSeed}`,
        name: ev.name, description: `${ev.name}: ${ev.desc}`, emoji: ev.emoji, type: ev.type,
        power: Math.floor(ev.power * difficultyMult),
        x: worldBaseX + 15000 + rng() * (CHUNK_SIZE - 30000),
        y: worldBaseY + 15000 + rng() * (CHUNK_SIZE - 30000),
        reward: { gold: Math.floor((150 + rng() * 500) * difficultyMult), wood: Math.floor(rng() * 200 * difficultyMult), stone: Math.floor(rng() * 200 * difficultyMult), food: Math.floor(rng() * 150 * difficultyMult) },
      });
    }

    // Map biome display name
    const displayBiome = ecBiome === 'VolcanicIslands' ? 'Lava' : ecBiome === 'DeepJungle' ? 'Jungle' : ecBiome === 'Oasis' ? 'Desert' : ecBiome === 'Islands' ? 'Coast' : ecBiome;
    return { realms: [], events, terrain, steelMines: [], decorations: [], regionName: ecName, regionBiome: displayBiome };
  }

  // ── Coastal chunks: force Coast biome ──
  const isCoastal = isCoastalChunk(chunkX, chunkY);

  // Generate region name for this chunk
  const regionName = generateRegionName(rng);
  const regionBiome = isCoastal ? 'Coast' : BIOME_TYPES[Math.floor(rng() * BIOME_TYPES.length)];

  // 0-1 realms per chunk (reduced density for cleaner map)
  const realmCount = rng() < 0.45 ? 0 : 1;
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
      x: worldBaseX + 15000 + rng() * (CHUNK_SIZE - 30000),
      y: worldBaseY + 15000 + rng() * (CHUNK_SIZE - 30000),
      emoji: REALM_EMOJIS[emojiIdx],
      type,
      desc: `A ${type} kingdom in the ${dist < 3 ? 'heartlands' : dist < 8 ? 'frontier' : 'deep wilds'}. Power grows with distance from the center.`,
      territory: 8000 + Math.floor(rng() * 16000),
    });
  }

  // 1-4 events per chunk — use time-based seed rotation so events change periodically
  const timeSeed = Math.floor(Date.now() / (1000 * 60 * 30)); // rotates every 30 minutes
  const eventRng = seededRandom(hashCoords(chunkX, chunkY, timeSeed + 99));
  const eventCount = 1 + Math.floor(eventRng() * 2); // reduced from 4 to 2 max extras
  const events: ProceduralEvent[] = [];
  for (let i = 0; i < eventCount; i++) {
    const baseIdx = Math.floor(eventRng() * EVENT_BASES.length);
    const base = EVENT_BASES[baseIdx];
    const nameIdx = Math.floor(eventRng() * base.names.length);
    const descIdx = Math.floor(eventRng() * base.descs.length);
    let eventName = base.names[nameIdx];
    const adjRoll = eventRng();
    if (adjRoll < 0.3) {
      eventName = `${EVENT_ADJECTIVES[Math.floor(eventRng() * EVENT_ADJECTIVES.length)]} ${eventName}`;
    }
    let eventDesc = `${eventName} ${base.descs[descIdx]}`;
    const locRoll = eventRng();
    if (locRoll < 0.5) {
      eventDesc += ` ${EVENT_LOCATIONS[Math.floor(eventRng() * EVENT_LOCATIONS.length)]}`;
    }
    const rewardMult = difficultyMult;
    events.push({
      id: `event-${chunkX}-${chunkY}-${i}-${timeSeed}`,
      name: eventName,
      description: eventDesc + '.',
      emoji: base.emoji,
      type: base.type,
      power: Math.floor(base.basePower * difficultyMult),
      x: worldBaseX + 10000 + eventRng() * (CHUNK_SIZE - 20000),
      y: worldBaseY + 10000 + eventRng() * (CHUNK_SIZE - 20000),
      reward: {
        gold: Math.floor((50 + eventRng() * 200) * rewardMult),
        wood: base.type === 'opportunity' ? Math.floor((30 + eventRng() * 100) * rewardMult) : 0,
        stone: base.type === 'mystery' ? Math.floor((40 + eventRng() * 120) * rewardMult) : 0,
        food: base.type === 'opportunity' ? Math.floor((30 + eventRng() * 80) * rewardMult) : 0,
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

  // Mountains (0-3 per chunk, more in Highlands/Tundra/Badlands) — vast and impassable
  const mtnChance = regionBiome === 'Highlands' || regionBiome === 'Tundra' || regionBiome === 'Badlands' ? 0.9 : 0.3;
  const mtnCount = rng() < mtnChance ? 1 + Math.floor(rng() * 3) : 0;
  for (let i = 0; i < mtnCount; i++) {
    terrain.push({
      type: 'mountain',
      x: worldBaseX + 10000 + rng() * (CHUNK_SIZE - 20000),
      y: worldBaseY + 10000 + rng() * (CHUNK_SIZE - 20000),
      width: 12000 + rng() * 20000,
      height: 10000 + rng() * 18000,
      name: MTN_NAMES[Math.floor(rng() * MTN_NAMES.length)],
    });
  }

  // Rivers (0-1 per chunk) — wide and impassable, NO auto-bridges
  // Bridges can only be built by upgrading an outpost near a river
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
    terrain.push({
      type: 'river',
      x: riverPoints[0].x,
      y: riverPoints[0].y,
      width: 3000 + rng() * 3000,
      height: 0,
      points: riverPoints,
      bridgeAt: [], // No auto-bridges — only player-built bridge outposts
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
  const mineChance = regionBiome === 'Highlands' || regionBiome === 'Badlands' ? 0.5 : regionBiome === 'Tundra' ? 0.3 : 0.12;
  if (rng() < mineChance) {
    steelMines.push({
      id: `mine-${chunkX}-${chunkY}`,
      name: MINE_NAMES[Math.floor(rng() * MINE_NAMES.length)],
      x: worldBaseX + 15000 + rng() * (CHUNK_SIZE - 30000),
      y: worldBaseY + 15000 + rng() * (CHUNK_SIZE - 30000),
      steelPerTick: getMineSteelPerTickForChunk(chunkX, chunkY),
      power: Math.floor((30 + rng() * 80) * difficultyMult),
    });
  }

  // ── Decorations (trees, grass, rocks) — sparse scatter for clean look ──
  const decorations: Decoration[] = [];
  const decoTypes: Decoration['type'][] = 
    regionBiome === 'Forest' || regionBiome === 'Jungle' ? ['trees', 'trees', 'grass'] :
    regionBiome === 'Plains' || regionBiome === 'Steppe' ? ['grass', 'grass', 'trees'] :
    regionBiome === 'Highlands' || regionBiome === 'Badlands' ? ['rocks', 'rocks', 'trees'] :
    regionBiome === 'Tundra' ? ['rocks', 'grass'] :
    regionBiome === 'Desert' ? ['rocks'] :
    ['trees', 'grass', 'rocks'];
  const decoCount = regionBiome === 'Desert' ? 2 + Math.floor(rng() * 2) : 4 + Math.floor(rng() * 4);
  for (let i = 0; i < decoCount; i++) {
    const dt = decoTypes[Math.floor(rng() * decoTypes.length)];
    decorations.push({
      type: dt,
      x: worldBaseX + 8000 + rng() * (CHUNK_SIZE - 16000),
      y: worldBaseY + 8000 + rng() * (CHUNK_SIZE - 16000),
      size: dt === 'trees' ? 3500 + rng() * 4000 : dt === 'grass' ? 5000 + rng() * 6000 : 2500 + rng() * 3500,
      rotation: rng() * 360,
      opacity: 0.15 + rng() * 0.25,
    });
  }

  return { realms, events, terrain, steelMines, decorations, regionName, regionBiome };
}

// ── Chunk cache (time-keyed so events rotate) ──
const chunkCache = new Map<string, ChunkData>();
let chunkCacheTimeSeed = Math.floor(Date.now() / (1000 * 60 * 30));

function getChunk(cx: number, cy: number): ChunkData {
  const currentTimeSeed = Math.floor(Date.now() / (1000 * 60 * 30));
  // Invalidate cache when time seed changes (events rotate every 30min)
  if (currentTimeSeed !== chunkCacheTimeSeed) {
    chunkCache.clear();
    chunkCacheTimeSeed = currentTimeSeed;
  }
  const key = `${cx},${cy}`;
  if (!chunkCache.has(key)) {
    chunkCache.set(key, generateChunk(cx, cy));
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
  | { kind: 'npc'; data: ProceduralRealm; biome: string }
  | { kind: 'event'; data: ProceduralEvent; chunkKey: string; index: number }
  | { kind: 'player'; data: any }
  | { kind: 'mine'; data: SteelMine }
  | { kind: 'outpost'; data: { id: string; x: number; y: number; name: string; user_id: string; level: number; garrison_power: number; garrison_troops: Partial<Record<string, number>>; has_wall: boolean; wall_level: number; territory_radius: number; outpost_type: string } }
  | { kind: 'empty'; data: { x: number; y: number } }
  | null;

export default function WorldMap() {
  const { allVillages, addResources, army, totalArmyPower, attackTarget, attackPlayer, vassalages, buildings, displayName, spies, sendSpyMission, activeSpyMissions, resources, getWatchtowerLevel, getSpyGuildLevel, refreshVillages, refreshMineOutposts, myVillages, settlementType, deployTroops, returnTroops } = useGame();
  const { user } = useAuth();
  const npcState = useNPCState();
  const { activeSkin, getBuildingSprite, getSpriteFilter } = useTroopSkins();
  const [selected, setSelected] = useState<SelectedItem>(null);
  const [claimedEvents, setClaimedEvents] = useState<Set<string>>(new Set());
  const [capturedMines, setCapturedMines] = useState<Set<string>>(new Set());
  const [outposts, setOutposts] = useState<{ id: string; x: number; y: number; name: string; user_id: string; level: number; garrison_power: number; garrison_troops: Partial<Record<string, number>>; has_wall: boolean; wall_level: number; territory_radius: number; outpost_type: string }[]>([]);
  const [wallSegments, setWallSegments] = useState<{ id: string; user_id: string; outpost_a_id: string; outpost_b_id: string; wall_level: number; health: number; max_health: number }[]>([]);
  const [outpostBuildQueue, setOutpostBuildQueue] = useState<{ outpostId: string; action: 'upgrade' | 'wall'; finishTime: number; targetLevel: number; newGarrison: number; newRadius?: number; targetOutpostId?: string }[]>([]);
  const [marches, setMarches] = useState<{ id: string; targetName: string; arrivalTime: number; startTime: number; startX: number; startY: number; targetX: number; targetY: number; waypoints: { x: number; y: number }[]; action: () => void; sentArmy?: Partial<Record<string, number>> }[]>([]);
  const [otherMarches, setOtherMarches] = useState<{ id: string; user_id: string; player_name: string; start_x: number; start_y: number; target_x: number; target_y: number; target_name: string; started_at: string; arrives_at: string; march_type: string }[]>([]);
  const [tradeContracts, setTradeContracts] = useState<{ realmId: string; realmName: string; expiresAt: number; bonus: Partial<Record<string, number>> }[]>([]);
  const [legendOpen, setLegendOpen] = useState(false);
  const [, forceRender] = useState(0);
  const [attackConfig, setAttackConfig] = useState<{
    targetName: string; targetPower?: number; targetId?: string;
    targetX: number; targetY: number; travelTime: number;
    onAttack: (sentArmy: Partial<import('@/hooks/useGameState').Army>) => void;
    showEspionage: boolean;
  } | null>(null);

  // ── Subscribe to other players' marches in realtime ──
  useEffect(() => {
    if (!user) return;
    // Load existing active marches
    const loadMarches = async () => {
      const { data } = await supabase.from('active_marches').select('*');
      if (data) setOtherMarches(data.filter((m: any) => m.user_id !== user.id && new Date(m.arrives_at).getTime() > Date.now()));
    };
    loadMarches();

    const channel = supabase
      .channel('active-marches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_marches' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const m = payload.new as any;
          if (m.user_id !== user.id) {
            setOtherMarches(prev => [...prev, m]);
          }
        } else if (payload.eventType === 'DELETE') {
          setOtherMarches(prev => prev.filter(m => m.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ── Restore own active marches from DB on mount (survives tab switches) ──
  useEffect(() => {
    if (!user) return;
    const restoreOwnMarches = async () => {
      const { data } = await supabase.from('active_marches')
        .select('*')
        .eq('user_id', user.id)
        .gt('arrives_at', new Date().toISOString());
      if (!data || data.length === 0) return;
      setMarches(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const restored = data
          .filter((m: any) => !existingIds.has(m.id))
          .map((m: any) => ({
            id: m.id,
            targetName: m.target_name || 'Unknown',
            arrivalTime: new Date(m.arrives_at).getTime(),
            startTime: new Date(m.started_at).getTime(),
            startX: m.start_x,
            startY: m.start_y,
            targetX: m.target_x,
            targetY: m.target_y,
            waypoints: [{ x: m.start_x, y: m.start_y }, { x: m.target_x, y: m.target_y }],
            action: () => {
              // Restored march — arrival toast only; attack resolution already handled or needs server-side processing
            },
          }));
        return [...prev, ...restored];
      });
    };
    restoreOwnMarches();
  }, [user]);

  // Clean up expired other marches
  useEffect(() => {
    if (otherMarches.length === 0) return;
    const interval = setInterval(() => {
      setOtherMarches(prev => prev.filter(m => new Date(m.arrives_at).getTime() > Date.now()));
    }, 3000);
    return () => clearInterval(interval);
  }, [otherMarches.length]);

  // Get TH level for dynamic sprite
  const townhallLevel = buildings.find(b => b.type === 'townhall')?.level || 1;

  const SETTLEMENT_TIER_SPRITES: Record<string, string> = {
    village: mapVillageTier,
    town: mapTownTier,
    city: mapCityTier,
  };

  const getSettlementSprite = (settlementTier: string, isMe: boolean) => {
    // If the current player has a faction skin, use faction-specific tier sprites
    if (isMe && activeSkin.id !== 'default') {
      const factionTierSprites = FACTION_MAP_SPRITES[activeSkin.id];
      if (factionTierSprites) {
        return factionTierSprites[settlementTier as keyof typeof factionTierSprites] || factionTierSprites.village;
      }
    }
    return SETTLEMENT_TIER_SPRITES[settlementTier] || mapVillageTier;
  };

  const SETTLEMENT_LABELS: Record<string, string> = {
    village: '🏠 Village',
    town: '🏘️ Town',
    city: '🏰 City',
  };

  // Load outposts and outpost build queue from database on mount
  useEffect(() => {
    if (!user) return;
    supabase.from('outposts').select('*').then(({ data }) => {
      if (data && data.length > 0) {
        setOutposts(data.map((o: any) => ({ id: o.id, x: o.x, y: o.y, name: o.name, user_id: o.user_id, level: o.level || 1, garrison_power: o.garrison_power || 0, garrison_troops: o.garrison_troops || {}, has_wall: o.has_wall || false, wall_level: o.wall_level || 0, territory_radius: o.territory_radius || 15000, outpost_type: o.outpost_type || 'outpost' })));
        // Initialize captured mines from outposts with type 'mine'
        const mineOutposts = data.filter((o: any) => o.outpost_type === 'mine' && o.user_id === user.id);
        if (mineOutposts.length > 0) {
          setCapturedMines(new Set(mineOutposts.map((o: any) => o.name)));
        }
      }
    });
    // Load wall segments
    supabase.from('wall_segments').select('*').then(({ data }) => {
      if (data) {
        setWallSegments(data.map((w: any) => ({ id: w.id, user_id: w.user_id, outpost_a_id: w.outpost_a_id, outpost_b_id: w.outpost_b_id, wall_level: w.wall_level, health: w.health, max_health: w.max_health })));
      }
    });
    // Load persisted outpost build queue entries
    supabase.from('build_queue').select('*').eq('user_id', user.id).in('building_type', ['outpost_upgrade', 'outpost_wall']).then(({ data }) => {
      if (data && data.length > 0) {
        const queue = data.map((q: any) => ({
          outpostId: q.building_id,
          action: q.building_type === 'outpost_upgrade' ? 'upgrade' as const : 'wall' as const,
          finishTime: new Date(q.finish_time).getTime(),
          targetLevel: q.target_level,
          newGarrison: 0, // recalculated on completion
          newRadius: 0,
        }));
        setOutpostBuildQueue(queue);
      }
    });
  }, [user]);

  // ── Outpost build queue timer ──
  useEffect(() => {
    if (outpostBuildQueue.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const completed = outpostBuildQueue.filter(q => q.finishTime <= now);
      const remaining = outpostBuildQueue.filter(q => q.finishTime > now);
      if (completed.length > 0) {
        setOutpostBuildQueue(remaining);
        for (const q of completed) {
          if (q.action === 'upgrade') {
            const baseGarrison = (q.targetLevel - 1) * 20;
            const baseRadius = 15000 + (q.targetLevel - 1) * 3000;
            supabase.from('outposts').update({ level: q.targetLevel, garrison_power: baseGarrison, territory_radius: baseRadius } as any).eq('id', q.outpostId).then();
            setOutposts(prev2 => prev2.map(o => o.id === q.outpostId ? { ...o, level: q.targetLevel, garrison_power: baseGarrison, territory_radius: baseRadius } : o));
            toast.success(`🏕️ Outpost upgraded to Lv.${q.targetLevel}!`);
          } else {
            const wallGarrison = q.targetLevel * 30;
            supabase.from('outposts').update({ has_wall: true, wall_level: q.targetLevel, garrison_power: wallGarrison } as any).eq('id', q.outpostId).then();
            setOutposts(prev2 => prev2.map(o => o.id === q.outpostId ? { ...o, has_wall: true, wall_level: q.targetLevel, garrison_power: wallGarrison } : o));
            toast.success(`🧱 Wall ${q.targetLevel > 1 ? 'upgraded' : 'built'}!`);
          }
        }
        supabase.from('build_queue').delete()
          .eq('user_id', user?.id ?? '')
          .in('building_type', ['outpost_upgrade', 'outpost_wall'])
          .lte('finish_time', new Date(now).toISOString())
          .then();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [outpostBuildQueue.length, user?.id]);

  // NPC vassal tribute income (from persistent state)
  useEffect(() => {
    const vassalNPCs = Array.from(npcState.playerRelations.values()).filter(r => r.status === 'vassal');
    if (vassalNPCs.length === 0) return;
    const interval = setInterval(() => {
      let totalGold = 0, totalFood = 0;
      for (const v of vassalNPCs) {
        totalGold += Math.floor(v.tribute_rate * 0.5);
        totalFood += Math.floor(v.tribute_rate * 0.3);
      }
      if (totalGold > 0 || totalFood > 0) addResources({ gold: totalGold, food: totalFood });
    }, 15000);
    return () => clearInterval(interval);
  }, [npcState.playerRelations, addResources]);

  // Animate marches — re-render every 500ms for smooth interpolation
  useEffect(() => {
    if (marches.length === 0) return;
    const interval = setInterval(() => forceRender(v => v + 1), 500);
    return () => clearInterval(interval);
  }, [marches.length]);

  // Process marches
  useEffect(() => {
    if (marches.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const arrived = marches.filter(m => m.arrivalTime <= now);
      if (arrived.length === 0) return;
      const remaining = marches.filter(m => m.arrivalTime > now);
      setMarches(remaining);
      // Execute actions OUTSIDE the state updater to avoid swallowed side effects
      arrived.forEach(m => {
        toast.success(`Troops arrived at ${m.targetName}!`);
        try {
          m.action();
        } catch (err) {
          console.error('March action failed:', err);
          toast.error(`⚠️ Battle at ${m.targetName} failed — troops returned home.`);
          // Return all sent troops on failure
          if (m.sentArmy) {
            returnTroops(m.sentArmy as any);
          }
        }
      });
      // Clean up arrived marches from DB
      if (user) {
        supabase.from('active_marches').delete().eq('user_id', user.id).lte('arrives_at', new Date().toISOString()).then(() => {});
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [marches, user, returnTroops]);

  // createMarch is defined below after getMyPos

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
  const initializedCamera = useRef(false);
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

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const drag = dragStart.current;
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      const moved = Math.abs(dx) + Math.abs(dy);
      // If barely moved, treat as a click on empty space
      if (moved < 5 && !(e.target as HTMLElement).closest('[data-map-item]')) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const screenX = e.clientX - rect.left;
          const screenY = e.clientY - rect.top;
          const worldX = camera.cx + (screenX - containerSize.w / 2) / camera.ppu;
          const worldY = camera.cy + (screenY - containerSize.h / 2) / camera.ppu;
          setSelected({ kind: 'empty', data: { x: worldX, y: worldY } });
        }
      }
    }
    dragStart.current = null;
  }, [camera, containerSize]);

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
    // Use actual map_x/map_y from the village data if available
    const village = allVillages.find(v => v.village.id === id);
    if (village && (village.village.map_x !== 0 || village.village.map_y !== 0)) {
      return { x: village.village.map_x, y: village.village.map_y };
    }
    // Fallback: deterministic position based on village id
    let h = 5381;
    for (let i = 0; i < id.length; i++) {
      h = ((h << 5) + h + id.charCodeAt(i)) >>> 0;
    }
    const h2 = ((h * 2654435761) >>> 0);
    const angle = (h % 10000) / 10000 * Math.PI * 2;
    const radius = 25000 + (h2 % 120000);
    return {
      x: 100000 + Math.cos(angle) * radius,
      y: 100000 + Math.sin(angle) * radius,
    };
  };

  // goHome moved below getMyPos

  const getMyPos = useCallback(() => {
    if (!user) return { x: 100000, y: 100000 };
    const myVillage = allVillages.find(v => v.village.user_id === user.id);
    return getPlayerPos(myVillage?.village.id || 'me');
  }, [user, allVillages]);

  const goHome = useCallback(() => {
    const pos = getMyPos();
    setCamera({ cx: pos.x, cy: pos.y, ppu: 0.003 });
  }, [getMyPos]);

  // Center camera on player's village when map first loads
  useEffect(() => {
    if (initializedCamera.current) return;
    const pos = getMyPos();
    if (pos.x !== 100000 || pos.y !== 100000) {
      setCamera(prev => ({ ...prev, cx: pos.x, cy: pos.y }));
      initializedCamera.current = true;
    }
  }, [getMyPos]);

  const visionSources = useMemo(() => {
    const scoutCount = army.scout || 0;
    const wtLevel = getWatchtowerLevel();
    const baseVisionWorld = 55000 + scoutCount * 10000 + wtLevel * WATCHTOWER_RANGE_BONUS;
    const outpostBaseVision = 40000;

    // Add vision from ALL player settlements
    const settlementVision = allVillages
      .filter(v => v.village.user_id === user?.id)
      .map(v => {
        const pos = getPlayerPos(v.village.id);
        return { x: pos.x, y: pos.y, radius: baseVisionWorld };
      });

    // Fallback if no villages found
    if (settlementVision.length === 0) {
      const myPos = getMyPos();
      settlementVision.push({ x: myPos.x, y: myPos.y, radius: baseVisionWorld });
    }

    return [
      ...settlementVision,
      ...outposts
        .filter(outpost => outpost.user_id === user?.id)
        .map(outpost => ({
          x: outpost.x,
          y: outpost.y,
          radius: outpostBaseVision + (outpost.level || 1) * 5000,
        })),
    ];
  }, [army.scout, getMyPos, allVillages, outposts, user?.id, getWatchtowerLevel]);

  const isWithinVision = useCallback((wx: number, wy: number, padding = 0) => {
    return visionSources.some(source => Math.hypot(wx - source.x, wy - source.y) <= source.radius + padding);
  }, [visionSources]);

  // Collect all terrain for pathfinding — includes visible chunks
  const visibleTerrain = useMemo(() => {
    const terrain: TerrainFeature[] = [];
    for (const chunk of visibleChunks) {
      terrain.push(...chunk.data.terrain);
    }
    return terrain;
  }, [visibleChunks]);

  // Gather terrain along a march path (visible + all chunks between start and target)
  const getTerrainForPath = useCallback((startX: number, startY: number, endX: number, endY: number): TerrainFeature[] => {
    const terrain: TerrainFeature[] = [...visibleTerrain];
    const loadedKeys = new Set(visibleChunks.map(c => `${c.cx},${c.cy}`));

    // Determine all chunk coords along the bounding box of the path (with padding)
    const pad = CHUNK_SIZE;
    const minCX = Math.floor((Math.min(startX, endX) - pad) / CHUNK_SIZE);
    const maxCX = Math.floor((Math.max(startX, endX) + pad) / CHUNK_SIZE);
    const minCY = Math.floor((Math.min(startY, endY) - pad) / CHUNK_SIZE);
    const maxCY = Math.floor((Math.max(startY, endY) + pad) / CHUNK_SIZE);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const key = `${cx},${cy}`;
        if (loadedKeys.has(key)) continue;
        loadedKeys.add(key);
        const chunk = getChunk(cx, cy);
        terrain.push(...chunk.terrain);
      }
    }
    return terrain;
  }, [visibleTerrain, visibleChunks]);

  // Bridge outpost positions for pathfinding — outposts with type 'bridge' allow crossing rivers
  const bridgeOutpostPositions = useMemo(() => {
    return outposts.filter(o => o.outpost_type === 'bridge').map(o => ({ x: o.x, y: o.y }));
  }, [outposts]);

  // Helper to create a march with pathfinding around obstacles
  // Check if a line segment from (ax,ay)->(bx,by) crosses any enemy wall segment
  const findBlockingWall = useCallback((ax: number, ay: number, bx: number, by: number): typeof wallSegments[0] | null => {
    if (!user) return null;
    for (const ws of wallSegments) {
      if (ws.user_id === user.id) continue; // own walls don't block
      if (ws.health <= 0) continue; // destroyed walls don't block
      const opA = outposts.find(o => o.id === ws.outpost_a_id);
      const opB = outposts.find(o => o.id === ws.outpost_b_id);
      if (!opA || !opB) continue;
      // Line segment intersection test
      if (segmentsIntersect(ax, ay, bx, by, opA.x, opA.y, opB.x, opB.y)) {
        return ws;
      }
    }
    return null;
  }, [user, wallSegments, outposts]);

  const createMarch = useCallback((id: string, targetName: string, targetX: number, targetY: number, _travelSec: number, action: () => void, sentArmy?: Partial<Record<string, number>>) => {
    const myPos = getMyPos();
    const now = Date.now();
    const pathTerrain = getTerrainForPath(myPos.x, myPos.y, targetX, targetY);
    const waypoints = findPath(myPos.x, myPos.y, targetX, targetY, pathTerrain, bridgeOutpostPositions);

    // If pathfinding returned empty, route is blocked (river without bridge, etc.)
    if (waypoints.length === 0) {
      toast.error('🌊 Path blocked by a river! Build a bridge outpost to cross.');
      return;
    }

    // Check if march path crosses any enemy wall
    let pathBlocked = false;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const blockingWall = findBlockingWall(waypoints[i].x, waypoints[i].y, waypoints[i + 1].x, waypoints[i + 1].y);
      if (blockingWall) {
        // If we have siege weapons, damage the wall instead of being blocked
        if (army.siege > 0) {
          const damage = army.siege * 15;
          const newHealth = Math.max(0, blockingWall.health - damage);
          supabase.from('wall_segments').update({ health: newHealth } as any).eq('id', blockingWall.id).then();
          setWallSegments(prev => prev.map(ws => ws.id === blockingWall.id ? { ...ws, health: newHealth } : ws));
          if (newHealth <= 0) {
            toast.success(`🏗️ Siege weapons destroyed enemy wall! Path cleared.`);
          } else {
            toast(`🏗️ Siege weapons damaged wall (${newHealth}/${blockingWall.max_health} HP remaining). Path still blocked!`);
            pathBlocked = true;
          }
        } else {
          const opA = outposts.find(o => o.id === blockingWall.outpost_a_id);
          const opB = outposts.find(o => o.id === blockingWall.outpost_b_id);
          toast.error(`🧱 Path blocked by enemy wall between ${opA?.name || '?'} and ${opB?.name || '?'}! Use siege weapons or espionage to destroy it.`);
          pathBlocked = true;
        }
        break;
      }
    }
    if (pathBlocked) return;

    const pathDist = getPathLength(waypoints);
    const scoutBonus = Math.min(0.30, (army.scout || 0) * 0.03);
    const actualTravelSec = Math.max(5, Math.floor(pathDist / (getSlowestTroopSpeed(army) * 200) * (1 - scoutBonus)));
    const arrivalTime = now + actualTravelSec * 1000;
    setMarches(prev => [...prev, {
      id, targetName, arrivalTime,
      startTime: now, startX: myPos.x, startY: myPos.y,
      targetX, targetY, waypoints, action, sentArmy,
    }]);
    if (user) {
      const marchType = id.startsWith('atk') || id.startsWith('pvp') ? 'attack' : id.startsWith('envoy') ? 'envoy' : id.startsWith('reinforce') ? 'reinforce' : 'march';
      // For PvP attacks, extract target_user_id from the id pattern or sentArmy context
      const marchInsert: any = {
        user_id: user.id,
        player_name: displayName,
        start_x: myPos.x, start_y: myPos.y,
        target_x: targetX, target_y: targetY,
        target_name: targetName,
        arrives_at: new Date(arrivalTime).toISOString(),
        march_type: marchType,
        sent_army: sentArmy || {},
      };
      // target_user_id is set via a custom event dispatched before createMarch
      const pendingTargetUserId = (window as any).__pendingMarchTargetUserId;
      if (pendingTargetUserId) {
        marchInsert.target_user_id = pendingTargetUserId;
        delete (window as any).__pendingMarchTargetUserId;
      }
      supabase.from('active_marches').insert(marchInsert).then(() => {});
    }
    if (pathDist > Math.hypot(targetX - myPos.x, targetY - myPos.y) * 1.1) {
      toast.info(`Route adjusted around obstacles — travel time: ${actualTravelSec}s`);
    }
  }, [getMyPos, getTerrainForPath, bridgeOutpostPositions, army, user, displayName, findBlockingWall]);

  const getDistance = useCallback((targetX: number, targetY: number) => {
    const myPos = getMyPos();
    return Math.sqrt(Math.pow(targetX - myPos.x, 2) + Math.pow(targetY - myPos.y, 2));
  }, [getMyPos]);

  const calcTravelTime = useCallback((targetX: number, targetY: number) => {
    const dist = getDistance(targetX, targetY);
    return calcMarchTime(dist, army);
  }, [getDistance, army]);

  const isInRange = useCallback((targetX: number, targetY: number) => {
    const wtLevel = getWatchtowerLevel();
    const maxRange = getMaxRange(army, wtLevel);
    // Check range from home village
    const dist = getDistance(targetX, targetY);
    if (dist <= maxRange) return true;
    // Check range from owned outposts
    const myOutposts = outposts.filter(o => o.user_id === user?.id);
    for (const op of myOutposts) {
      const opDist = Math.hypot(targetX - op.x, targetY - op.y);
      if (opDist <= maxRange) return true;
    }
    return false;
  }, [getDistance, army, outposts, user?.id, getWatchtowerLevel]);

  const handleInvestigate = useCallback((event: ProceduralEvent) => {
    if (claimedEvents.has(event.id)) return;
    if (!isInRange(event.x, event.y)) { toast.error('Too far! Train scouts to extend your range.'); return; }
    const hasTroops = Object.values(army).some(v => v > 0);
    if (event.power > 0 && !hasTroops) { toast.error('You need troops to investigate dangerous events!'); return; }
    const travelSec = calcTravelTime(event.x, event.y);
    if (event.power > 0) {
      const eventData = event;
      setAttackConfig({
        targetName: eventData.name, targetPower: eventData.power,
        targetX: eventData.x, targetY: eventData.y, travelTime: travelSec,
        showEspionage: false,
        onAttack: (sentArmy) => {
          toast(`⚔️ Troops marching to ${eventData.name}... ETA ${travelSec}s`);
          deployTroops(sentArmy);
          createMarch(`evt-${Date.now()}`, eventData.name, eventData.x, eventData.y, travelSec, () => {
            const log = attackTarget(eventData.name, eventData.power, sentArmy);
            if (log.result === 'victory') {
              addResources(eventData.reward);
              setClaimedEvents(prev => new Set(prev).add(eventData.id));
              toast.success(`Victory at ${eventData.name}! Resources gained.`);
            } else {
              toast.error(`Defeated at ${eventData.name}!`);
            }
          }, sentArmy);
          setAttackConfig(null);
          setSelected(null);
        },
      });
    } else {
      toast(`🚶 Collecting from ${event.name}... ETA ${travelSec}s`);
      const eventData = event;
      createMarch(`claim-${Date.now()}`, eventData.name, eventData.x, eventData.y, travelSec, () => {
        addResources(eventData.reward);
        setClaimedEvents(prev => new Set(prev).add(eventData.id));
        toast.success(`${eventData.name} — Resources claimed!`);
      });
    }
    setSelected(null);
  }, [army, attackTarget, addResources, claimedEvents, calcTravelTime, isInRange, createMarch, deployTroops]);

  const handleAttackNPC = useCallback((realm: ProceduralRealm) => {
    const hasTroops = Object.values(army).some(v => v > 0);
    if (!hasTroops) { toast.error('You need troops to attack!'); return; }
    if (!isInRange(realm.x, realm.y)) { toast.error('Out of range! Train scouts to extend reach.'); return; }
    const travelSec = calcTravelTime(realm.x, realm.y);
    setAttackConfig({
      targetName: realm.name, targetPower: realm.power,
      targetX: realm.x, targetY: realm.y, travelTime: travelSec,
      showEspionage: getSpyGuildLevel() >= 1, targetId: realm.id,
      onAttack: (sentArmy) => {
        toast(`⚔️ Troops marching to ${realm.name}... ETA ${travelSec}s`);
        deployTroops(sentArmy);
        createMarch(`atk-${Date.now()}`, realm.name, realm.x, realm.y, travelSec, () => {
          const log = attackTarget(realm.name, realm.power, sentArmy);
          if (log.result === 'victory') {
            toast.success(`Victory against ${realm.name}! They are now your vassal.`);
            npcState.setRelationStatus(realm.id, 'vassal', 15);
          } else {
            toast.error(`Defeated by ${realm.name}!`);
          }
        }, sentArmy);
        setAttackConfig(null);
        setSelected(null);
      },
    });
  }, [army, attackTarget, calcTravelTime, createMarch, isInRange, deployTroops]);

  const handleEnvoy = useCallback((realm: ProceduralRealm) => {
    if (tradeContracts.some(c => c.realmId === realm.id)) {
      toast.error('You already have a trade contract with this realm!'); return;
    }
    if (!isInRange(realm.x, realm.y)) { toast.error('Out of range! Train scouts to extend reach.'); return; }
    const tribute = { gold: Math.floor(realm.power * 0.3) };
    addResources({ gold: -tribute.gold });
    const travelSec = calcTravelTime(realm.x, realm.y);

    toast(`📜 Envoy dispatched to ${realm.name}... ETA ${travelSec}s`);
    createMarch(`envoy-${Date.now()}`, realm.name, realm.x, realm.y, travelSec, () => {
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
    });
    setSelected(null);
  }, [addResources, calcTravelTime, tradeContracts, createMarch]);

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
  const iconSize = Math.max(28, Math.min(56, camera.ppu * 12000));
  const fontSize = Math.max(9, Math.min(13, camera.ppu * 4000));
  const eventSize = Math.max(22, Math.min(44, camera.ppu * 9000));

  // Collect all visible realms and events from chunks
  const visibleRealms: (ProceduralRealm & { biome: string })[] = [];
  const visibleEvents: ProceduralEvent[] = [];
  const allRealmNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const chunk of visibleChunks) {
      for (const realm of chunk.data.realms) {
        map.set(realm.id, realm.name);
      }
    }
    return map;
  }, [visibleChunks]);
  for (const chunk of visibleChunks) {
    for (const realm of chunk.data.realms) {
      if (isVisible(realm.x, realm.y, 100)) visibleRealms.push({ ...realm, biome: chunk.data.regionBiome });
    }
    for (const event of chunk.data.events) {
      if (!claimedEvents.has(event.id) && isVisible(event.x, event.y, 60)) visibleEvents.push(event);
    }
  }

  // Cap rendered items when very zoomed out
  const maxItems = 30;
  const renderRealms = visibleRealms.slice(0, maxItems);
  const renderEvents = visibleEvents.slice(0, maxItems);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-3 pt-2 pb-1.5 flex items-center justify-between border-b border-border/30">
        <h2 className="font-display text-sm text-foreground/90 tracking-wide">World Map</h2>
        <div className="flex items-center gap-3 text-[9px] text-muted-foreground/70">
          {marches.length > 0 && <span className="text-primary/80 animate-pulse">🚶 {marches.length}</span>}
          {tradeContracts.length > 0 && <span className="text-food/80">📜 {tradeContracts.length}</span>}
          <span className="font-mono">⚔️{power.attack} 🛡️{power.defense}</span>
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
        {/* Subtle grid lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
          {(() => {
            const w = containerSize.w;
            const h = containerSize.h;
            if (w === 0 || h === 0) return null;
            const viewW = w / camera.ppu;
            const rawStep = viewW / 5;
            const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
            const gridStep = rawStep / mag < 2 ? mag : rawStep / mag < 5 ? mag * 2 : mag * 5;

            const lines: JSX.Element[] = [];
            const startX = Math.floor((camera.cx - w / 2 / camera.ppu) / gridStep) * gridStep;
            const endX = camera.cx + w / 2 / camera.ppu;
            const startY = Math.floor((camera.cy - h / 2 / camera.ppu) / gridStep) * gridStep;
            const endY = camera.cy + h / 2 / camera.ppu;

            let count = 0;
            const MAX_LINES = 20;
            for (let gx = startX; gx <= endX && count < MAX_LINES; gx += gridStep) {
              const { sx } = worldToScreen(gx, 0);
              lines.push(<line key={`gx-${gx}`} x1={sx} y1={0} x2={sx} y2={h} stroke="hsl(42 72% 52% / 0.04)" strokeWidth={0.5} />);
              count++;
            }
            for (let gy = startY; gy <= endY && count < MAX_LINES * 2; gy += gridStep) {
              const { sy } = worldToScreen(0, gy);
              lines.push(<line key={`gy-${gy}`} x1={0} y1={sy} x2={w} y2={sy} stroke="hsl(42 72% 52% / 0.04)" strokeWidth={0.5} />);
              count++;
            }
            return lines;
          })()}
        </svg>

        {/* ── Ocean chunk overlays ── */}
        {visibleChunks.filter(c => c.data.regionBiome === 'Ocean').map(chunk => {
          const { sx, sy } = worldToScreen(chunk.cx * CHUNK_SIZE, chunk.cy * CHUNK_SIZE);
          const size = CHUNK_SIZE * camera.ppu;
          if (size < 4) return null;
          return (
            <div key={`ocean-${chunk.cx}-${chunk.cy}`}
              className="absolute pointer-events-none"
              style={{
                left: sx, top: sy,
                width: size, height: size,
                background: 'radial-gradient(ellipse at center, hsl(210 80% 25% / 0.6), hsl(215 85% 18% / 0.75) 60%, hsl(220 90% 12% / 0.85))',
                borderRadius: 0,
              }}
            />
          );
        })}

        {/* ── Exotic biome chunk overlays ── */}
        {visibleChunks.filter(c => {
          const ec = getExoticContinent(c.cx, c.cy);
          return ec !== null;
        }).map(chunk => {
          const { sx, sy } = worldToScreen(chunk.cx * CHUNK_SIZE, chunk.cy * CHUNK_SIZE);
          const size = CHUNK_SIZE * camera.ppu;
          if (size < 4) return null;
          const ec = getExoticContinent(chunk.cx, chunk.cy)!;
          const biomeOverlays: Record<string, string> = {
            'Desert': 'radial-gradient(ellipse at center, hsl(40 60% 40% / 0.4), hsl(35 55% 30% / 0.5) 60%, hsl(30 50% 22% / 0.55))',
            'Oasis': 'radial-gradient(ellipse at center, hsl(45 55% 45% / 0.35), hsl(130 40% 30% / 0.3) 70%, hsl(40 50% 25% / 0.45))',
            'Jungle': 'radial-gradient(ellipse at center, hsl(140 50% 20% / 0.5), hsl(130 55% 15% / 0.55) 60%, hsl(120 60% 10% / 0.6))',
            'DeepJungle': 'radial-gradient(ellipse at center, hsl(150 55% 15% / 0.55), hsl(140 60% 10% / 0.6) 60%, hsl(130 65% 8% / 0.65))',
            'Lava': 'radial-gradient(ellipse at center, hsl(15 80% 30% / 0.5), hsl(5 70% 20% / 0.55) 60%, hsl(0 60% 15% / 0.6))',
            'VolcanicIslands': 'radial-gradient(ellipse at center, hsl(10 70% 25% / 0.45), hsl(210 60% 20% / 0.35) 60%, hsl(0 50% 18% / 0.5))',
            'Islands': 'radial-gradient(ellipse at center, hsl(190 70% 40% / 0.35), hsl(200 65% 30% / 0.4) 60%, hsl(210 70% 22% / 0.5))',
          };
          return (
            <div key={`exotic-${chunk.cx}-${chunk.cy}`}
              className="absolute pointer-events-none"
              style={{
                left: sx, top: sy,
                width: size, height: size,
                background: biomeOverlays[ec.biome] || biomeOverlays['Desert'],
              }}
            />
          );
        })}


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
                <img src={mapMountain} alt={t.name} loading="lazy"
                  style={{ width: w, height: h, objectFit: 'contain', opacity: 0.85 }} />
                {w > 25 && (
                  <span className="absolute left-1/2 whitespace-nowrap font-display text-foreground/50" style={{ fontSize: labelSize, bottom: -labelSize - 2, transform: 'translateX(-50%)' }}>
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

        {/* ── Decorations (trees, grass, rocks) ── */}
        {visibleChunks.map(chunk => chunk.data.decorations.map((d, di) => {
          const { sx, sy } = worldToScreen(d.x, d.y);
          const s = d.size * camera.ppu;
          if (s < 4) return null;
          const margin = 60;
          if (sx < -margin || sx > containerSize.w + margin || sy < -margin || sy > containerSize.h + margin) return null;
          return (
            <img key={`deco-${chunk.cx}-${chunk.cy}-${di}`}
              src={DECO_SPRITES[d.type]}
              alt=""
              loading="lazy"
              className="absolute pointer-events-none"
              style={{
                left: sx, top: sy,
                width: s, height: s,
                transform: `translate(-50%, -50%) rotate(${d.rotation}deg)`,
                opacity: d.opacity,
                objectFit: 'contain',
              }}
            />
          );
        }))}

        {visibleChunks.map(chunk => {
          const centerX = chunk.cx * CHUNK_SIZE + CHUNK_SIZE / 2;
          const centerY = chunk.cy * CHUNK_SIZE + CHUNK_SIZE / 2;
          const { sx, sy } = worldToScreen(centerX, centerY);
          const regionSize = CHUNK_SIZE * camera.ppu;
          if (regionSize < 60) return null;
          const biomeEmoji = REGION_EMOJIS[chunk.data.regionBiome] || '🗺️';
          const labelFontSize = Math.max(9, Math.min(14, regionSize / 12));
          return (
            <div key={`region-${chunk.cx}-${chunk.cy}`}
              className="absolute pointer-events-none flex flex-col items-center"
              style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)', opacity: 0.2 }}>
              <span style={{ fontSize: labelFontSize }}>{biomeEmoji}</span>
              <span className="font-display text-foreground/40 whitespace-nowrap text-center tracking-widest uppercase" style={{ fontSize: labelFontSize * 0.8, letterSpacing: '0.15em' }}>
                {chunk.data.regionName}
              </span>
            </div>
          );
        })}

        {/* Territory circles — subtle radial glow */}
        {renderRealms.map(realm => {
          const { sx, sy } = worldToScreen(realm.x, realm.y);
          const r = realm.territory * camera.ppu;
          if (r < 5) return null;
          const borderColor = realm.type === 'hostile' ? 'hsl(0 72% 50% / 0.08)' : realm.type === 'friendly' ? 'hsl(130 45% 40% / 0.08)' : 'hsl(216 12% 50% / 0.06)';
          const ringColor = realm.type === 'hostile' ? 'hsl(0 72% 50% / 0.12)' : realm.type === 'friendly' ? 'hsl(130 45% 40% / 0.12)' : 'hsl(216 12% 50% / 0.08)';
          return (
            <div key={`t-${realm.id}`} className="absolute rounded-full pointer-events-none"
              style={{ left: sx - r, top: sy - r, width: r * 2, height: r * 2, background: `radial-gradient(circle, ${borderColor}, transparent 65%)`, border: `1px solid ${ringColor}` }} />
          );
        })}

        {/* NPC Realms */}
        {renderRealms.map(realm => {
          if (!isWithinVision(realm.x, realm.y, Math.max(8000, realm.territory * 0.2))) return null;
          const { sx, sy } = worldToScreen(realm.x, realm.y);
          const npcRel = npcState.playerRelations.get(realm.id);
          const isVassal = npcRel?.status === 'vassal';
          const spriteType = isVassal ? 'friendly' : realm.type;
          return (
            <button key={realm.id} data-map-item
              onClick={(e) => { e.stopPropagation(); setSelected({ kind: 'npc', data: realm, biome: realm.biome }); }}
              className="absolute flex flex-col items-center z-10 hover:z-20 group transition-transform hover:scale-105"
              style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)' }}>
              <img
                src={REALM_SPRITES[spriteType]}
                alt={realm.name}
                loading="lazy"
                className={`drop-shadow-lg transition-all ${isVassal ? 'brightness-110' : 'group-hover:brightness-110'}`}
                style={{ width: iconSize, height: iconSize, imageRendering: 'auto' }}
              />
              {iconSize > 30 && (
                <div className={`text-center rounded-md mt-1 px-2 py-0.5 backdrop-blur-sm shadow-sm ${isVassal ? 'bg-primary/15 border border-primary/25' : 'bg-background/70 border border-border/30'}`}>
                  <p className="font-display text-foreground leading-tight whitespace-nowrap" style={{ fontSize: Math.max(8, fontSize - 1) }}>
                    {isVassal ? '👑 ' : ''}{realm.name}
                  </p>
                  <p className="text-muted-foreground/70" style={{ fontSize: Math.max(7, fontSize - 3) }}>
                    {isVassal ? 'Vassal' : `⚔️ ${realm.power}`}
                  </p>
                </div>
              )}
              {realm.type === 'hostile' && !isVassal && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-destructive/80 animate-pulse" />
              )}
            </button>
          );
        })}

        {/* Events */}
        {renderEvents.map((event) => {
          if (!isWithinVision(event.x, event.y, 3000)) return null;
          const { sx, sy } = worldToScreen(event.x, event.y);
          const evSprite = event.type === 'mystery' ? mapRuins : EVENT_SPRITES[event.type];
          return (
            <button key={event.id} data-map-item
              onClick={(e) => { e.stopPropagation(); setSelected({ kind: 'event', data: event, chunkKey: '', index: 0 }); }}
              className="absolute z-20 group transition-transform hover:scale-110"
              style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)' }}>
              <img
                src={evSprite}
                alt={event.name}
                loading="lazy"
                className="drop-shadow-md transition-all group-hover:drop-shadow-lg"
                style={{ width: eventSize, height: eventSize, imageRendering: 'auto', objectFit: 'contain' }}
              />
              {eventSize > 28 && (
                <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 text-foreground/40 whitespace-nowrap"
                  style={{ fontSize: Math.max(7, eventSize / 6) }}>
                  {event.emoji}
                </span>
              )}
            </button>
          );
        })}

        {/* Steel Mines */}
        {visibleChunks.map(chunk => chunk.data.steelMines.map(mine => {
          if (!isWithinVision(mine.x, mine.y, 4000)) return null;
          if (!isVisible(mine.x, mine.y, 60)) return null;
          const { sx, sy } = worldToScreen(mine.x, mine.y);
          const isCaptured = capturedMines.has(mine.id);
          return (
            <button key={mine.id} data-map-item
              onClick={(e) => { e.stopPropagation(); setSelected({ kind: 'mine', data: mine }); }}
              className={`absolute z-20 ${isCaptured ? 'animate-pulse-gold' : ''}`}
              style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)' }}>
              <img
                src={mapMine}
                alt={mine.name}
                loading="lazy"
                className={`drop-shadow-lg ${isCaptured ? 'brightness-125' : 'brightness-75'}`}
                style={{ width: eventSize, height: eventSize, imageRendering: 'auto' }}
              />
            </button>
          );
        }))}

        {/* Player settlements with collision nudging */}
        {(() => {
          // Compute positions first, then nudge overlapping ones apart
          const playerPositions = allVillages.map(pv => {
            const pos = getPlayerPos(pv.village.id);
            const { sx, sy } = worldToScreen(pos.x, pos.y);
            const isMe = pv.village.user_id === user?.id;
            return { pv, pos, sx, sy, isMe };
          }).filter(p => {
            if (!isWithinVision(p.pos.x, p.pos.y, 5000)) return false;
            const margin = 80;
            return p.sx > -margin && p.sx < containerSize.w + margin && p.sy > -margin && p.sy < containerSize.h + margin;
          });

          // Simple collision nudge: push overlapping labels apart
          const minDist = Math.max(50, iconSize * 1.8);
          for (let i = 0; i < playerPositions.length; i++) {
            for (let j = i + 1; j < playerPositions.length; j++) {
              const a = playerPositions[i];
              const b = playerPositions[j];
              const dx = b.sx - a.sx;
              const dy = b.sy - a.sy;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < minDist && dist > 0) {
                const overlap = (minDist - dist) / 2;
                const nx = dx / dist;
                const ny = dy / dist;
                // Don't nudge "me" — nudge others
                if (a.isMe) {
                  b.sx += nx * overlap * 2;
                  b.sy += ny * overlap * 2;
                } else if (b.isMe) {
                  a.sx -= nx * overlap * 2;
                  a.sy -= ny * overlap * 2;
                } else {
                  a.sx -= nx * overlap;
                  a.sy -= ny * overlap;
                  b.sx += nx * overlap;
                  b.sy += ny * overlap;
                }
              }
            }
          }

          // Sort so "me" renders on top
          const sorted = playerPositions.sort((a, b) => (a.isMe ? 1 : 0) - (b.isMe ? 1 : 0));

          return sorted.map(({ pv, sx, sy, isMe }) => {
            const pvSettlementType = isMe ? settlementType : (pv.village.settlement_type || 'village');
            const sprite = getSettlementSprite(pvSettlementType, isMe);
            const settlementLabel = SETTLEMENT_LABELS[pvSettlementType] || '🏠 Village';
            const skinFilter = isMe ? getSpriteFilter() : undefined;
            return (
              <button key={pv.village.id} data-map-item
                onClick={(e) => { e.stopPropagation(); if (isMe) { window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'village' })); } else { setSelected({ kind: 'player', data: pv }); } }}
                className={`absolute flex flex-col items-center ${isMe ? 'z-40' : 'z-30'} hover:z-50`}
                style={{ left: sx, top: sy, transform: 'translate(-50%, -80%)' }}>
                <img
                  src={sprite}
                  alt={pv.profile.display_name}
                  loading="lazy"
                  className={`drop-shadow-lg ${isMe ? 'brightness-110 saturate-110' : 'brightness-75 grayscale-[20%]'}`}
                  style={{ width: iconSize * 1.2, height: iconSize * 1.2, imageRendering: 'auto', objectFit: 'contain', filter: skinFilter }}
                />
                {isMe && (
                  <div className="absolute -inset-2 rounded-full pointer-events-none"
                    style={{ boxShadow: '0 0 18px 5px hsl(var(--primary) / 0.35)', border: '2px solid hsl(var(--primary) / 0.5)' }} />
                )}
                {iconSize > 28 && (
                  <div className={`text-center rounded-md px-1.5 py-0.5 backdrop-blur-sm ${isMe ? 'bg-primary/90 ring-1 ring-primary' : 'bg-background/80 border border-border/50'}`}
                    style={{ marginTop: -2 }}>
                    <p className={`font-display whitespace-nowrap leading-tight ${isMe ? 'text-primary-foreground' : 'text-foreground'}`}
                      style={{ fontSize: Math.max(8, fontSize - 1) }}>
                      {isMe ? `⭐ ${settlementLabel}` : pv.profile.display_name}
                    </p>
                    <p className={`${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}
                      style={{ fontSize: Math.max(7, fontSize - 3) }}>
                      Lv.{pv.village.level}
                    </p>
                  </div>
                )}
              </button>
            );
          });
        })()}

        {/* ── Animated March Sprites with waypoint paths ── */}
        {marches.map(march => {
          const now = Date.now();
          const totalDuration = march.arrivalTime - march.startTime;
          const elapsed = now - march.startTime;
          const progress = Math.min(1, Math.max(0, elapsed / totalDuration));
          const wp = march.waypoints;
          const currentPos = interpolateAlongPath(wp, progress);
          const { sx, sy } = worldToScreen(currentPos.x, currentPos.y);
          // Determine facing direction from next waypoint
          const aheadPos = interpolateAlongPath(wp, Math.min(1, progress + 0.05));
          const facingLeft = aheadPos.x < currentPos.x;
          const marchSize = Math.max(16, Math.min(36, camera.ppu * 5000));
          const remainingSec = Math.max(0, Math.ceil((march.arrivalTime - now) / 1000));
          // Build polyline path from waypoints
          const screenWaypoints = wp.map(p => worldToScreen(p.x, p.y));
          const polylinePoints = screenWaypoints.map(p => `${p.sx},${p.sy}`).join(' ');
          return (
            <div key={march.id}>
              {/* Dotted march path polyline */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible', zIndex: 35 }}>
                <polyline points={polylinePoints}
                  fill="none" stroke="hsl(var(--primary) / 0.4)" strokeWidth={2} strokeDasharray="6 4" />
              </svg>
              {/* Moving soldier sprite */}
              <div className="absolute z-40 flex flex-col items-center pointer-events-none"
                style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)' }}>
                <img src={FACTION_SOLDIER_SPRITES[activeSkin.id] || FACTION_SOLDIER_SPRITES.default || mapSoldier} alt="Army" className="drop-shadow-lg"
                  style={{ width: marchSize, height: marchSize, objectFit: 'contain', transform: facingLeft ? 'scaleX(-1)' : undefined }} loading="lazy" />
                <div className="bg-background/90 rounded px-1.5 py-0.5 text-center mt-0.5 border border-primary/30 shadow-md">
                  <p className="text-foreground font-display whitespace-nowrap font-bold" style={{ fontSize: Math.max(7, marchSize / 4) }}>
                    {displayName}
                  </p>
                  <p className="text-primary font-display whitespace-nowrap" style={{ fontSize: Math.max(6, marchSize / 5) }}>
                    ⚔️ Army → {march.targetName}
                  </p>
                  <p className="text-muted-foreground" style={{ fontSize: Math.max(6, marchSize / 5) }}>
                    {remainingSec}s
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {/* ── Other Players' Marches (live from DB) ── */}
        {otherMarches.map(march => {
          const now = Date.now();
          const startT = new Date(march.started_at).getTime();
          const endT = new Date(march.arrives_at).getTime();
          const totalDuration = endT - startT;
          const elapsed = now - startT;
          const progress = Math.min(1, Math.max(0, elapsed / totalDuration));
          const currentX = march.start_x + (march.target_x - march.start_x) * progress;
          const currentY = march.start_y + (march.target_y - march.start_y) * progress;
          if (!isWithinVision(currentX, currentY, 3000)) return null;
          const { sx, sy } = worldToScreen(currentX, currentY);
          // Visibility check
          if (sx < -80 || sx > containerSize.w + 80 || sy < -80 || sy > containerSize.h + 80) return null;
          const facingLeft = march.target_x < march.start_x;
          const marchSize = Math.max(14, Math.min(28, camera.ppu * 4000));
          const remainingSec = Math.max(0, Math.ceil((endT - now) / 1000));
          // Draw line from start to end
          const startScreen = worldToScreen(march.start_x, march.start_y);
          const endScreen = worldToScreen(march.target_x, march.target_y);
          const marchColor = march.march_type === 'attack' ? 'hsl(0 72% 50% / 0.3)' : march.march_type === 'envoy' ? 'hsl(42 72% 52% / 0.3)' : 'hsl(216 12% 50% / 0.25)';
          return (
            <div key={march.id}>
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible', zIndex: 32 }}>
                <line x1={startScreen.sx} y1={startScreen.sy} x2={endScreen.sx} y2={endScreen.sy}
                  stroke={marchColor} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.6} />
              </svg>
               <div className="absolute z-35 flex flex-col items-center pointer-events-none"
                style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)' }}>
                <img src={mapSoldier} alt="Troops" className="drop-shadow-md opacity-70"
                  style={{ width: marchSize, height: marchSize, objectFit: 'contain', transform: facingLeft ? 'scaleX(-1)' : undefined }} loading="lazy" />
                {/* Other players' marches use generic soldier - could be extended to show their faction */}
                {marchSize > 16 && (
                  <div className="bg-background/70 backdrop-blur-sm rounded px-1 py-0.5 text-center mt-0.5 border border-border/30">
                    <p className="text-foreground/70 font-display whitespace-nowrap" style={{ fontSize: Math.max(6, marchSize / 4) }}>
                      {march.player_name}
                    </p>
                    <p className="text-muted-foreground/60 whitespace-nowrap" style={{ fontSize: Math.max(5, marchSize / 5) }}>
                      → {march.target_name} · {remainingSec}s
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}


        {/* ── Spy Agents on Map (visible only to sender) ── */}
        {activeSpyMissions.map(spy => {
          const now = Date.now();
          const myPos = getMyPos();
          let currentX: number, currentY: number;
          
          if (spy.phase === 'traveling') {
            const progress = Math.min(1, Math.max(0, (now - spy.departTime) / (spy.arrivalTime - spy.departTime)));
            currentX = myPos.x + (spy.targetX - myPos.x) * progress;
            currentY = myPos.y + (spy.targetY - myPos.y) * progress;
          } else if (spy.phase === 'returning') {
            const returnStart = spy.arrivalTime + (spy.arrivalTime - spy.departTime) * 0.1; // small operate window
            const progress = Math.min(1, Math.max(0, (now - returnStart) / (spy.returnTime - returnStart)));
            currentX = spy.targetX + (myPos.x - spy.targetX) * progress;
            currentY = spy.targetY + (myPos.y - spy.targetY) * progress;
          } else {
            // Operating at target
            currentX = spy.targetX;
            currentY = spy.targetY;
          }

          const { sx, sy } = worldToScreen(currentX, currentY);
          if (sx < -60 || sx > containerSize.w + 60 || sy < -60 || sy > containerSize.h + 60) return null;
          
          const spySize = Math.max(12, Math.min(24, camera.ppu * 3000));
          const facingLeft = spy.phase === 'returning' ? spy.targetX > myPos.x : spy.targetX < myPos.x;
          const remainingSec = spy.phase === 'traveling' 
            ? Math.max(0, Math.ceil((spy.arrivalTime - now) / 1000))
            : spy.phase === 'returning'
              ? Math.max(0, Math.ceil((spy.returnTime - now) / 1000))
              : 0;
          
          const missionEmoji = spy.mission === 'scout' ? '🔍' : spy.mission === 'sabotage' ? '💣' : '😈';
          const phaseLabel = spy.phase === 'traveling' ? `→ ${spy.targetName}` : spy.phase === 'operating' ? `Operating...` : `← Returning`;

          return (
            <div key={spy.id} className="absolute z-[44] pointer-events-none" style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)' }}>
              <div className="flex flex-col items-center animate-pulse">
                <span style={{ fontSize: spySize, transform: facingLeft ? 'scaleX(-1)' : undefined, display: 'inline-block' }}>🕵️</span>
                {spySize > 14 && (
                  <div className="bg-background/80 backdrop-blur-sm rounded px-1 py-0.5 text-center mt-0.5 border border-accent/30 shadow-sm">
                    <p className="text-foreground font-display whitespace-nowrap" style={{ fontSize: Math.max(6, spySize / 4) }}>
                      {missionEmoji} {phaseLabel}
                    </p>
                    {remainingSec > 0 && (
                      <p className="text-muted-foreground whitespace-nowrap" style={{ fontSize: Math.max(5, spySize / 5) }}>
                        {remainingSec}s
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* ── Fog of War — fully obscures anything outside vision ── */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 45 }}>
          <defs>
            <mask id="fog-mask">
              <rect width="100%" height="100%" fill="white" />
              {visionSources.map((source, index) => {
                const { sx, sy } = worldToScreen(source.x, source.y);
                const radius = source.radius * camera.ppu;
                if (radius < 5) return null;

                return <circle key={index} cx={sx} cy={sy} r={radius} fill="black" />;
              })}
            </mask>
            <filter id="fog-clouds" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="5" seed="7" result="noise" />
              <feColorMatrix type="saturate" values="0" in="noise" result="gn" />
              <feComponentTransfer in="gn" result="tn">
                <feFuncA type="linear" slope="0.35" intercept="0.05" />
              </feComponentTransfer>
              <feGaussianBlur stdDeviation="6" in="tn" />
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="hsl(220 20% 7% / 0.93)" mask="url(#fog-mask)" />
          <rect width="100%" height="100%" fill="hsl(220 15% 18% / 0.4)" mask="url(#fog-mask)" filter="url(#fog-clouds)" />
        </svg>

        {/* ── Unified Territory borders + Explicit Wall segments ── */}
        {(() => {
          // Group outposts by owner
          const ownerGroups = new Map<string, typeof outposts>();
          for (const op of outposts) {
            if (!isWithinVision(op.x, op.y, op.territory_radius + 5000)) continue;
            const arr = ownerGroups.get(op.user_id) || [];
            arr.push(op);
            ownerGroups.set(op.user_id, arr);
          }

          const elements: React.ReactNode[] = [];
          ownerGroups.forEach((ops, ownerId) => {
            const isOwn = ownerId === user?.id;
            const borderColor = isOwn ? 'hsl(var(--primary))' : 'hsl(var(--destructive))';
            const fillColor = isOwn ? 'hsl(var(--primary) / 0.06)' : 'hsl(var(--destructive) / 0.04)';

            let minSx = Infinity, minSy = Infinity, maxSx = -Infinity, maxSy = -Infinity;
            const screenData: { cx: number; cy: number; r: number; op: typeof ops[0] }[] = [];
            for (const op of ops) {
              const { sx, sy } = worldToScreen(op.x, op.y);
              const r = op.territory_radius * camera.ppu;
              if (r < 10) continue;
              screenData.push({ cx: sx, cy: sy, r, op });
              minSx = Math.min(minSx, sx - r - 10);
              minSy = Math.min(minSy, sy - r - 10);
              maxSx = Math.max(maxSx, sx + r + 10);
              maxSy = Math.max(maxSy, sy + r + 10);
            }
            if (screenData.length === 0) return;

            const svgW = maxSx - minSx;
            const svgH = maxSy - minSy;
            if (svgW <= 0 || svgH <= 0) return;

            // Get explicit wall segments for this owner from DB
            const ownerWallSegs = wallSegments.filter(ws => ws.user_id === ownerId);
            const opMap = new Map(screenData.map(d => [d.op.id, d]));
            const renderedSegments: { x1: number; y1: number; x2: number; y2: number; level: number; health: number; maxHealth: number; id: string }[] = [];
            for (const ws of ownerWallSegs) {
              const a = opMap.get(ws.outpost_a_id);
              const b = opMap.get(ws.outpost_b_id);
              if (a && b) {
                renderedSegments.push({
                  x1: a.cx - minSx, y1: a.cy - minSy,
                  x2: b.cx - minSx, y2: b.cy - minSy,
                  level: ws.wall_level, health: ws.health, maxHealth: ws.max_health, id: ws.id,
                });
              }
            }

            elements.push(
              <svg key={`territory-unified-${ownerId}`}
                className="absolute pointer-events-none z-[10]"
                style={{ left: minSx, top: minSy, width: svgW, height: svgH, overflow: 'visible' }}
                viewBox={`0 0 ${svgW} ${svgH}`}>
                <defs>
                  <clipPath id={`clip-territory-${ownerId}`}>
                    {screenData.map((c, i) => (
                      <circle key={i} cx={c.cx - minSx} cy={c.cy - minSy} r={c.r} />
                    ))}
                  </clipPath>
                </defs>
                <rect x="0" y="0" width={svgW} height={svgH}
                  clipPath={`url(#clip-territory-${ownerId})`} fill={fillColor} />
                {screenData.map((c, i) => (
                  <circle key={`border-${i}`} cx={c.cx - minSx} cy={c.cy - minSy} r={c.r}
                    fill="none" stroke={borderColor} strokeWidth={1}
                    strokeDasharray="6 4" opacity={0.3} />
                ))}
                {/* Explicit wall segments */}
                {renderedSegments.map((seg) => {
                  const thickness = Math.max(2.5, Math.min(6, seg.level * 1.5 + 2));
                  const healthPct = seg.health / seg.maxHealth;
                  const wallOpacity = healthPct > 0.5 ? 0.7 : healthPct > 0.2 ? 0.45 : 0.25;
                  const damaged = healthPct < 1;
                  return (
                    <g key={`wall-seg-${seg.id}`}>
                      <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                        stroke={borderColor} strokeWidth={thickness + 2} opacity={0.15} strokeLinecap="round" />
                      <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                        stroke={borderColor} strokeWidth={thickness} opacity={wallOpacity}
                        strokeLinecap="round" strokeDasharray={damaged ? '8 3' : 'none'} />
                      {(() => {
                        const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
                        const len = Math.hypot(dx, dy);
                        if (len < 20) return null;
                        const count = Math.floor(len / 12);
                        const nx = -dy / len, ny = dx / len;
                        const dots: React.ReactNode[] = [];
                        for (let t = 0; t < count; t += 2) {
                          const frac = (t + 0.5) / count;
                          dots.push(<rect key={t}
                            x={seg.x1 + dx * frac + nx * (thickness * 0.5) - 1.5}
                            y={seg.y1 + dy * frac + ny * (thickness * 0.5) - 1.5}
                            width={3} height={3} fill={borderColor} opacity={wallOpacity * 0.7} />);
                        }
                        return dots;
                      })()}
                      {damaged && (() => {
                        const mx = (seg.x1 + seg.x2) / 2, my = (seg.y1 + seg.y2) / 2, barW = 20;
                        return (<g>
                          <rect x={mx - barW / 2} y={my - 6} width={barW} height={3} fill="hsl(var(--muted))" rx={1} opacity={0.8} />
                          <rect x={mx - barW / 2} y={my - 6} width={barW * healthPct} height={3}
                            fill={healthPct > 0.5 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'} rx={1} opacity={0.9} />
                        </g>);
                      })()}
                    </g>
                  );
                })}
                {/* Wall node markers */}
                {(() => {
                  const connectedIds = new Set<string>();
                  for (const ws of ownerWallSegs) { connectedIds.add(ws.outpost_a_id); connectedIds.add(ws.outpost_b_id); }
                  return screenData.filter(d => connectedIds.has(d.op.id)).map((c, i) => (
                    <g key={`wall-node-${i}`}>
                      <circle cx={c.cx - minSx} cy={c.cy - minSy} r={6} fill={borderColor} opacity={0.5} />
                      <circle cx={c.cx - minSx} cy={c.cy - minSy} r={4} fill={fillColor} stroke={borderColor} strokeWidth={1.5} opacity={0.8} />
                    </g>
                  ));
                })()}
              </svg>
            );
          });
          return elements;
        })()}

        {/* ── Bridge sprites over rivers ── */}
        {outposts.filter(o => o.outpost_type === 'bridge').map(bridge => {
          if (!isVisible(bridge.x, bridge.y, 80)) return null;
          const { sx, sy } = worldToScreen(bridge.x, bridge.y);
          const bridgeSize = Math.max(30, Math.min(80, camera.ppu * 12000));
          if (bridgeSize < 8) return null;
          // Find the nearest river to determine bridge angle
          let riverAngle = 0;
          let nearestDist = Infinity;
          for (const chunk of visibleChunks) {
            for (const t of chunk.data.terrain) {
              if (t.type !== 'river' || !t.points || t.points.length < 2) continue;
              for (let i = 0; i < t.points.length - 1; i++) {
                const p1 = t.points[i], p2 = t.points[i + 1];
                const dx = p2.x - p1.x, dy = p2.y - p1.y;
                const lenSq = dx * dx + dy * dy;
                if (lenSq === 0) continue;
                const tt = Math.max(0, Math.min(1, ((bridge.x - p1.x) * dx + (bridge.y - p1.y) * dy) / lenSq));
                const cx = p1.x + tt * dx, cy = p1.y + tt * dy;
                const d = Math.hypot(bridge.x - cx, bridge.y - cy);
                if (d < nearestDist) {
                  nearestDist = d;
                  riverAngle = Math.atan2(dy, dx) * 180 / Math.PI;
                }
              }
            }
          }
          // Bridge goes perpendicular to the river
          const bridgeRotation = riverAngle + 90;
          const isOwn = bridge.user_id === user?.id;
          const labelSize = Math.max(7, Math.min(11, bridgeSize / 5));
          return (
            <button
              key={`bridge-sprite-${bridge.id}`}
              type="button"
              data-map-item
              aria-label={`Open ${bridge.name}`}
              className="absolute z-[43] flex flex-col items-center justify-center cursor-pointer touch-manipulation"
              style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)' }}
              onClick={(e) => { e.stopPropagation(); setSelected({ kind: 'outpost', data: bridge }); }}
            >
              <div className="relative" style={{ transform: `rotate(${bridgeRotation}deg)` }}>
                {/* Bridge planks */}
                <svg width={bridgeSize} height={bridgeSize * 0.5} viewBox="0 0 100 50" className="drop-shadow-lg">
                  {/* Bridge railings */}
                  <rect x="5" y="2" width="90" height="4" rx="2" fill={isOwn ? 'hsl(30, 50%, 35%)' : 'hsl(0, 30%, 35%)'} />
                  <rect x="5" y="44" width="90" height="4" rx="2" fill={isOwn ? 'hsl(30, 50%, 35%)' : 'hsl(0, 30%, 35%)'} />
                  {/* Bridge deck */}
                  <rect x="8" y="8" width="84" height="34" rx="1" fill={isOwn ? 'hsl(30, 40%, 45%)' : 'hsl(0, 20%, 40%)'} />
                  {/* Planks */}
                  {[0, 1, 2, 3, 4, 5, 6].map(i => (
                    <rect key={i} x={12 + i * 11} y="8" width="2" height="34" fill={isOwn ? 'hsl(30, 30%, 30%)' : 'hsl(0, 15%, 30%)'} opacity="0.5" />
                  ))}
                  {/* Support pillars */}
                  <rect x="15" y="0" width="6" height="50" rx="2" fill={isOwn ? 'hsl(30, 25%, 28%)' : 'hsl(0, 15%, 28%)'} />
                  <rect x="79" y="0" width="6" height="50" rx="2" fill={isOwn ? 'hsl(30, 25%, 28%)' : 'hsl(0, 15%, 28%)'} />
                  {/* Railing posts */}
                  {[25, 40, 55, 70].map(px => (
                    <g key={px}>
                      <rect x={px} y="0" width="3" height="8" rx="1" fill={isOwn ? 'hsl(30, 35%, 32%)' : 'hsl(0, 20%, 32%)'} />
                      <rect x={px} y="42" width="3" height="8" rx="1" fill={isOwn ? 'hsl(30, 35%, 32%)' : 'hsl(0, 20%, 32%)'} />
                    </g>
                  ))}
                </svg>
              </div>
              {bridgeSize > 25 && (
                <div className={`backdrop-blur-sm rounded px-1 py-0.5 text-center mt-0.5 border ${isOwn ? 'bg-background/70 border-sky-400/30' : 'bg-background/50 border-destructive/20'}`}
                  style={{ transform: `rotate(0deg)` }}>
                  <p className="text-foreground/80 font-display whitespace-nowrap" style={{ fontSize: labelSize }}>
                    🌉 {bridge.name}
                  </p>
                </div>
              )}
            </button>
          );
        })}

        {/* ── Outpost markers on the map ── */}
        {outposts.filter(o => o.outpost_type !== 'bridge').map(outpost => {
          if (!isWithinVision(outpost.x, outpost.y, 6000)) return null;
          if (!isVisible(outpost.x, outpost.y, 60)) return null;
          const { sx, sy } = worldToScreen(outpost.x, outpost.y);
          const opSize = Math.max(18, Math.min(36, camera.ppu * 6000));
          const hitSize = Math.max(44, opSize * 1.9);
          const isOwn = outpost.user_id === user?.id;
          const isSettlement = outpost.outpost_type === 'settlement';
          return (
            <button
              key={outpost.id}
              type="button"
              data-map-item
              aria-label={`Open ${outpost.name}`}
              className="absolute z-[42] flex flex-col items-center justify-center cursor-pointer touch-manipulation"
              style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)', minWidth: hitSize, minHeight: hitSize, padding: Math.max(6, opSize * 0.35) }}
              onClick={(e) => { e.stopPropagation(); setSelected({ kind: 'outpost', data: outpost }); }}
            >
              <div className="relative">
                <img src={isOwn ? getSettlementSprite('village', true) : mapVillage} alt={outpost.name} loading="lazy"
                  className={`drop-shadow-md ${isOwn ? 'brightness-90' : 'brightness-75 hue-rotate-180'}`}
                  style={{ width: opSize, height: opSize, objectFit: 'contain', filter: isOwn ? getSpriteFilter() : undefined }} />
                <div className="absolute -inset-1 rounded-full pointer-events-none"
                  style={{
                    boxShadow: isOwn ? '0 0 10px 3px hsl(var(--primary) / 0.2)' : '0 0 8px 2px hsl(var(--destructive) / 0.15)',
                    border: isOwn ? '1px solid hsl(var(--primary) / 0.3)' : '1px solid hsl(var(--destructive) / 0.25)',
                  }} />
                {outpost.has_wall && (
                  <div className="absolute -inset-2 rounded-full pointer-events-none"
                    style={{ border: `2px solid hsl(var(--${isOwn ? 'primary' : 'destructive'}) / 0.5)` }} />
                )}
              </div>
              {opSize > 22 && (
                <div className={`backdrop-blur-sm rounded px-1.5 py-0.5 text-center mt-0.5 border ${isOwn ? 'bg-background/70 border-primary/20' : 'bg-background/50 border-destructive/20'}`}>
                  <p className="text-foreground/80 font-display whitespace-nowrap" style={{ fontSize: Math.max(7, opSize / 5) }}>
                    {isSettlement ? '🏘️' : (isOwn ? '🏕️' : '⚑')} {outpost.name} {outpost.level > 1 ? `Lv.${outpost.level}` : ''}
                  </p>
                </div>
              )}
            </button>
          );
        })}
        <div className="absolute bottom-4 right-3 flex flex-col gap-1 z-50">
          <button onClick={() => safeSetCamera(prev => ({ ...prev, ppu: Math.min(0.05, prev.ppu * 1.5) }))}
            className="w-9 h-9 bg-background/80 backdrop-blur-sm border border-border/40 rounded-lg flex items-center justify-center text-foreground/80 text-sm font-medium active:scale-90 transition-all hover:bg-background/95 shadow-sm">+</button>
          <button onClick={() => safeSetCamera(prev => ({ ...prev, ppu: Math.max(0.00005, prev.ppu / 1.5) }))}
            className="w-9 h-9 bg-background/80 backdrop-blur-sm border border-border/40 rounded-lg flex items-center justify-center text-foreground/80 text-sm font-medium active:scale-90 transition-all hover:bg-background/95 shadow-sm">−</button>
          <button onClick={goHome}
            className="w-9 h-9 bg-background/80 backdrop-blur-sm border border-border/40 rounded-lg flex items-center justify-center text-foreground/80 text-xs active:scale-90 transition-all hover:bg-background/95 shadow-sm mt-0.5">⌂</button>
        </div>

        {/* Legend — collapsible on mobile */}
        <div className="absolute bottom-3 left-3 z-50">
          <button
            onClick={() => setLegendOpen(prev => !prev)}
            className="game-panel border-glow rounded-lg px-2 py-1.5 text-[9px] text-foreground font-display flex items-center gap-1 sm:hidden active:scale-95 transition-transform"
          >
            🗺️ Legend {legendOpen ? '▾' : '▸'}
          </button>
          <div className={`${legendOpen ? 'flex' : 'hidden'} sm:flex flex-col bg-background/90 backdrop-blur-sm rounded-lg p-2 space-y-1 text-[8px] border border-border mt-1 sm:mt-0`}>
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
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-16 sm:bottom-14 inset-x-0 z-50 mx-2 sm:mx-3 game-panel border-glow rounded-xl p-3 max-h-[45vh] overflow-y-auto safe-bottom">
            <button onClick={() => setSelected(null)} className="absolute top-2 right-2 text-muted-foreground text-sm w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted/50 active:scale-90 transition-transform">✕</button>

            {selected.kind === 'npc' && (
              <NPCInteractionPanel
                realm={selected.data}
                biome={selected.biome}
                onClose={() => setSelected(null)}
                onAttack={(r) => handleAttackNPC(r)}
                onEnvoy={(r) => handleEnvoy(r)}
                playerRelation={npcState.playerRelations.get(selected.data.id) || null}
                townState={npcState.townStates.get(selected.data.id) || null}
                townRelations={npcState.townRelations}
                allRealmNames={allRealmNames}
                onUpdateSentiment={npcState.updateSentiment}
                onSetRelationStatus={npcState.setRelationStatus}
                onHireMercenaries={npcState.hireMercenaries}
                onDeductNPCStock={npcState.deductNPCStock}
                isInRange={isInRange(selected.data.x, selected.data.y)}
                travelTime={calcTravelTime(selected.data.x, selected.data.y)}
                hasActiveTrade={tradeContracts.some(c => c.realmId === selected.data.id)}
                isScouted={npcState.scoutedNPCs.has(selected.data.id) || npcState.scoutedNPCs.has(selected.data.name)}
              />
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
                <div className="flex items-center justify-between gap-3">
                  <div className="flex gap-1.5 text-[10px] text-primary font-bold flex-wrap">
                    {Object.entries(selected.data.reward).filter(([, v]) => v && v > 0).map(([k, v]) => (
                      <span key={k}>+{v} {k}</span>
                    ))}
                  </div>
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => handleInvestigate(selected.data)}
                    className="bg-primary text-primary-foreground font-display text-[11px] py-2.5 px-4 rounded-lg glow-gold-sm active:scale-95 transition-transform whitespace-nowrap">
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
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          const targetId = selected.data.village.user_id;
                          const targetName = selected.data.profile.display_name;
                          setSelected(null);
                          window.dispatchEvent(new CustomEvent('open-dm', { detail: { userId: targetId, name: targetName } }));
                        }}
                        className="flex-1 bg-primary/20 text-primary font-display text-[11px] py-2.5 rounded-lg active:bg-primary/30 transition-colors">
                        📨 Message
                      </motion.button>
                      {(() => {
                        const isMyVassal = vassalages.some(v => v.lord_id === user?.id && v.vassal_id === selected.data.village.user_id && v.status === 'active');
                        return isMyVassal ? (
                          <div className="flex-1 bg-muted text-muted-foreground font-display text-[11px] py-2.5 rounded-lg text-center">
                            👑 Your Vassal
                          </div>
                        ) : (
                          <motion.button whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              const hasTroops = Object.values(army).some(v => v > 0);
                              if (!hasTroops) { toast.error('You need troops to attack!'); return; }
                              const targetPos = getPlayerPos(selected.data.village.id);
                              const travelSec = calcTravelTime(targetPos.x, targetPos.y);
                              const targetData = selected.data;
                              setAttackConfig({
                                targetName: targetData.profile.display_name,
                                targetX: targetPos.x, targetY: targetPos.y,
                                travelTime: travelSec, showEspionage: getSpyGuildLevel() >= 1,
                                targetId: targetData.village.user_id,
                                onAttack: (sentArmy) => {
                                  toast(`⚔️ Troops marching... ETA ${travelSec}s`);
                                  deployTroops(sentArmy);
                                  (window as any).__pendingMarchTargetUserId = targetData.village.user_id;
                                  createMarch(`pvp-${Date.now()}`, targetData.village.name, targetPos.x, targetPos.y, travelSec, async () => {
                                    const log = await attackPlayer(targetData.village.user_id, targetData.profile.display_name, targetData.village.id, sentArmy);
                                    if (!log) { toast.error('Attack failed — they may be your vassal!'); return; }
                                    if (log.result === 'victory') {
                                      let msg = `⚔️ Victory against ${targetData.profile.display_name}!`;
                                      if (log.resourcesGained) {
                                        const r = log.resourcesGained;
                                        msg += ` Raided: ${r.gold || 0}💰 ${r.wood || 0}🪵 ${r.stone || 0}🪨 ${r.food || 0}🌾`;
                                      }
                                      if (log.buildingDamaged) msg += ` Damaged their ${log.buildingDamaged}!`;
                                      if (log.vassalized) msg += ` 👑 They are now your vassal!`;
                                      toast.success(msg);
                                    } else {
                                      toast.error(`Defeated by ${targetData.profile.display_name}!`);
                                    }
                                  }, sentArmy);
                                  setAttackConfig(null);
                                  setSelected(null);
                                },
                              });
                            }}
                            className="flex-1 bg-destructive/20 text-destructive font-display text-[11px] py-2.5 rounded-lg active:bg-destructive/30 transition-colors">
                            ⚔️ Attack
                          </motion.button>
                        );
                      })()}
                    </div>
                    {/* Espionage button */}
                    {getSpyGuildLevel() >= 1 && spies > 0 && (
                      <motion.button whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          const targetPos = getPlayerPos(selected.data.village.id);
                          const travelSec = calcTravelTime(targetPos.x, targetPos.y);
                          const targetData = selected.data;
                          setAttackConfig({
                            targetName: targetData.profile.display_name,
                            targetX: targetPos.x, targetY: targetPos.y,
                            travelTime: travelSec, showEspionage: true,
                            targetId: targetData.village.user_id,
                            onAttack: () => {},
                          });
                        }}
                        className="w-full bg-accent/20 text-accent-foreground font-display text-[11px] py-2.5 rounded-lg active:bg-accent/30 transition-colors border border-accent/30">
                        🕵️ Send Spies ({spies} available)
                      </motion.button>
                    )}
                  </div>
                )}
              </div>
            )}

            {selected.kind === 'mine' && (() => {
              const isCaptured = capturedMines.has(selected.data.id);
              const outpostCost = { gold: 200, wood: 150, stone: 100, food: 50 };
              const canAffordOutpost = resources.gold >= outpostCost.gold && resources.wood >= outpostCost.wood && resources.stone >= outpostCost.stone && resources.food >= outpostCost.food;
              return (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">⛏️</span>
                  <div className="flex-1">
                    <h3 className="font-display text-sm text-foreground">{selected.data.name}</h3>
                    <p className="text-[10px] text-muted-foreground">Iron Ore Deposit · Yields ⚙️{selected.data.steelPerTick} steel/tick</p>
                  </div>
                  {isCaptured && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary">⛏️ Mining</span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {isCaptured
                    ? 'Your mining outpost here is producing steel.'
                    : `Defeat the garrison (⚔️${selected.data.power}), then build a mining outpost to extract steel.`}
                </p>
                {!isCaptured && (
                  <div className="space-y-1.5">
                    <div className="text-[9px] text-muted-foreground">
                      <span className="font-semibold text-foreground">Outpost cost:</span>{' '}
                      <span className={resources.gold >= outpostCost.gold ? '' : 'text-destructive'}>🪙{outpostCost.gold}</span>{' '}
                      <span className={resources.wood >= outpostCost.wood ? '' : 'text-destructive'}>🪵{outpostCost.wood}</span>{' '}
                      <span className={resources.stone >= outpostCost.stone ? '' : 'text-destructive'}>🪨{outpostCost.stone}</span>{' '}
                      <span className={resources.food >= outpostCost.food ? '' : 'text-destructive'}>🌾{outpostCost.food}</span>
                    </div>
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        const hasTroops = Object.values(army).some(v => v > 0);
                        if (!hasTroops) { toast.error('You need troops to clear the garrison!'); return; }
                        if (!canAffordOutpost) { toast.error('Not enough resources to build a mining outpost!'); return; }
                        if (!isInRange(selected.data.x, selected.data.y)) { toast.error('Out of range! Train scouts to extend reach.'); return; }
                        const travelSec = calcTravelTime(selected.data.x, selected.data.y);
                        const mineData = selected.data;
                        setAttackConfig({
                          targetName: mineData.name, targetPower: mineData.power,
                          targetX: mineData.x, targetY: mineData.y, travelTime: travelSec,
                          showEspionage: false,
                          onAttack: (sentArmy) => {
                            toast(`⚔️ Troops marching to ${mineData.name}... ETA ${travelSec}s`);
                            deployTroops(sentArmy);
                            createMarch(`atk-mine-${Date.now()}`, mineData.name, mineData.x, mineData.y, travelSec, async () => {
                              const log = attackTarget(mineData.name, mineData.power, sentArmy);
                              // Save battle report to DB
                              if (user) {
                                supabase.from('battle_reports').insert({
                                  attacker_id: user.id,
                                  defender_id: user.id,
                                  attacker_name: displayName,
                                  defender_name: mineData.name,
                                  result: log.result,
                                  attacker_troops_lost: log.troopsLost as any,
                                  defender_troops_lost: log.defenderTroopsLost as any || {},
                                  resources_raided: log.resourcesGained as any || {},
                                } as any).then();
                              }
                              if (log.result === 'victory') {
                                addResources({ gold: -outpostCost.gold, wood: -outpostCost.wood, stone: -outpostCost.stone, food: -outpostCost.food });
                                setCapturedMines(prev => new Set([...prev, mineData.id]));
                                // Persist captured mine as outpost in DB
                                if (user) {
                                  const { data: opData } = await supabase.from('outposts').insert({
                                    user_id: user.id, x: mineData.x, y: mineData.y, name: mineData.id, outpost_type: 'mine',
                                  }).select().single();
                                  if (opData) {
                                    setOutposts(prev => [...prev, { id: opData.id, x: mineData.x, y: mineData.y, name: mineData.id, user_id: user.id, level: 1, garrison_power: 0, garrison_troops: {}, has_wall: false, wall_level: 0, territory_radius: 5000, outpost_type: 'mine' }]);
                                    void refreshMineOutposts();
                                  }
                                }
                                toast.success(`⛏️ Mining outpost built at ${mineData.name}! Producing steel.`);
                              } else {
                                toast.error('Defeat! The garrison held.');
                              }
                            }, sentArmy);
                            setAttackConfig(null);
                            setSelected(null);
                          },
                        });
                      }}
                      disabled={!isInRange(selected.data.x, selected.data.y)}
                      className="w-full bg-primary text-primary-foreground font-display text-[11px] py-2.5 rounded-lg glow-gold-sm disabled:opacity-40 active:scale-95 transition-transform">
                      {!isInRange(selected.data.x, selected.data.y) ? '⚠️ Out of Range' : `⚔️ Clear Garrison & Build Outpost (⚔️${selected.data.power})`}
                    </motion.button>
                  </div>
                )}
              </div>
              );
            })()}

            {selected.kind === 'outpost' && (() => {
              const op = outposts.find(outpost => outpost.id === selected.data.id) ?? selected.data;
              const isOwn = op.user_id === user?.id;
              const isSettlement = op.outpost_type === 'settlement';
              const upgradeCost = { gold: 150 * op.level, wood: 100 * op.level, stone: 80 * op.level, food: 50 * op.level };
              const canAffordUpgrade = resources.gold >= upgradeCost.gold && resources.wood >= upgradeCost.wood && resources.stone >= upgradeCost.stone && resources.food >= upgradeCost.food;

              const isUpgrading = outpostBuildQueue.find(q => q.outpostId === op.id && q.action === 'upgrade');
              const upgradeTimeSec = 30 + op.level * 30;

              const handleUpgrade = async () => {
                if (!canAffordUpgrade) { toast.error('Not enough resources!'); return; }
                if (isUpgrading) { toast.error('Already upgrading!'); return; }
                addResources({ gold: -upgradeCost.gold, wood: -upgradeCost.wood, stone: -upgradeCost.stone, food: -upgradeCost.food });
                const newLevel = op.level + 1;
                const newGarrison = op.garrison_power + 20;
                const newRadius = op.territory_radius + 3000;
                const finishTime = Date.now() + upgradeTimeSec * 1000;
                setOutpostBuildQueue(prev => [...prev, { outpostId: op.id, action: 'upgrade', finishTime, targetLevel: newLevel, newGarrison, newRadius }]);
                // Persist to build_queue table
                if (user) {
                  supabase.from('build_queue').insert({ user_id: user.id, building_id: op.id, building_type: 'outpost_upgrade', target_level: newLevel, finish_time: new Date(finishTime).toISOString() } as any).then();
                }
                toast(`${isSettlement ? '🏘️' : '🏕️'} Upgrading ${op.name} to Lv.${newLevel}... (${Math.floor(upgradeTimeSec / 60)}:${(upgradeTimeSec % 60).toString().padStart(2, '0')})`);
              };

              // Find nearby outposts eligible for wall connections
              const WALL_CONNECT_DIST = 50000;
              const nearbyOwnOutposts = outposts.filter(other =>
                other.id !== op.id && other.user_id === user?.id && other.outpost_type !== 'mine' &&
                Math.hypot(other.x - op.x, other.y - op.y) <= WALL_CONNECT_DIST
              );
              // Existing wall segments from/to this outpost
              const existingWalls = wallSegments.filter(ws =>
                ws.outpost_a_id === op.id || ws.outpost_b_id === op.id
              );
              const connectedIds = new Set(existingWalls.map(ws =>
                ws.outpost_a_id === op.id ? ws.outpost_b_id : ws.outpost_a_id
              ));
              // Available to connect (nearby, not already connected)
              const availableToConnect = nearbyOwnOutposts.filter(n => !connectedIds.has(n.id));

              const wallCostPerSegment = { gold: 300, wood: 200, stone: 250, food: 50 };
              const canAffordWallSeg = resources.gold >= wallCostPerSegment.gold && resources.wood >= wallCostPerSegment.wood && resources.stone >= wallCostPerSegment.stone && resources.food >= wallCostPerSegment.food;

              const handleBuildWallTo = async (targetOutpost: typeof op) => {
                if (!canAffordWallSeg) { toast.error('Not enough resources!'); return; }
                if (!user) return;
                // Check not already connected
                const alreadyExists = wallSegments.find(ws =>
                  (ws.outpost_a_id === op.id && ws.outpost_b_id === targetOutpost.id) ||
                  (ws.outpost_a_id === targetOutpost.id && ws.outpost_b_id === op.id)
                );
                if (alreadyExists) { toast.error('Wall already exists between these outposts!'); return; }

                addResources({ gold: -wallCostPerSegment.gold, wood: -wallCostPerSegment.wood, stone: -wallCostPerSegment.stone, food: -wallCostPerSegment.food });

                const wallTimeSec = 60;
                const finishTime = Date.now() + wallTimeSec * 1000;
                setOutpostBuildQueue(prev => [...prev, { outpostId: op.id, action: 'wall', finishTime, targetLevel: 1, newGarrison: 30, targetOutpostId: targetOutpost.id }]);

                toast(`🧱 Building wall from ${op.name} to ${targetOutpost.name}... (1:00)`);

                // After build time, create the wall segment
                setTimeout(async () => {
                  const [idA, idB] = [op.id, targetOutpost.id].sort();
                  const { data, error } = await supabase.from('wall_segments').insert({
                    user_id: user.id,
                    outpost_a_id: idA,
                    outpost_b_id: idB,
                    wall_level: 1,
                    health: 100,
                    max_health: 100,
                  } as any).select().single();
                  if (!error && data) {
                    setWallSegments(prev => [...prev, { id: data.id, user_id: user.id, outpost_a_id: idA, outpost_b_id: idB, wall_level: 1, health: 100, max_health: 100 }]);
                    toast.success(`🧱 Wall built between ${op.name} and ${targetOutpost.name}!`);
                  } else {
                    toast.error('Failed to build wall segment');
                  }
                  setOutpostBuildQueue(prev => prev.filter(q => !(q.outpostId === op.id && q.targetOutpostId === targetOutpost.id)));
                }, wallTimeSec * 1000);
              };

              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{isSettlement ? '🏘️' : (op.outpost_type === 'fort' ? '🏰' : (op.outpost_type === 'bridge' ? '🌉' : (isOwn ? '🏕️' : '⚑')))}</span>
                    <div className="flex-1">
                      <h3 className="font-display text-sm text-foreground">{op.name}</h3>
                      <div className="flex items-center gap-2 text-[9px]">
                        <span className="text-primary font-semibold">Lv.{op.level}</span>
                        <span className="text-muted-foreground">⚔️{op.garrison_power} defense</span>
                        {existingWalls.length > 0 && <span className="text-accent-foreground bg-accent/20 px-1.5 rounded-full">🧱 {existingWalls.length} wall{existingWalls.length !== 1 ? 's' : ''}</span>}
                        {isSettlement && <span className="text-primary bg-primary/10 px-1.5 rounded-full">Settlement</span>}
                        {op.outpost_type === 'fort' && <span className="text-accent-foreground bg-accent/20 px-1.5 rounded-full">🏰 Fort</span>}
                        {op.outpost_type === 'bridge' && <span className="text-sky-300 bg-sky-500/20 px-1.5 rounded-full">🌉 Bridge</span>}
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {isOwn
                      ? (isSettlement
                        ? 'Your settlement. Switch to it from the resource bar to manage buildings and resources independently.'
                        : op.outpost_type === 'fort'
                          ? 'Your fort. Can garrison armies. Upgrade to Lv.10 to convert into a full settlement.'
                          : op.outpost_type === 'bridge'
                            ? 'Your bridge. Troops can cross the river here. Can be destroyed by siege weapons or espionage.'
                            : 'Your outpost. Upgrade to Lv.5 to convert into a fort, or build a bridge if near a river.')
                      : `Enemy ${isSettlement ? 'settlement' : op.outpost_type === 'fort' ? 'fort' : op.outpost_type === 'bridge' ? 'bridge' : 'outpost'}. Garrison strength: ⚔️${op.garrison_power}`}
                  </p>
                  {isOwn && (
                    <div className="space-y-2">
                      {/* Upgrade */}
                      <div className="bg-muted/30 rounded-lg p-2 space-y-1">
                        <p className="text-[10px] font-semibold text-foreground">⬆️ Upgrade to Lv.{op.level + 1}</p>
                        <p className="text-[8px] text-muted-foreground">+5k vision, +3k territory, +20 garrison</p>
                        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                          <span className={resources.gold >= upgradeCost.gold ? '' : 'text-destructive'}>🪙{upgradeCost.gold}</span>
                          <span className={resources.wood >= upgradeCost.wood ? '' : 'text-destructive'}>🪵{upgradeCost.wood}</span>
                          <span className={resources.stone >= upgradeCost.stone ? '' : 'text-destructive'}>🪨{upgradeCost.stone}</span>
                          <span className={resources.food >= upgradeCost.food ? '' : 'text-destructive'}>🌾{upgradeCost.food}</span>
                        </div>
                        {isUpgrading ? (
                          <div className="w-full bg-muted rounded-lg py-2 text-center space-y-1">
                            <p className="font-display text-[11px] text-primary">⏳ Upgrading...</p>
                            <div className="bg-background rounded-full h-1.5 mx-2 overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.max(0, 100 - ((isUpgrading.finishTime - Date.now()) / (upgradeTimeSec * 1000)) * 100)}%` }} />
                            </div>
                            <p className="text-[9px] text-muted-foreground">{Math.max(0, Math.ceil((isUpgrading.finishTime - Date.now()) / 1000))}s remaining</p>
                          </div>
                        ) : (
                          <motion.button whileTap={{ scale: 0.95 }} onClick={handleUpgrade} disabled={!canAffordUpgrade}
                            className="w-full bg-primary text-primary-foreground font-display text-[11px] py-2 rounded-lg glow-gold-sm disabled:opacity-40 active:scale-95 transition-transform">
                            ⬆️ Upgrade Outpost ({Math.floor(upgradeTimeSec / 60)}:{(upgradeTimeSec % 60).toString().padStart(2, '0')})
                          </motion.button>
                        )}
                      </div>

                      {/* ── Build Wall Segments ── */}
                      <div className="bg-muted/30 rounded-lg p-2 space-y-1.5">
                        <p className="text-[10px] font-semibold text-foreground">🧱 Wall Connections</p>
                        <p className="text-[8px] text-muted-foreground">
                          Build walls between outposts to block enemy troops. Walls can be destroyed by siege weapons or espionage.
                        </p>

                        {/* Existing walls from this outpost */}
                        {existingWalls.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[8px] text-muted-foreground font-semibold">Connected walls:</p>
                            {existingWalls.map(ws => {
                              const otherId = ws.outpost_a_id === op.id ? ws.outpost_b_id : ws.outpost_a_id;
                              const otherOp = outposts.find(o => o.id === otherId);
                              const healthPct = ws.health / ws.max_health;
                              return (
                                <div key={ws.id} className="flex items-center gap-1.5 bg-accent/10 rounded p-1.5">
                                  <span className="text-[9px] text-foreground flex-1">🧱 → {otherOp?.name || 'Unknown'}</span>
                                  <span className="text-[8px] text-muted-foreground">Lv.{ws.wall_level}</span>
                                  <div className="w-10 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{
                                      width: `${healthPct * 100}%`,
                                      backgroundColor: healthPct > 0.5 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))',
                                    }} />
                                  </div>
                                  <span className="text-[7px] text-muted-foreground">{ws.health}/{ws.max_health}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Available connections */}
                        {availableToConnect.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[8px] text-muted-foreground font-semibold">Build wall to:</p>
                            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground mb-1">
                              <span className={resources.gold >= wallCostPerSegment.gold ? '' : 'text-destructive'}>🪙{wallCostPerSegment.gold}</span>
                              <span className={resources.wood >= wallCostPerSegment.wood ? '' : 'text-destructive'}>🪵{wallCostPerSegment.wood}</span>
                              <span className={resources.stone >= wallCostPerSegment.stone ? '' : 'text-destructive'}>🪨{wallCostPerSegment.stone}</span>
                              <span className={resources.food >= wallCostPerSegment.food ? '' : 'text-destructive'}>🌾{wallCostPerSegment.food}</span>
                              <span className="text-muted-foreground/60">per segment</span>
                            </div>
                            {availableToConnect.slice(0, 5).map(target => {
                              const dist = Math.hypot(target.x - op.x, target.y - op.y);
                              const isBuilding = outpostBuildQueue.find(q => q.outpostId === op.id && q.targetOutpostId === target.id);
                              return (
                                <div key={target.id} className="flex items-center gap-1.5">
                                  {isBuilding ? (
                                    <div className="flex-1 bg-muted rounded py-1.5 px-2 text-center">
                                      <p className="font-display text-[9px] text-accent-foreground">⏳ Building...</p>
                                      <p className="text-[8px] text-muted-foreground">{Math.max(0, Math.ceil((isBuilding.finishTime - Date.now()) / 1000))}s</p>
                                    </div>
                                  ) : (
                                    <motion.button whileTap={{ scale: 0.95 }}
                                      onClick={() => handleBuildWallTo(target)}
                                      disabled={!canAffordWallSeg}
                                      className="flex-1 flex items-center justify-between bg-accent/20 hover:bg-accent/30 text-accent-foreground font-display text-[10px] py-1.5 px-2 rounded disabled:opacity-40 active:scale-95 transition-all">
                                      <span>🧱 → {target.name}</span>
                                      <span className="text-[8px] text-muted-foreground">{Math.round(dist / 1000)}k</span>
                                    </motion.button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {availableToConnect.length === 0 && existingWalls.length === 0 && (
                          <p className="text-[8px] text-muted-foreground italic">No nearby outposts within range. Build outposts closer together to connect walls.</p>
                        )}
                      </div>
                      {/* Convert to Bridge — only for outposts near a river */}
                      {op.outpost_type === 'outpost' && (() => {
                        // Check if this outpost is near any river
                        const BRIDGE_RIVER_DIST = 8000;
                        const nearRiver = visibleTerrain.some(t => {
                          if (t.type !== 'river' || !t.points) return false;
                          for (let i = 0; i < t.points.length - 1; i++) {
                            if (isPointNearRiverSegment(op.x, op.y, t.points[i], t.points[i + 1], (t.width || 3000) + BRIDGE_RIVER_DIST)) return true;
                          }
                          return false;
                        });
                        if (!nearRiver) return null;
                        const bridgeCost = { gold: 500, wood: 400, stone: 300, food: 100 };
                        const canAffordBridge = resources.gold >= bridgeCost.gold && resources.wood >= bridgeCost.wood && resources.stone >= bridgeCost.stone && resources.food >= bridgeCost.food;
                        return (
                          <div className="bg-sky-500/10 rounded-lg p-2 space-y-1 border border-sky-400/20">
                            <p className="text-[10px] font-semibold text-sky-300">🌉 Convert to Bridge</p>
                            <p className="text-[8px] text-muted-foreground">This outpost is near a river. Convert it into a bridge to allow troops to cross here.</p>
                            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                              <span className={resources.gold >= bridgeCost.gold ? '' : 'text-destructive'}>🪙{bridgeCost.gold}</span>
                              <span className={resources.wood >= bridgeCost.wood ? '' : 'text-destructive'}>🪵{bridgeCost.wood}</span>
                              <span className={resources.stone >= bridgeCost.stone ? '' : 'text-destructive'}>🪨{bridgeCost.stone}</span>
                              <span className={resources.food >= bridgeCost.food ? '' : 'text-destructive'}>🌾{bridgeCost.food}</span>
                            </div>
                            <motion.button whileTap={{ scale: 0.95 }}
                              disabled={!canAffordBridge}
                              onClick={async () => {
                                if (!user) return;
                                if (!window.confirm(`Convert ${op.name} into a bridge? Troops will be able to cross the river here.`)) return;
                                addResources({ gold: -bridgeCost.gold, wood: -bridgeCost.wood, stone: -bridgeCost.stone, food: -bridgeCost.food });
                                const bridgeName = `Bridge at ${op.name.replace(/^Outpost\s*/, '')}`.trim() || `River Bridge`;
                                await supabase.from('outposts').update({ outpost_type: 'bridge', name: bridgeName } as any).eq('id', op.id);
                                setOutposts(prev => prev.map(o => o.id === op.id ? { ...o, outpost_type: 'bridge', name: bridgeName } : o));
                                toast.success(`🌉 ${bridgeName} has been built! Troops can now cross the river here.`);
                                setSelected(null);
                              }}
                              className="w-full bg-sky-600/80 text-white font-display text-[11px] py-2 rounded-lg disabled:opacity-40 active:scale-95 transition-transform">
                              🌉 Build Bridge
                            </motion.button>
                          </div>
                        );
                      })()}
                      {/* Convert to Fort at Lv.5+ */}
                      {op.outpost_type === 'outpost' && op.level >= 5 && (
                        <div className="bg-accent/20 rounded-lg p-2 space-y-1">
                          <p className="text-[10px] font-semibold text-accent-foreground">🏰 Convert to Fort</p>
                          <p className="text-[8px] text-muted-foreground">Upgrade this outpost into a fort. Forts can garrison armies and have stronger defenses. At Lv.10, forts can become full settlements.</p>
                          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                            <span className={resources.gold >= 400 ? '' : 'text-destructive'}>🪙400</span>
                            <span className={resources.wood >= 250 ? '' : 'text-destructive'}>🪵250</span>
                            <span className={resources.stone >= 300 ? '' : 'text-destructive'}>🪨300</span>
                            <span className={resources.food >= 100 ? '' : 'text-destructive'}>🌾100</span>
                          </div>
                          <motion.button whileTap={{ scale: 0.95 }}
                            disabled={resources.gold < 400 || resources.wood < 250 || resources.stone < 300 || resources.food < 100}
                            onClick={async () => {
                              if (!user) return;
                              if (!window.confirm(`Convert ${op.name} into a fort? This costs 400 gold, 250 wood, 300 stone, 100 food.`)) return;
                              addResources({ gold: -400, wood: -250, stone: -300, food: -100 });
                              const fortName = op.name.replace(/^Outpost/, 'Fort') || `Fort ${Math.floor(Math.random() * 100)}`;
                              await supabase.from('outposts').update({ outpost_type: 'fort', name: fortName, garrison_power: op.garrison_power + 50 } as any).eq('id', op.id);
                              setOutposts(prev => prev.map(o => o.id === op.id ? { ...o, outpost_type: 'fort', name: fortName, garrison_power: o.garrison_power + 50 } : o));
                              toast.success(`🏰 ${fortName} has been established!`);
                              setSelected(null);
                            }}
                            className="w-full bg-accent text-accent-foreground font-display text-[11px] py-2 rounded-lg disabled:opacity-40 active:scale-95 transition-transform">
                            🏰 Convert to Fort
                          </motion.button>
                        </div>
                      )}
                      {/* Convert Fort to Settlement at Lv.10+ */}
                      {op.outpost_type === 'fort' && op.level >= 10 && (
                        <div className="bg-primary/20 rounded-lg p-2 space-y-1">
                          <p className="text-[10px] font-semibold text-primary">🏘️ Convert to Settlement</p>
                          <p className="text-[8px] text-muted-foreground">This fort is powerful enough to become a full settlement with its own village, buildings, and resource production.</p>
                          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                            <span className={resources.gold >= 800 ? '' : 'text-destructive'}>🪙800</span>
                            <span className={resources.wood >= 500 ? '' : 'text-destructive'}>🪵500</span>
                            <span className={resources.stone >= 400 ? '' : 'text-destructive'}>🪨400</span>
                            <span className={resources.food >= 200 ? '' : 'text-destructive'}>🌾200</span>
                          </div>
                          <motion.button whileTap={{ scale: 0.95 }}
                            disabled={resources.gold < 800 || resources.wood < 500 || resources.stone < 400 || resources.food < 200}
                            onClick={async () => {
                              if (!user) return;
                              if (!window.confirm(`Convert ${op.name} into a full settlement? This costs 800 gold, 500 wood, 400 stone, 200 food.`)) return;
                              addResources({ gold: -800, wood: -500, stone: -400, food: -200 });
                              const settleName = op.name.replace(/^Fort/, 'Settlement') || `Settlement ${Math.floor(Math.random() * 100)}`;
                              const { data: newVillage, error } = await supabase.from('villages').insert({
                                user_id: user.id,
                                name: settleName,
                                map_x: op.x,
                                map_y: op.y,
                                settlement_type: 'village',
                                gold: 100, wood: 100, stone: 50, food: 50,
                                population: 5, max_population: 15,
                              }).select().single();
                              if (error || !newVillage) { toast.error(`Failed: ${error?.message || 'Unknown'}`); return; }
                              await supabase.from('buildings').insert([
                                { village_id: newVillage.id, user_id: user.id, type: 'townhall', level: 1, position: 4 },
                                { village_id: newVillage.id, user_id: user.id, type: 'farm', level: 1, position: 7 },
                                { village_id: newVillage.id, user_id: user.id, type: 'lumbermill', level: 1, position: 3 },
                              ]);
                              await supabase.from('outposts').update({ outpost_type: 'settlement', name: settleName } as any).eq('id', op.id);
                              setOutposts(prev => prev.map(o => o.id === op.id ? { ...o, outpost_type: 'settlement', name: settleName } : o));
                              await refreshVillages();
                              toast.success(`🏘️ ${settleName} is now a full settlement!`);
                              setSelected(null);
                            }}
                            className="w-full bg-primary text-primary-foreground font-display text-[11px] py-2 rounded-lg glow-gold-sm disabled:opacity-40 active:scale-95 transition-transform">
                            🏘️ Convert to Settlement
                          </motion.button>
                        </div>
                      )}
                      {/* Troop Transfer (forts and settlements only) */}
                      {(op.outpost_type === 'fort' || isSettlement) && (
                        <TroopTransferPanel
                          outpost={op as any}
                          allOutposts={outposts as any}
                          myVillagePos={getMyPos()}
                          onTransferComplete={() => {
                            // Refresh outposts
                            supabase.from('outposts').select('*').then(({ data }) => {
                              if (data) {
                                setOutposts(data.map((o: any) => ({ id: o.id, x: o.x, y: o.y, name: o.name, user_id: o.user_id, level: o.level || 1, garrison_power: o.garrison_power || 0, garrison_troops: o.garrison_troops || {}, has_wall: o.has_wall || false, wall_level: o.wall_level || 0, territory_radius: o.territory_radius || 15000, outpost_type: o.outpost_type || 'outpost' })));
                              }
                            });
                          }}
                          createMarch={createMarch}
                        />
                      )}
                      {/* Delete Outpost (only for non-settlement outposts) */}
                      {!isSettlement && (
                        <div className="bg-destructive/10 rounded-lg p-2 space-y-1">
                          <p className="text-[10px] font-semibold text-destructive">🗑️ Demolish Outpost</p>
                          <p className="text-[8px] text-muted-foreground">Permanently remove this outpost. This cannot be undone.</p>
                          <motion.button whileTap={{ scale: 0.95 }}
                            onClick={async () => {
                              if (!window.confirm(`Demolish ${op.name}? This cannot be undone.`)) return;
                              await supabase.from('outposts').delete().eq('id', op.id);
                              setOutposts(prev => prev.filter(o => o.id !== op.id));
                              toast.success(`🗑️ ${op.name} demolished.`);
                              setSelected(null);
                            }}
                            className="w-full bg-destructive text-destructive-foreground font-display text-[11px] py-2 rounded-lg active:scale-95 transition-transform">
                            🗑️ Demolish
                          </motion.button>
                        </div>
                      )}
                    </div>
                  )}
                  {!isOwn && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] text-muted-foreground">
                        Defeat the garrison to raze this outpost. Wall level adds +{op.wall_level * 10} bonus defense.
                      </p>
                      <motion.button whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          const hasTroops = Object.values(army).some(v => v > 0);
                          if (!hasTroops) { toast.error('You need troops to attack!'); return; }
                          if (!isInRange(op.x, op.y)) { toast.error('Out of range! Train scouts to extend reach.'); return; }
                          const travelSec = calcTravelTime(op.x, op.y);
                          const totalDefense = op.garrison_power + (op.wall_level * 10);
                          const outpostData = op;
                          setAttackConfig({
                            targetName: outpostData.name,
                            targetPower: totalDefense,
                            targetX: outpostData.x, targetY: outpostData.y,
                            travelTime: travelSec, showEspionage: false,
                            onAttack: (sentArmy) => {
                              toast(`⚔️ Troops marching to ${outpostData.name}... ETA ${travelSec}s`);
                              deployTroops(sentArmy);
                              createMarch(`atk-op-${Date.now()}`, outpostData.name, outpostData.x, outpostData.y, travelSec, async () => {
                                const log = attackTarget(outpostData.name, totalDefense, sentArmy);
                                // Save outpost battle report to DB
                                if (user) {
                                  supabase.from('battle_reports').insert({
                                    attacker_id: user.id,
                                    defender_id: outpostData.user_id,
                                    attacker_name: displayName,
                                    defender_name: outpostData.name,
                                    result: log.result,
                                    attacker_troops_lost: log.troopsLost as any,
                                    defender_troops_lost: log.defenderTroopsLost as any || {},
                                    resources_raided: log.resourcesGained as any || {},
                                  } as any).then();
                                }
                                if (log.result === 'victory') {
                                  await supabase.rpc('raze_outpost', { p_outpost_id: outpostData.id });
                                  setOutposts(prev => prev.filter(o => o.id !== outpostData.id));
                                  toast.success(`🔥 ${outpostData.name} razed! Enemy outpost destroyed.`);
                                } else {
                                  toast.error(`Defeated! ${outpostData.name}'s garrison held.`);
                                }
                              }, sentArmy);
                              setAttackConfig(null);
                              setSelected(null);
                            },
                          });
                        }}
                        className="w-full bg-destructive text-destructive-foreground font-display text-[11px] py-2.5 rounded-lg glow-gold-sm active:scale-95 transition-transform">
                        ⚔️ Attack Outpost (⚔️{op.garrison_power + op.wall_level * 10})
                      </motion.button>
                    </div>
                  )}
                </div>
              );
            })()}

            {selected.kind === 'empty' && (() => {
              const thLevel = buildings.find(b => b.type === 'townhall')?.level || 1;
              const outpostCost = { gold: 300, wood: 200, stone: 150, food: 100 };
              const canAffordOp = resources.gold >= outpostCost.gold && resources.wood >= outpostCost.wood && resources.stone >= outpostCost.stone && resources.food >= outpostCost.food;
              const canBuildOutpost = thLevel >= 3;
              const inRange = isInRange(selected.data.x, selected.data.y);
              const coordLabel = `${(selected.data.x / 1000).toFixed(1)}k, ${(selected.data.y / 1000).toFixed(1)}k`;
              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">📍</span>
                    <div>
                      <h3 className="font-display text-sm text-foreground">Unexplored Territory</h3>
                      <p className="text-[9px] text-muted-foreground font-mono">{coordLabel}</p>
                    </div>
                  </div>

                  {/* Found Outpost */}
                  <div className="bg-muted/30 rounded-lg p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="font-display text-[11px] text-foreground">🏕️ Found Outpost</p>
                      {!canBuildOutpost && <span className="text-[8px] text-destructive">TH Lv.3+</span>}
                    </div>
                    <p className="text-[9px] text-muted-foreground">Expand your borders and reveal fog of war in this area.</p>
                    <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                      <span className={resources.gold >= outpostCost.gold ? '' : 'text-destructive'}>🪙{outpostCost.gold}</span>
                      <span className={resources.wood >= outpostCost.wood ? '' : 'text-destructive'}>🪵{outpostCost.wood}</span>
                      <span className={resources.stone >= outpostCost.stone ? '' : 'text-destructive'}>🪨{outpostCost.stone}</span>
                      <span className={resources.food >= outpostCost.food ? '' : 'text-destructive'}>🌾{outpostCost.food}</span>
                    </div>
                    <motion.button whileTap={{ scale: 0.95 }}
                      disabled={!canBuildOutpost || !canAffordOp || !inRange}
                      onClick={() => {
                        if (!canBuildOutpost) { toast.error('Town Hall level 3 required!'); return; }
                        if (!canAffordOp) { toast.error('Not enough resources!'); return; }
                        if (!inRange) { toast.error('Out of range! Train scouts to extend reach.'); return; }
                        // Enforce minimum distance between outposts to prevent territory overlap
                        const MIN_OUTPOST_DISTANCE = 25000; // Must be > territory_radius * 2 (15000 * 2 = 30000 but allow some closeness)
                        const tooCloseOutpost = outposts.find(op => {
                          const dist = Math.hypot(op.x - selected.data.x, op.y - selected.data.y);
                          return dist < MIN_OUTPOST_DISTANCE;
                        });
                        if (tooCloseOutpost) {
                          toast.error(`Too close to ${tooCloseOutpost.name}! Outposts must be at least ${Math.round(MIN_OUTPOST_DISTANCE / 1000)}k units apart to avoid territory overlap.`);
                          return;
                        }
                        const travelSec = calcTravelTime(selected.data.x, selected.data.y);
                        const targetData = selected.data;
                        toast(`🏗️ Settlers heading out... ETA ${travelSec}s`);
                        addResources({ gold: -outpostCost.gold, wood: -outpostCost.wood, stone: -outpostCost.stone, food: -outpostCost.food });
                        createMarch(`outpost-${Date.now()}`, 'New Outpost', targetData.x, targetData.y, travelSec, async () => {
                          const opName = `Outpost ${outposts.length + 1}`;
                          const { data, error } = await supabase.from('outposts').insert({
                            user_id: user!.id, x: targetData.x, y: targetData.y, name: opName, outpost_type: 'outpost',
                          }).select().single();
                          if (error) { toast.error('Failed to build outpost'); return; }
                          setOutposts(prev => [...prev, { id: data.id, x: data.x, y: data.y, name: data.name, user_id: user!.id, level: 1, garrison_power: 0, garrison_troops: {}, has_wall: false, wall_level: 0, territory_radius: 15000, outpost_type: 'outpost' }]);
                          toast.success(`🏕️ ${opName} established! Fog lifted in this area.`);
                        });
                        setSelected(null);
                      }}
                      className="w-full bg-primary text-primary-foreground font-display text-[11px] py-2 rounded-lg glow-gold-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform">
                      {!inRange ? '⚠️ Out of Range' : '🏕️ Found Outpost'}
                    </motion.button>
                  </div>

                  {/* Hint about settlement path */}
                  <div className="bg-muted/20 rounded-lg p-2 text-center">
                    <p className="text-[9px] text-muted-foreground">💡 Upgrade an outpost to Lv.5 to convert it into a full settlement with its own village and resources.</p>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attack Configuration Panel */}
      <AnimatePresence>
        {attackConfig && (
          <motion.div
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-16 sm:bottom-14 inset-x-0 z-[60] mx-2 sm:mx-3 game-panel border-glow rounded-xl p-3 max-h-[55vh] overflow-y-auto safe-bottom">
            <AttackConfigPanel
              targetName={attackConfig.targetName}
              targetPower={attackConfig.targetPower}
              targetId={attackConfig.targetId}
              targetX={attackConfig.targetX}
              targetY={attackConfig.targetY}
              travelTime={attackConfig.travelTime}
              showEspionage={attackConfig.showEspionage}
              onConfirmAttack={attackConfig.onAttack}
              onConfirmEspionage={(mission, count) => {
                if (attackConfig.targetId) {
                  sendSpyMission(mission, attackConfig.targetName, attackConfig.targetId, attackConfig.targetX, attackConfig.targetY, count);
                  toast(`🕵️ Spies dispatched to ${attackConfig.targetName}`);
                }
                setAttackConfig(null);
                setSelected(null);
              }}
              onCancel={() => setAttackConfig(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
