// Viking faction sprites
import vikingTownhall from '@/assets/sprites/factions/viking/townhall.png';
import vikingFarm from '@/assets/sprites/factions/viking/farm.png';
import vikingLumbermill from '@/assets/sprites/factions/viking/lumbermill.png';
import vikingQuarry from '@/assets/sprites/factions/viking/quarry.png';
import vikingGoldmine from '@/assets/sprites/factions/viking/goldmine.png';
import vikingBarracks from '@/assets/sprites/factions/viking/barracks.png';
import vikingWall from '@/assets/sprites/factions/viking/wall.png';
import vikingWatchtower from '@/assets/sprites/factions/viking/watchtower.png';
import vikingHouse from '@/assets/sprites/factions/viking/house.png';
import vikingTemple from '@/assets/sprites/factions/viking/temple.png';
import vikingApothecary from '@/assets/sprites/factions/viking/apothecary.png';
import vikingWarehouse from '@/assets/sprites/factions/viking/warehouse.png';
import vikingSpyguild from '@/assets/sprites/factions/viking/spyguild.png';

// Samurai faction sprites
import samuraiTownhall from '@/assets/sprites/factions/samurai/townhall.png';
import samuraiFarm from '@/assets/sprites/factions/samurai/farm.png';
import samuraiLumbermill from '@/assets/sprites/factions/samurai/lumbermill.png';
import samuraiQuarry from '@/assets/sprites/factions/samurai/quarry.png';
import samuraiGoldmine from '@/assets/sprites/factions/samurai/goldmine.png';
import samuraiBarracks from '@/assets/sprites/factions/samurai/barracks.png';
import samuraiWall from '@/assets/sprites/factions/samurai/wall.png';
import samuraiWatchtower from '@/assets/sprites/factions/samurai/watchtower.png';
import samuraiHouse from '@/assets/sprites/factions/samurai/house.png';
import samuraiTemple from '@/assets/sprites/factions/samurai/temple.png';
import samuraiApothecary from '@/assets/sprites/factions/samurai/apothecary.png';
import samuraiWarehouse from '@/assets/sprites/factions/samurai/warehouse.png';
import samuraiSpyguild from '@/assets/sprites/factions/samurai/spyguild.png';

// Undead faction sprites
import undeadTownhall from '@/assets/sprites/factions/undead/townhall.png';
import undeadFarm from '@/assets/sprites/factions/undead/farm.png';
import undeadLumbermill from '@/assets/sprites/factions/undead/lumbermill.png';
import undeadQuarry from '@/assets/sprites/factions/undead/quarry.png';
import undeadGoldmine from '@/assets/sprites/factions/undead/goldmine.png';
import undeadBarracks from '@/assets/sprites/factions/undead/barracks.png';
import undeadWall from '@/assets/sprites/factions/undead/wall.png';
import undeadWatchtower from '@/assets/sprites/factions/undead/watchtower.png';
import undeadHouse from '@/assets/sprites/factions/undead/house.png';
import undeadTemple from '@/assets/sprites/factions/undead/temple.png';
import undeadApothecary from '@/assets/sprites/factions/undead/apothecary.png';
import undeadWarehouse from '@/assets/sprites/factions/undead/warehouse.png';
import undeadSpyguild from '@/assets/sprites/factions/undead/spyguild.png';

// Roman faction sprites
import romanTownhall from '@/assets/sprites/factions/roman/townhall.png';
import romanFarm from '@/assets/sprites/factions/roman/farm.png';
import romanLumbermill from '@/assets/sprites/factions/roman/lumbermill.png';
import romanQuarry from '@/assets/sprites/factions/roman/quarry.png';
import romanGoldmine from '@/assets/sprites/factions/roman/goldmine.png';
import romanBarracks from '@/assets/sprites/factions/roman/barracks.png';
import romanWall from '@/assets/sprites/factions/roman/wall.png';
import romanWatchtower from '@/assets/sprites/factions/roman/watchtower.png';
import romanHouse from '@/assets/sprites/factions/roman/house.png';
import romanTemple from '@/assets/sprites/factions/roman/temple.png';
import romanApothecary from '@/assets/sprites/factions/roman/apothecary.png';
import romanWarehouse from '@/assets/sprites/factions/roman/warehouse.png';
import romanSpyguild from '@/assets/sprites/factions/roman/spyguild.png';

// Pirate faction sprites
import pirateTownhall from '@/assets/sprites/factions/pirate/townhall.png';
import pirateFarm from '@/assets/sprites/factions/pirate/farm.png';
import pirateLumbermill from '@/assets/sprites/factions/pirate/lumbermill.png';
import pirateQuarry from '@/assets/sprites/factions/pirate/quarry.png';
import pirateGoldmine from '@/assets/sprites/factions/pirate/goldmine.png';
import pirateBarracks from '@/assets/sprites/factions/pirate/barracks.png';
import pirateWall from '@/assets/sprites/factions/pirate/wall.png';
import pirateWatchtower from '@/assets/sprites/factions/pirate/watchtower.png';
import pirateHouse from '@/assets/sprites/factions/pirate/house.png';
import pirateTemple from '@/assets/sprites/factions/pirate/temple.png';
import pirateApothecary from '@/assets/sprites/factions/pirate/apothecary.png';
import pirateWarehouse from '@/assets/sprites/factions/pirate/warehouse.png';
import pirateSpyguild from '@/assets/sprites/factions/pirate/spyguild.png';

import type { BuildingType } from '@/hooks/useGameState';

type BuildingSpriteMap = Record<Exclude<BuildingType, 'empty'>, string>;

export const FACTION_BUILDING_SPRITES: Record<string, BuildingSpriteMap> = {
  viking: {
    townhall: vikingTownhall,
    farm: vikingFarm,
    lumbermill: vikingLumbermill,
    quarry: vikingQuarry,
    goldmine: vikingGoldmine,
    barracks: vikingBarracks,
    wall: vikingWall,
    watchtower: vikingWatchtower,
    house: vikingHouse,
    temple: vikingTemple,
    apothecary: vikingApothecary,
    warehouse: vikingWarehouse,
    spyguild: vikingSpyguild,
  },
  samurai: {
    townhall: samuraiTownhall,
    farm: samuraiFarm,
    lumbermill: samuraiLumbermill,
    quarry: samuraiQuarry,
    goldmine: samuraiGoldmine,
    barracks: samuraiBarracks,
    wall: samuraiWall,
    watchtower: samuraiWatchtower,
    house: samuraiHouse,
    temple: samuraiTemple,
    apothecary: samuraiApothecary,
    warehouse: samuraiWarehouse,
    spyguild: samuraiSpyguild,
  },
  undead: {
    townhall: undeadTownhall,
    farm: undeadFarm,
    lumbermill: undeadLumbermill,
    quarry: undeadQuarry,
    goldmine: undeadGoldmine,
    barracks: undeadBarracks,
    wall: undeadWall,
    watchtower: undeadWatchtower,
    house: undeadHouse,
    temple: undeadTemple,
    apothecary: undeadApothecary,
    warehouse: undeadWarehouse,
    spyguild: undeadSpyguild,
  },
  roman: {
    townhall: romanTownhall,
    farm: romanFarm,
    lumbermill: romanLumbermill,
    quarry: romanQuarry,
    goldmine: romanGoldmine,
    barracks: romanBarracks,
    wall: romanWall,
    watchtower: romanWatchtower,
    house: romanHouse,
    temple: romanTemple,
    apothecary: romanApothecary,
    warehouse: romanWarehouse,
    spyguild: romanSpyguild,
  },
  pirate: {
    townhall: pirateTownhall,
    farm: pirateFarm,
    lumbermill: pirateLumbermill,
    quarry: pirateQuarry,
    goldmine: pirateGoldmine,
    barracks: pirateBarracks,
    wall: pirateWall,
    watchtower: pirateWatchtower,
    house: pirateHouse,
    temple: pirateTemple,
    apothecary: pirateApothecary,
    warehouse: pirateWarehouse,
    spyguild: pirateSpyguild,
  },
};
