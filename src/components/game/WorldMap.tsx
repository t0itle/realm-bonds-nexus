import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame, TroopType, Resources, calcMarchTime, getMaxRange, Building, BUILDING_INFO } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import NPCInteractionPanel from './NPCInteractionPanel';

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

  // 1-4 events per chunk — use time-based seed rotation so events change periodically
  const timeSeed = Math.floor(Date.now() / (1000 * 60 * 30)); // rotates every 30 minutes
  const eventRng = seededRandom(hashCoords(chunkX, chunkY, timeSeed + 99));
  const eventCount = 1 + Math.floor(eventRng() * 4);
  const events: ProceduralEvent[] = [];
  for (let i = 0; i < eventCount; i++) {
    const baseIdx = Math.floor(eventRng() * EVENT_BASES.length);
    const base = EVENT_BASES[baseIdx];
    const nameIdx = Math.floor(eventRng() * base.names.length);
    const descIdx = Math.floor(eventRng() * base.descs.length);
    // Optionally add an adjective or location for extra variety
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
      x: worldBaseX + 2000 + eventRng() * (CHUNK_SIZE - 4000),
      y: worldBaseY + 2000 + eventRng() * (CHUNK_SIZE - 4000),
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

  // ── Decorations (trees, grass, rocks) — scatter per biome ──
  const decorations: Decoration[] = [];
  const decoTypes: Decoration['type'][] = 
    regionBiome === 'Forest' || regionBiome === 'Jungle' ? ['trees', 'trees', 'grass', 'trees'] :
    regionBiome === 'Plains' || regionBiome === 'Steppe' ? ['grass', 'grass', 'trees', 'grass'] :
    regionBiome === 'Highlands' || regionBiome === 'Badlands' ? ['rocks', 'rocks', 'trees', 'rocks'] :
    regionBiome === 'Tundra' ? ['rocks', 'rocks', 'grass'] :
    regionBiome === 'Desert' ? ['rocks', 'rocks'] :
    ['trees', 'grass', 'rocks'];
  const decoCount = regionBiome === 'Desert' ? 3 + Math.floor(rng() * 4) : 8 + Math.floor(rng() * 10);
  for (let i = 0; i < decoCount; i++) {
    const dt = decoTypes[Math.floor(rng() * decoTypes.length)];
    decorations.push({
      type: dt,
      x: worldBaseX + 2000 + rng() * (CHUNK_SIZE - 4000),
      y: worldBaseY + 2000 + rng() * (CHUNK_SIZE - 4000),
      size: dt === 'trees' ? 3000 + rng() * 5000 : dt === 'grass' ? 4000 + rng() * 8000 : 2000 + rng() * 4000,
      rotation: rng() * 360,
      opacity: 0.3 + rng() * 0.4,
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
  | null;

export default function WorldMap() {
  const { allVillages, addResources, addSteel, army, totalArmyPower, attackTarget, attackPlayer, vassalages, buildings, displayName } = useGame();
  const { user } = useAuth();
  const [selected, setSelected] = useState<SelectedItem>(null);
  const [claimedEvents, setClaimedEvents] = useState<Set<string>>(new Set());
  const [capturedMines, setCapturedMines] = useState<Set<string>>(new Set());
  const [marches, setMarches] = useState<{ id: string; targetName: string; arrivalTime: number; startTime: number; startX: number; startY: number; targetX: number; targetY: number; action: () => void }[]>([]);
  const [tradeContracts, setTradeContracts] = useState<{ realmId: string; realmName: string; expiresAt: number; bonus: Partial<Record<string, number>> }[]>([]);
  const [legendOpen, setLegendOpen] = useState(false);
  const [, forceRender] = useState(0);
  const [npcRelations, setNpcRelations] = useState<Map<string, { realmId: string; status: 'neutral' | 'friendly' | 'vassal' | 'allied'; tributeRate: number; friendshipLevel: number }>>(new Map());

  // Get TH level for dynamic sprite
  const townhallLevel = buildings.find(b => b.type === 'townhall')?.level || 1;
  const getSettlementSprite = (thLevel: number, isMe: boolean) => {
    if (thLevel >= 7) return isMe ? mapCastleFriendly : mapCastleNeutral;
    if (thLevel >= 5) return mapCastleNeutral;
    return mapVillage;
  };

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
    // Use golden-ratio-based spiral placement for even distribution
    // Each player gets a unique angle/radius combo to avoid clustering
    const angle = (h % 10000) / 10000 * Math.PI * 2;
    const radius = 5000 + (h2 % 35000); // 5k-40k from center
    return {
      x: 100000 + Math.cos(angle) * radius,
      y: 100000 + Math.sin(angle) * radius,
    };
  };

  const goHome = useCallback(() => {
    setCamera({ cx: 100000, cy: 100000, ppu: 0.003 });
  }, []);

  const getMyPos = useCallback(() => {
    if (!user) return { x: 100000, y: 100000 };
    const myVillage = allVillages.find(v => v.village.user_id === user.id);
    return getPlayerPos(myVillage?.village.id || 'me');
  }, [user, allVillages]);

  // Helper to create a march with position data
  const createMarch = useCallback((id: string, targetName: string, targetX: number, targetY: number, travelSec: number, action: () => void) => {
    const myPos = getMyPos();
    const now = Date.now();
    setMarches(prev => [...prev, {
      id, targetName, arrivalTime: now + travelSec * 1000,
      startTime: now, startX: myPos.x, startY: myPos.y,
      targetX, targetY, action,
    }]);
  }, [getMyPos]);

  const getDistance = useCallback((targetX: number, targetY: number) => {
    const myPos = getMyPos();
    return Math.sqrt(Math.pow(targetX - myPos.x, 2) + Math.pow(targetY - myPos.y, 2));
  }, [getMyPos]);

  const calcTravelTime = useCallback((targetX: number, targetY: number) => {
    const dist = getDistance(targetX, targetY);
    return calcMarchTime(dist, army);
  }, [getDistance, army]);

  const isInRange = useCallback((targetX: number, targetY: number) => {
    const dist = getDistance(targetX, targetY);
    return dist <= getMaxRange(army);
  }, [getDistance, army]);

  const handleInvestigate = useCallback((event: ProceduralEvent) => {
    if (claimedEvents.has(event.id)) return;
    if (!isInRange(event.x, event.y)) { toast.error('Too far! Train scouts to extend your range.'); return; }
    const hasTroops = Object.values(army).some(v => v > 0);
    if (event.power > 0 && !hasTroops) { toast.error('You need troops to investigate dangerous events!'); return; }
    const travelSec = calcTravelTime(event.x, event.y);
    if (event.power > 0) {
      const eventData = event;
      toast(`⚔️ Troops marching to ${event.name}... ETA ${travelSec}s`);
      createMarch(`evt-${Date.now()}`, eventData.name, eventData.x, eventData.y, travelSec, () => {
        const log = attackTarget(eventData.name, eventData.power);
        if (log.result === 'victory') {
          addResources(eventData.reward);
          setClaimedEvents(prev => new Set(prev).add(eventData.id));
          toast.success(`Victory at ${eventData.name}! Resources gained.`);
        } else {
          toast.error(`Defeated at ${eventData.name}!`);
        }
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
  }, [army, attackTarget, addResources, claimedEvents, calcTravelTime, isInRange, createMarch]);

  const handleAttackNPC = useCallback((realm: ProceduralRealm) => {
    const hasTroops = Object.values(army).some(v => v > 0);
    if (!hasTroops) { toast.error('You need troops to attack!'); return; }
    if (!isInRange(realm.x, realm.y)) { toast.error('Out of range! Train scouts to extend reach.'); return; }
    const travelSec = calcTravelTime(realm.x, realm.y);
    toast(`⚔️ Troops marching to ${realm.name}... ETA ${travelSec}s`);
    createMarch(`atk-${Date.now()}`, realm.name, realm.x, realm.y, travelSec, () => {
      const log = attackTarget(realm.name, realm.power);
      if (log.result === 'victory') toast.success(`Victory against ${realm.name}!`);
      else toast.error(`Defeated by ${realm.name}!`);
    });
    setSelected(null);
  }, [army, attackTarget, calcTravelTime, createMarch]);

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
  const iconSize = Math.max(24, Math.min(64, camera.ppu * 8000));
  const fontSize = Math.max(9, Math.min(14, camera.ppu * 3000));
  const eventSize = Math.max(20, Math.min(48, camera.ppu * 6000));

  // Collect all visible realms and events from chunks
  const visibleRealms: (ProceduralRealm & { biome: string })[] = [];
  const visibleEvents: ProceduralEvent[] = [];
  for (const chunk of visibleChunks) {
    for (const realm of chunk.data.realms) {
      if (isVisible(realm.x, realm.y, 100)) visibleRealms.push({ ...realm, biome: chunk.data.regionBiome });
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
              onClick={(e) => { e.stopPropagation(); setSelected({ kind: 'npc', data: realm, biome: realm.biome }); }}
              className="absolute flex flex-col items-center z-10 hover:z-20"
              style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)' }}>
              <img
                src={REALM_SPRITES[realm.type]}
                alt={realm.name}
                loading="lazy"
                className="drop-shadow-lg"
                style={{ width: iconSize, height: iconSize, imageRendering: 'auto' }}
              />
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
          const evSprite = event.type === 'mystery' ? mapRuins : EVENT_SPRITES[event.type];
          return (
            <button key={event.id} data-map-item
              onClick={(e) => { e.stopPropagation(); setSelected({ kind: 'event', data: event, chunkKey: '', index: 0 }); }}
              className="absolute z-20"
              style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)' }}>
              <img
                src={evSprite}
                alt={event.name}
                loading="lazy"
                className="drop-shadow-lg"
                style={{ width: eventSize, height: eventSize, imageRendering: 'auto', objectFit: 'contain' }}
              />
              {eventSize > 24 && (
                <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-foreground/60 font-display whitespace-nowrap"
                  style={{ fontSize: Math.max(7, eventSize / 5) }}>
                  {event.emoji}
                </span>
              )}
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
            const pvThLevel = isMe ? townhallLevel : pv.village.level; // approximate TH level from village level for others
            const sprite = getSettlementSprite(pvThLevel, isMe);
            const settlementLabel = pvThLevel >= 7 ? '🏰 Castle' : pvThLevel >= 5 ? '🏘️ Town' : '🏠 Village';
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
                  style={{ width: iconSize * 1.2, height: iconSize * 1.2, imageRendering: 'auto', objectFit: 'contain' }}
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

        {/* ── Animated March Sprites ── */}
        {marches.map(march => {
          const now = Date.now();
          const totalDuration = march.arrivalTime - march.startTime;
          const elapsed = now - march.startTime;
          const progress = Math.min(1, Math.max(0, elapsed / totalDuration));
          const currentX = march.startX + (march.targetX - march.startX) * progress;
          const currentY = march.startY + (march.targetY - march.startY) * progress;
          const { sx, sy } = worldToScreen(currentX, currentY);
          const { sx: startSx, sy: startSy } = worldToScreen(march.startX, march.startY);
          const { sx: endSx, sy: endSy } = worldToScreen(march.targetX, march.targetY);
          const marchSize = Math.max(16, Math.min(36, camera.ppu * 5000));
          const remainingSec = Math.max(0, Math.ceil((march.arrivalTime - now) / 1000));
          return (
            <div key={march.id}>
              {/* Dotted march path line */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible', zIndex: 35 }}>
                <line x1={startSx} y1={startSy} x2={endSx} y2={endSy}
                  stroke="hsl(var(--primary) / 0.4)" strokeWidth={2} strokeDasharray="6 4" />
              </svg>
              {/* Moving soldier sprite */}
              <div className="absolute z-40 flex flex-col items-center pointer-events-none"
                style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)', transition: 'left 0.4s linear, top 0.4s linear' }}>
                <img src={mapSoldier} alt="Army" className="drop-shadow-lg"
                  style={{ width: marchSize, height: marchSize, objectFit: 'contain', transform: march.targetX < march.startX ? 'scaleX(-1)' : undefined }} loading="lazy" />
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

        {/* Zoom controls — larger touch targets on mobile */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-50">
          <button onClick={() => safeSetCamera(prev => ({ ...prev, ppu: Math.min(0.05, prev.ppu * 1.5) }))}
            className="w-10 h-10 sm:w-8 sm:h-8 game-panel border-glow rounded-lg flex items-center justify-center text-foreground text-base sm:text-sm font-bold active:scale-90 transition-transform">+</button>
          <button onClick={() => safeSetCamera(prev => ({ ...prev, ppu: Math.max(0.00005, prev.ppu / 1.5) }))}
            className="w-10 h-10 sm:w-8 sm:h-8 game-panel border-glow rounded-lg flex items-center justify-center text-foreground text-base sm:text-sm font-bold active:scale-90 transition-transform">−</button>
          <button onClick={goHome}
            className="w-10 h-10 sm:w-8 sm:h-8 game-panel border-glow rounded-lg flex items-center justify-center text-foreground text-sm sm:text-[9px] active:scale-90 transition-transform">⌂</button>
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
                npcRelations={npcRelations}
                setNpcRelations={setNpcRelations}
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
                            toast(`⚔️ Troops marching... ETA ${travelSec}s`);
                            createMarch(`pvp-${Date.now()}`, targetData.village.name, targetPos.x, targetPos.y, travelSec, async () => {
                              const log = await attackPlayer(targetData.village.user_id, targetData.profile.display_name, targetData.village.id);
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
                            setSelected(null);
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
                      createMarch(`mine-${Date.now()}`, mineData.name, mineData.x, mineData.y, travelSec, () => {
                        const log = attackTarget(mineData.name, mineData.power);
                        if (log.result === 'victory') {
                          setCapturedMines(prev => new Set([...prev, mineData.id]));
                          toast.success(`⚙️ ${mineData.name} captured! Producing steel.`);
                        } else {
                          toast.error('Defeat! The garrison held.');
                        }
                      });
                      setSelected(null);
                    }}
                    className="w-full bg-primary text-primary-foreground font-display text-[11px] py-2.5 rounded-lg glow-gold-sm active:scale-95 transition-transform">
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
