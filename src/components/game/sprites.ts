import townhallSprite from '@/assets/sprites/townhall.png';
import farmSprite from '@/assets/sprites/farm.png';
import lumbermillSprite from '@/assets/sprites/lumbermill.png';
import quarrySprite from '@/assets/sprites/quarry.png';
import goldmineSprite from '@/assets/sprites/goldmine.png';
import barracksSprite from '@/assets/sprites/barracks.png';
import wallSprite from '@/assets/sprites/wall.png';
import watchtowerSprite from '@/assets/sprites/watchtower.png';
import houseSprite from '@/assets/sprites/house.png';
import templeSprite from '@/assets/sprites/temple.png';
import apothecarySprite from '@/assets/sprites/apothecary.png';
import warehouseSprite from '@/assets/sprites/warehouse.png';
import spyguildSprite from '@/assets/sprites/spyguild.png';
import administratorSprite from '@/assets/sprites/administrator.png';
import workersSprite from '@/assets/sprites/workers.png';
// Camp tier sprites
import campfireSprite from '@/assets/sprites/campfire.png';
import tentSprite from '@/assets/sprites/tent.png';
import leanToSprite from '@/assets/sprites/lean-to.png';
import foragerSprite from '@/assets/sprites/forager.png';
import woodpileSprite from '@/assets/sprites/woodpile.png';
import stoneCacheSprite from '@/assets/sprites/stone-cache.png';
import lookoutSprite from '@/assets/sprites/lookout.png';
import type { BuildingType } from '@/lib/gameTypes';

export const BUILDING_SPRITES: Partial<Record<Exclude<BuildingType, 'empty'>, string>> = {
  // Camp tier
  campfire: campfireSprite,
  tent: tentSprite,
  lean_to: leanToSprite,
  forager: foragerSprite,
  woodpile: woodpileSprite,
  stone_cache: stoneCacheSprite,
  lookout: lookoutSprite,
  // Village tier
  townhall: townhallSprite,
  farm: farmSprite,
  lumbermill: lumbermillSprite,
  quarry: quarrySprite,
  goldmine: goldmineSprite,
  barracks: barracksSprite,
  wall: wallSprite,
  watchtower: watchtowerSprite,
  house: houseSprite,
  warehouse: warehouseSprite,
  // Town tier
  temple: templeSprite,
  apothecary: apothecarySprite,
  spyguild: spyguildSprite,
  administrator: administratorSprite,
};

export const WORKERS_SPRITE = workersSprite;

// Worker types mapped to which buildings they appear at
export const WORKER_FOR_BUILDING: Partial<Record<Exclude<BuildingType, 'empty'>, { name: string; clipX: number }>> = {
  farm: { name: 'Farmer', clipX: 0 },
  lumbermill: { name: 'Woodcutter', clipX: 25 },
  quarry: { name: 'Miner', clipX: 50 },
  goldmine: { name: 'Miner', clipX: 50 },
  barracks: { name: 'Soldier', clipX: 75 },
  forager: { name: 'Gatherer', clipX: 0 },
  woodpile: { name: 'Woodcutter', clipX: 25 },
  stone_cache: { name: 'Miner', clipX: 50 },
};
