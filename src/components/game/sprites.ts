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
import workersSprite from '@/assets/sprites/workers.png';
import type { BuildingType } from '@/hooks/useGameState';

export const BUILDING_SPRITES: Record<Exclude<BuildingType, 'empty'>, string> = {
  townhall: townhallSprite,
  farm: farmSprite,
  lumbermill: lumbermillSprite,
  quarry: quarrySprite,
  goldmine: goldmineSprite,
  barracks: barracksSprite,
  wall: wallSprite,
  watchtower: watchtowerSprite,
  house: houseSprite,
  temple: templeSprite,
  apothecary: apothecarySprite,
  warehouse: warehouseSprite,
};

export const WORKERS_SPRITE = workersSprite;

// Worker types mapped to which buildings they appear at
export const WORKER_FOR_BUILDING: Partial<Record<Exclude<BuildingType, 'empty'>, { name: string; clipX: number }>> = {
  farm: { name: 'Farmer', clipX: 0 },
  lumbermill: { name: 'Woodcutter', clipX: 25 },
  quarry: { name: 'Miner', clipX: 50 },
  goldmine: { name: 'Miner', clipX: 50 },
  barracks: { name: 'Soldier', clipX: 75 },
};
