import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export interface Building {
  id: string;
  type: BuildingType;
  level: number;
  position: number;
  upgrading: boolean;
  upgradeEndTime?: number;
}

export type BuildingType = 'townhall' | 'farm' | 'lumbermill' | 'quarry' | 'goldmine' | 'barracks' | 'wall' | 'watchtower' | 'empty';

export interface Resources {
  gold: number;
  wood: number;
  stone: number;
  food: number;
}

export interface BuildingInfo {
  name: string;
  icon: string;
  description: string;
  baseCost: Resources;
  baseProduction?: Partial<Resources>;
  maxLevel: number;
}

export const BUILDING_INFO: Record<Exclude<BuildingType, 'empty'>, BuildingInfo> = {
  townhall: {
    name: 'Town Hall',
    icon: '🏰',
    description: 'The heart of your village. Upgrade to unlock new buildings and expand your territory.',
    baseCost: { gold: 100, wood: 50, stone: 50, food: 0 },
    maxLevel: 10,
  },
  farm: {
    name: 'Farm',
    icon: '🌾',
    description: 'Produces food to sustain your growing population and army.',
    baseCost: { gold: 30, wood: 40, stone: 10, food: 0 },
    baseProduction: { food: 5 },
    maxLevel: 10,
  },
  lumbermill: {
    name: 'Lumber Mill',
    icon: '🪓',
    description: 'Harvests wood from the surrounding forests.',
    baseCost: { gold: 30, wood: 10, stone: 20, food: 0 },
    baseProduction: { wood: 5 },
    maxLevel: 10,
  },
  quarry: {
    name: 'Quarry',
    icon: '⛏️',
    description: 'Mines stone from the nearby mountains.',
    baseCost: { gold: 40, wood: 20, stone: 10, food: 0 },
    baseProduction: { stone: 4 },
    maxLevel: 10,
  },
  goldmine: {
    name: 'Gold Mine',
    icon: '💰',
    description: 'Extracts precious gold from deep within the earth.',
    baseCost: { gold: 10, wood: 30, stone: 40, food: 0 },
    baseProduction: { gold: 3 },
    maxLevel: 10,
  },
  barracks: {
    name: 'Barracks',
    icon: '⚔️',
    description: 'Train warriors to defend your village and conquer your enemies.',
    baseCost: { gold: 80, wood: 60, stone: 40, food: 20 },
    maxLevel: 8,
  },
  wall: {
    name: 'Wall',
    icon: '🧱',
    description: 'Fortify your village against invaders.',
    baseCost: { gold: 20, wood: 10, stone: 60, food: 0 },
    maxLevel: 10,
  },
  watchtower: {
    name: 'Watchtower',
    icon: '🗼',
    description: 'Spots incoming threats from afar, giving you time to prepare.',
    baseCost: { gold: 50, wood: 40, stone: 30, food: 0 },
    maxLevel: 5,
  },
};

export function getUpgradeCost(type: Exclude<BuildingType, 'empty'>, level: number): Resources {
  const info = BUILDING_INFO[type];
  const mult = Math.pow(1.5, level);
  return {
    gold: Math.floor(info.baseCost.gold * mult),
    wood: Math.floor(info.baseCost.wood * mult),
    stone: Math.floor(info.baseCost.stone * mult),
    food: Math.floor(info.baseCost.food * mult),
  };
}

export function getProduction(type: Exclude<BuildingType, 'empty'>, level: number): Partial<Resources> {
  const info = BUILDING_INFO[type];
  if (!info.baseProduction) return {};
  const result: Partial<Resources> = {};
  for (const [key, val] of Object.entries(info.baseProduction)) {
    result[key as keyof Resources] = Math.floor(val * level * 1.2);
  }
  return result;
}

interface GameState {
  resources: Resources;
  buildings: Building[];
  villageName: string;
  playerLevel: number;
}

interface GameContextType extends GameState {
  buildAt: (position: number, type: Exclude<BuildingType, 'empty'>) => boolean;
  upgradeBuilding: (id: string) => boolean;
  canAfford: (cost: Resources) => boolean;
  totalProduction: Resources;
}

const GameContext = createContext<GameContextType | null>(null);

const INITIAL_BUILDINGS: Building[] = [
  { id: '1', type: 'townhall', level: 1, position: 4, upgrading: false },
  { id: '2', type: 'farm', level: 1, position: 7, upgrading: false },
  { id: '3', type: 'lumbermill', level: 1, position: 3, upgrading: false },
];

export function GameProvider({ children }: { children: ReactNode }) {
  const [resources, setResources] = useState<Resources>({ gold: 500, wood: 300, stone: 200, food: 150 });
  const [buildings, setBuildings] = useState<Building[]>(INITIAL_BUILDINGS);
  const [villageName] = useState('Shadowmere');
  const [playerLevel] = useState(1);

  const canAfford = useCallback((cost: Resources) => {
    return resources.gold >= cost.gold && resources.wood >= cost.wood && resources.stone >= cost.stone && resources.food >= cost.food;
  }, [resources]);

  const totalProduction = buildings.reduce<Resources>(
    (acc, b) => {
      if (b.type === 'empty') return acc;
      const prod = getProduction(b.type, b.level);
      return {
        gold: acc.gold + (prod.gold || 0),
        wood: acc.wood + (prod.wood || 0),
        stone: acc.stone + (prod.stone || 0),
        food: acc.food + (prod.food || 0),
      };
    },
    { gold: 0, wood: 0, stone: 0, food: 0 }
  );

  // Resource tick every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setResources(prev => ({
        gold: prev.gold + Math.max(1, Math.floor(totalProduction.gold / 20)),
        wood: prev.wood + Math.max(1, Math.floor(totalProduction.wood / 20)),
        stone: prev.stone + Math.max(1, Math.floor(totalProduction.stone / 20)),
        food: prev.food + Math.max(1, Math.floor(totalProduction.food / 20)),
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, [totalProduction]);

  const buildAt = useCallback((position: number, type: Exclude<BuildingType, 'empty'>) => {
    const cost = getUpgradeCost(type, 0);
    if (!canAfford(cost)) return false;
    setResources(prev => ({
      gold: prev.gold - cost.gold,
      wood: prev.wood - cost.wood,
      stone: prev.stone - cost.stone,
      food: prev.food - cost.food,
    }));
    setBuildings(prev => [...prev, {
      id: Date.now().toString(),
      type,
      level: 1,
      position,
      upgrading: false,
    }]);
    return true;
  }, [canAfford]);

  const upgradeBuilding = useCallback((id: string) => {
    const building = buildings.find(b => b.id === id);
    if (!building || building.type === 'empty') return false;
    const info = BUILDING_INFO[building.type];
    if (building.level >= info.maxLevel) return false;
    const cost = getUpgradeCost(building.type, building.level);
    if (!canAfford(cost)) return false;
    setResources(prev => ({
      gold: prev.gold - cost.gold,
      wood: prev.wood - cost.wood,
      stone: prev.stone - cost.stone,
      food: prev.food - cost.food,
    }));
    setBuildings(prev => prev.map(b => b.id === id ? { ...b, level: b.level + 1 } : b));
    return true;
  }, [buildings, canAfford]);

  return (
    <GameContext.Provider value={{ resources, buildings, villageName, playerLevel, buildAt, upgradeBuilding, canAfford, totalProduction }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
