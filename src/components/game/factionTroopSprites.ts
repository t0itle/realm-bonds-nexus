// Viking faction troop sprites
import vikingMilitia from '@/assets/sprites/factions/viking/militia.png';
import vikingArcher from '@/assets/sprites/factions/viking/archer.png';
import vikingKnight from '@/assets/sprites/factions/viking/knight.png';
import vikingCavalry from '@/assets/sprites/factions/viking/cavalry.png';
import vikingSiege from '@/assets/sprites/factions/viking/siege.png';
import vikingScout from '@/assets/sprites/factions/viking/scout.png';

// Samurai faction troop sprites
import samuraiMilitia from '@/assets/sprites/factions/samurai/militia.png';
import samuraiArcher from '@/assets/sprites/factions/samurai/archer.png';
import samuraiKnight from '@/assets/sprites/factions/samurai/knight.png';
import samuraiCavalry from '@/assets/sprites/factions/samurai/cavalry.png';
import samuraiSiege from '@/assets/sprites/factions/samurai/siege.png';
import samuraiScout from '@/assets/sprites/factions/samurai/scout.png';

// Roman faction troop sprites
import romanMilitia from '@/assets/sprites/factions/roman/militia.png';
import romanArcher from '@/assets/sprites/factions/roman/archer.png';
import romanKnight from '@/assets/sprites/factions/roman/knight.png';
import romanCavalry from '@/assets/sprites/factions/roman/cavalry.png';
import romanSiege from '@/assets/sprites/factions/roman/siege.png';
import romanScout from '@/assets/sprites/factions/roman/scout.png';

import type { TroopType } from '@/lib/gameTypes';

type TroopSpriteMap = Record<TroopType, string>;

export const FACTION_TROOP_SPRITES: Record<string, TroopSpriteMap> = {
  viking: {
    militia: vikingMilitia,
    archer: vikingArcher,
    knight: vikingKnight,
    cavalry: vikingCavalry,
    siege: vikingSiege,
    scout: vikingScout,
  },
  samurai: {
    militia: samuraiMilitia,
    archer: samuraiArcher,
    knight: samuraiKnight,
    cavalry: samuraiCavalry,
    siege: samuraiSiege,
    scout: samuraiScout,
  },
  roman: {
    militia: romanMilitia,
    archer: romanArcher,
    knight: romanKnight,
    cavalry: romanCavalry,
    siege: romanSiege,
    scout: romanScout,
  },
};
