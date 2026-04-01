// Viking faction map sprites
import vikingMapVillage from '@/assets/sprites/factions/viking/map-village.png';
import vikingMapTown from '@/assets/sprites/factions/viking/map-town.png';
import vikingMapCity from '@/assets/sprites/factions/viking/map-city.png';

// Samurai faction map sprites
import samuraiMapVillage from '@/assets/sprites/factions/samurai/map-village.png';
import samuraiMapTown from '@/assets/sprites/factions/samurai/map-town.png';
import samuraiMapCity from '@/assets/sprites/factions/samurai/map-city.png';

// Undead faction map sprites
import undeadMapVillage from '@/assets/sprites/factions/undead/map-village.png';
import undeadMapTown from '@/assets/sprites/factions/undead/map-town.png';
import undeadMapCity from '@/assets/sprites/factions/undead/map-city.png';

// Roman faction map sprites
import romanMapVillage from '@/assets/sprites/factions/roman/map-village.png';
import romanMapTown from '@/assets/sprites/factions/roman/map-town.png';
import romanMapCity from '@/assets/sprites/factions/roman/map-city.png';

type SettlementTier = 'village' | 'town' | 'city';
type TierSpriteMap = Record<SettlementTier, string>;

export const FACTION_MAP_SPRITES: Record<string, TierSpriteMap> = {
  viking: {
    village: vikingMapVillage,
    town: vikingMapTown,
    city: vikingMapCity,
  },
  samurai: {
    village: samuraiMapVillage,
    town: samuraiMapTown,
    city: samuraiMapCity,
  },
  undead: {
    village: undeadMapVillage,
    town: undeadMapTown,
    city: undeadMapCity,
  },
  roman: {
    village: romanMapVillage,
    town: romanMapTown,
    city: romanMapCity,
  },
};
