import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame, TroopType, Resources, calcMarchTime, getMaxRange, Building, BUILDING_INFO, getSlowestTroopSpeed, WATCHTOWER_RANGE_BONUS } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import { useNPCState } from '@/hooks/useNPCState';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import NPCInteractionPanel from './NPCInteractionPanel';
import { useTroopSkins } from '@/hooks/useTroopSkins';
import AttackConfigPanel from './AttackConfigPanel';
import { FACTION_MAP_SPRITES } from './factionMapSprites';
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

function isCellBlocked(wx: number, wy: number, terrainFeatures: TerrainFeature[]): boolean {
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
      // Check if near river but NOT near a bridge
      for (let i = 0; i < t.points.length - 1; i++) {
        if (isPointNearRiverSegment(wx, wy, t.points[i], t.points[i + 1], riverW)) {
          if (t.bridgeAt && isPointNearBridge(wx, wy, t.bridgeAt, riverW * 2)) return false; // bridge crossing OK
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

function findPath(startX: number, startY: number, endX: number, endY: number, terrainFeatures: TerrainFeature[]): { x: number; y: number }[] {
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
      if (isCellBlocked(worldX, worldY, terrainFeatures)) continue;
      
      const moveCost = dx !== 0 && dy !== 0 ? 1.414 : 1;
      const ng = current.g + moveCost;
      const existingG = gScores.get(nk);
      if (existingG !== undefined && ng >= existingG) continue;
      
      gScores.set(nk, ng);
      const h = Math.sqrt((ex - nx) ** 2 + (ey - ny) ** 2);
      open.push({ x: nx, y: ny, g: ng, h, f: ng + h, parent: current });
    }
  }
  
  // No path found — fall back to straight line
  return [{ x: startX, y: startY }, { x: endX, y: endY }];
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
  Forest: '🌲', Steppe: '🌿', Badlands: '🌋', Coast: '⚓', Jungle: '🌴',
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
  | { kind: 'outpost'; data: { id: string; x: number; y: number; name: string; user_id: string; level: number; garrison_power: number; has_wall: boolean; wall_level: number; territory_radius: number; outpost_type: string } }
  | { kind: 'empty'; data: { x: number; y: number } }
  | null;

export default function WorldMap() {
  const { allVillages, addResources, army, totalArmyPower, attackTarget, attackPlayer, vassalages, buildings, displayName, spies, sendSpyMission, resources, getWatchtowerLevel, getSpyGuildLevel, refreshVillages, refreshMineOutposts, myVillages, settlementType, deployTroops, returnTroops } = useGame();
  const { user } = useAuth();
  const npcState = useNPCState();
  const { activeSkin, getBuildingSprite, getSpriteFilter } = useTroopSkins();
  const [selected, setSelected] = useState<SelectedItem>(null);
  const [claimedEvents, setClaimedEvents] = useState<Set<string>>(new Set());
  const [capturedMines, setCapturedMines] = useState<Set<string>>(new Set());
  const [outposts, setOutposts] = useState<{ id: string; x: number; y: number; name: string; user_id: string; level: number; garrison_power: number; has_wall: boolean; wall_level: number; territory_radius: number; outpost_type: string }[]>([]);
  const [outpostBuildQueue, setOutpostBuildQueue] = useState<{ outpostId: string; action: 'upgrade' | 'wall'; finishTime: number; targetLevel: number; newGarrison: number; newRadius?: number }[]>([]);
  const [marches, setMarches] = useState<{ id: string; targetName: string; arrivalTime: number; startTime: number; startX: number; startY: number; targetX: number; targetY: number; waypoints: { x: number; y: number }[]; action: () => void }[]>([]);
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
        setOutposts(data.map((o: any) => ({ id: o.id, x: o.x, y: o.y, name: o.name, user_id: o.user_id, level: o.level || 1, garrison_power: o.garrison_power || 0, has_wall: o.has_wall || false, wall_level: o.wall_level || 0, territory_radius: o.territory_radius || 15000, outpost_type: o.outpost_type || 'outpost' })));
        // Initialize captured mines from outposts with type 'mine'
        const mineOutposts = data.filter((o: any) => o.outpost_type === 'mine' && o.user_id === user.id);
        if (mineOutposts.length > 0) {
          setCapturedMines(new Set(mineOutposts.map((o: any) => o.name)));
        }
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
        m.action();
      });
      // Clean up arrived marches from DB
      if (user) {
        supabase.from('active_marches').delete().eq('user_id', user.id).lte('arrives_at', new Date().toISOString()).then(() => {});
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [marches, user]);

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

  // Collect all terrain for pathfinding
  const allTerrain = useMemo(() => {
    const terrain: TerrainFeature[] = [];
    for (const chunk of visibleChunks) {
      terrain.push(...chunk.data.terrain);
    }
    return terrain;
  }, [visibleChunks]);

  // Helper to create a march with pathfinding around obstacles
  const createMarch = useCallback((id: string, targetName: string, targetX: number, targetY: number, _travelSec: number, action: () => void) => {
    const myPos = getMyPos();
    const now = Date.now();
    const waypoints = findPath(myPos.x, myPos.y, targetX, targetY, allTerrain);
    const pathDist = getPathLength(waypoints);
    const actualTravelSec = Math.max(5, Math.floor(pathDist / (getSlowestTroopSpeed(army) * 200)));
    const arrivalTime = now + actualTravelSec * 1000;
    setMarches(prev => [...prev, {
      id, targetName, arrivalTime,
      startTime: now, startX: myPos.x, startY: myPos.y,
      targetX, targetY, waypoints, action,
    }]);
    // Persist to DB for live visibility by other players
    if (user) {
      supabase.from('active_marches').insert({
        user_id: user.id,
        player_name: displayName,
        start_x: myPos.x, start_y: myPos.y,
        target_x: targetX, target_y: targetY,
        target_name: targetName,
        arrives_at: new Date(arrivalTime).toISOString(),
        march_type: id.startsWith('atk') || id.startsWith('pvp') ? 'attack' : id.startsWith('envoy') ? 'envoy' : 'march',
      }).then(() => {});
    }
    if (pathDist > Math.hypot(targetX - myPos.x, targetY - myPos.y) * 1.1) {
      toast.info(`Route adjusted around obstacles — travel time: ${actualTravelSec}s`);
    }
  }, [getMyPos, allTerrain, army, user, displayName]);

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
          });
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
        });
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
                onClick={(e) => { e.stopPropagation(); setSelected({ kind: 'player', data: pv }); }}
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
                <img src={mapSoldier} alt="Army" className="drop-shadow-lg"
                  style={{ width: marchSize, height: marchSize, objectFit: 'contain', transform: facingLeft ? 'scaleX(-1)' : undefined, filter: getSpriteFilter() }} loading="lazy" />
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

        {/* ── Territory borders ── */}
        {outposts.map(outpost => {
          if (!isWithinVision(outpost.x, outpost.y, outpost.territory_radius)) return null;
          if (!isVisible(outpost.x, outpost.y, 200)) return null;
          const { sx, sy } = worldToScreen(outpost.x, outpost.y);
          const isOwn = outpost.user_id === user?.id;
          const tr = outpost.territory_radius * camera.ppu;
          if (tr < 10) return null;
          const borderColor = isOwn ? 'hsl(var(--primary))' : 'hsl(var(--destructive))';
          const fillColor = isOwn ? 'hsl(var(--primary) / 0.04)' : 'hsl(var(--destructive) / 0.03)';
          return (
            <div key={`territory-${outpost.id}`} className="absolute pointer-events-none z-[10]"
              style={{ left: sx - tr, top: sy - tr, width: tr * 2, height: tr * 2 }}>
              <div className="w-full h-full rounded-full" style={{
                border: outpost.has_wall ? `2px solid ${borderColor}` : `1px dashed ${borderColor}`,
                background: fillColor,
                opacity: outpost.has_wall ? 0.7 : 0.4,
              }} />
              {outpost.has_wall && (
                <div className="absolute inset-1 rounded-full" style={{
                  border: `1px solid ${borderColor}`,
                  opacity: 0.3,
                }} />
              )}
            </div>
          );
        })}

        {/* ── Outpost markers on the map ── */}
        {outposts.map(outpost => {
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
                isInRange={isInRange(selected.data.x, selected.data.y)}
                travelTime={calcTravelTime(selected.data.x, selected.data.y)}
                hasActiveTrade={tradeContracts.some(c => c.realmId === selected.data.id)}
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
                                });
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
                                    setOutposts(prev => [...prev, { id: opData.id, x: mineData.x, y: mineData.y, name: mineData.id, user_id: user.id, level: 1, garrison_power: 0, has_wall: false, wall_level: 0, territory_radius: 5000, outpost_type: 'mine' }]);
                                    void refreshMineOutposts();
                                  }
                                }
                                toast.success(`⛏️ Mining outpost built at ${mineData.name}! Producing steel.`);
                              } else {
                                toast.error('Defeat! The garrison held.');
                              }
                            });
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
              const wallCost = op.has_wall
                ? { gold: 200 * (op.wall_level + 1), wood: 150 * (op.wall_level + 1), stone: 200 * (op.wall_level + 1), food: 0 }
                : { gold: 300, wood: 200, stone: 250, food: 50 };
              const canAffordUpgrade = resources.gold >= upgradeCost.gold && resources.wood >= upgradeCost.wood && resources.stone >= upgradeCost.stone && resources.food >= upgradeCost.food;
              const canAffordWall = resources.gold >= wallCost.gold && resources.wood >= wallCost.wood && resources.stone >= wallCost.stone && resources.food >= wallCost.food;

              const isUpgrading = outpostBuildQueue.find(q => q.outpostId === op.id && q.action === 'upgrade');
              const isBuildingWall = outpostBuildQueue.find(q => q.outpostId === op.id && q.action === 'wall');
              const upgradeTimeSec = 30 + op.level * 30;
              const wallTimeSec = 45 + op.wall_level * 30;

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

              const handleWall = async () => {
                if (!canAffordWall) { toast.error('Not enough resources!'); return; }
                if (isBuildingWall) { toast.error('Already building wall!'); return; }
                addResources({ gold: -wallCost.gold, wood: -wallCost.wood, stone: -wallCost.stone, food: -wallCost.food });
                const newWallLevel = op.wall_level + 1;
                const newGarrison = op.garrison_power + 30;
                const finishTime = Date.now() + wallTimeSec * 1000;
                setOutpostBuildQueue(prev => [...prev, { outpostId: op.id, action: 'wall', finishTime, targetLevel: newWallLevel, newGarrison }]);
                // Persist to build_queue table
                if (user) {
                  supabase.from('build_queue').insert({ user_id: user.id, building_id: op.id, building_type: 'outpost_wall', target_level: newWallLevel, finish_time: new Date(finishTime).toISOString() } as any).then();
                }
                toast(`🧱 ${op.has_wall ? 'Upgrading wall' : 'Building wall'} at ${op.name}... (${Math.floor(wallTimeSec / 60)}:${(wallTimeSec % 60).toString().padStart(2, '0')})`);
              };


              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{isSettlement ? '🏘️' : (op.outpost_type === 'fort' ? '🏰' : (isOwn ? '🏕️' : '⚑'))}</span>
                    <div className="flex-1">
                      <h3 className="font-display text-sm text-foreground">{op.name}</h3>
                      <div className="flex items-center gap-2 text-[9px]">
                        <span className="text-primary font-semibold">Lv.{op.level}</span>
                        <span className="text-muted-foreground">⚔️{op.garrison_power} defense</span>
                        {op.has_wall && <span className="text-accent-foreground bg-accent/20 px-1.5 rounded-full">🧱 Wall Lv.{op.wall_level}</span>}
                        {isSettlement && <span className="text-primary bg-primary/10 px-1.5 rounded-full">Settlement</span>}
                        {op.outpost_type === 'fort' && <span className="text-accent-foreground bg-accent/20 px-1.5 rounded-full">🏰 Fort</span>}
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {isOwn
                      ? (isSettlement
                        ? 'Your settlement. Switch to it from the resource bar to manage buildings and resources independently.'
                        : op.outpost_type === 'fort'
                          ? 'Your fort. Can garrison armies. Upgrade to Lv.10 to convert into a full settlement.'
                          : 'Your outpost. Upgrade to Lv.5 to convert into a fort, then Lv.10 for a settlement.')
                      : `Enemy ${isSettlement ? 'settlement' : op.outpost_type === 'fort' ? 'fort' : 'outpost'}. Garrison strength: ⚔️${op.garrison_power}${op.has_wall ? ` with Lv.${op.wall_level} walls` : ''}`}
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
                      {/* Border Wall */}
                      <div className="bg-muted/30 rounded-lg p-2 space-y-1">
                        <p className="text-[10px] font-semibold text-foreground">🧱 {op.has_wall ? `Upgrade Wall to Lv.${op.wall_level + 1}` : 'Build Border Wall'}</p>
                        <p className="text-[8px] text-muted-foreground">{op.has_wall ? '+30 garrison, stronger border' : 'Creates visible territory border, +30 garrison defense'}</p>
                        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                          <span className={resources.gold >= wallCost.gold ? '' : 'text-destructive'}>🪙{wallCost.gold}</span>
                          <span className={resources.wood >= wallCost.wood ? '' : 'text-destructive'}>🪵{wallCost.wood}</span>
                          <span className={resources.stone >= wallCost.stone ? '' : 'text-destructive'}>🪨{wallCost.stone}</span>
                          {wallCost.food > 0 && <span className={resources.food >= wallCost.food ? '' : 'text-destructive'}>🌾{wallCost.food}</span>}
                        </div>
                        {isBuildingWall ? (
                          <div className="w-full bg-muted rounded-lg py-2 text-center space-y-1">
                            <p className="font-display text-[11px] text-accent-foreground">⏳ Building wall...</p>
                            <div className="bg-background rounded-full h-1.5 mx-2 overflow-hidden">
                              <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${Math.max(0, 100 - ((isBuildingWall.finishTime - Date.now()) / (wallTimeSec * 1000)) * 100)}%` }} />
                            </div>
                            <p className="text-[9px] text-muted-foreground">{Math.max(0, Math.ceil((isBuildingWall.finishTime - Date.now()) / 1000))}s remaining</p>
                          </div>
                        ) : (
                          <motion.button whileTap={{ scale: 0.95 }} onClick={handleWall} disabled={!canAffordWall}
                            className="w-full bg-accent text-accent-foreground font-display text-[11px] py-2 rounded-lg disabled:opacity-40 active:scale-95 transition-transform">
                            🧱 {op.has_wall ? 'Upgrade Wall' : 'Build Border Wall'} ({Math.floor(wallTimeSec / 60)}:{(wallTimeSec % 60).toString().padStart(2, '0')})
                          </motion.button>
                        )}
                      </div>
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
                              });
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
                          setOutposts(prev => [...prev, { id: data.id, x: data.x, y: data.y, name: data.name, user_id: user!.id, level: 1, garrison_power: 0, has_wall: false, wall_level: 0, territory_radius: 15000, outpost_type: 'outpost' }]);
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
