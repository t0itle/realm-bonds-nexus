// Patch notes configuration — update this when pushing new versions
export const CURRENT_VERSION = '0.7.1';

export interface PatchNote {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

export const PATCH_NOTES: PatchNote[] = [
  {
    version: '0.7.1',
    date: '2026-04-01',
    title: 'Pirate Fleet & New World',
    changes: [
      '🏴‍☠️ New Pirate Fleet cosmetic skin — tropical cove buildings, cannons & skull flags',
      '⚓ Pirate troop names: Buccaneer, Gunner, Corsair, Boarder, Cannon & Lookout',
      '🌍 Exotic continents beyond the ocean — Desert, Jungle, Lava, Islands & more',
      '🌊 Rebalanced ocean size — shorter crossing to reach new lands',
      '🌉 Bridge outposts now render as wooden bridge sprites over rivers',
      '🏜️ Unique terrain & events per exotic biome (volcanoes, temples, sandstorms)',
      '🗺️ Players spread further apart for better early-game exploration',
      '🧭 Discover 7 new continents: Scorchlands, Jade Wilds, Ashforge & more',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-04-01',
    title: 'Settlements & Faction Identity',
    changes: [
      '🏘️ Village → Town → City upgrade system with huge costs',
      '🏙️ Cities unlock 25 building slots for massive expansion',
      '🎨 Faction skins now tint outposts, armies & castles on map',
      '⚔️ Army marches show faction colors while moving',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-04-01',
    title: 'Faction Skins & War Balance',
    changes: [
      '🎨 Faction skins — Viking, Samurai, Undead & Roman themes',
      '🏯 Unique building sprites per faction culture',
      '⚔️ War Log tracks all battles & outpost conflicts',
      '🛡️ Raids now capped at actual defender resources',
      '🚫 Over-recruiting prevention with queue awareness',
      '🍖 Army starvation — troops desert when food runs out',
      '⚖️ Server & client upkeep costs synced properly',
      '🗺️ Cleaner army movement on world map',
      '⛏️ Iron mine claiming fixes',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-03-31',
    title: 'Fortifications & Balance',
    changes: [
      '🧱 Build border walls at outposts to defend territory',
      '⬆️ Outpost upgrades — increase vision, garrison & territory',
      '⏱️ Building times increased 3× for strategic pacing',
      '📉 Resource production reduced 20% across the board',
      '⚒️ Steel now only from captured map mines',
      '⭐ Max-level buildings show a star badge',
      '🚶 Active march tracker on the home screen',
      '🏗️ Disabled recruit buttons now explain why',
      '📦 Warehouse building for extra storage capacity',
      '🐪 Caravan system for transferring resources',
    ],
  },
];
