import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Building {
  id: string;
  type: BuildingType;
  level: number;
  position: number;
  village_id: string;
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
    name: 'Town Hall', icon: '🏰',
    description: 'The heart of your village. Upgrade to unlock new buildings.',
    baseCost: { gold: 100, wood: 50, stone: 50, food: 0 }, maxLevel: 10,
  },
  farm: {
    name: 'Farm', icon: '🌾',
    description: 'Produces food to sustain your population and army.',
    baseCost: { gold: 30, wood: 40, stone: 10, food: 0 },
    baseProduction: { food: 5 }, maxLevel: 10,
  },
  lumbermill: {
    name: 'Lumber Mill', icon: '🪓',
    description: 'Harvests wood from the surrounding forests.',
    baseCost: { gold: 30, wood: 10, stone: 20, food: 0 },
    baseProduction: { wood: 5 }, maxLevel: 10,
  },
  quarry: {
    name: 'Quarry', icon: '⛏️',
    description: 'Mines stone from the nearby mountains.',
    baseCost: { gold: 40, wood: 20, stone: 10, food: 0 },
    baseProduction: { stone: 4 }, maxLevel: 10,
  },
  goldmine: {
    name: 'Gold Mine', icon: '💰',
    description: 'Extracts precious gold from deep within the earth.',
    baseCost: { gold: 10, wood: 30, stone: 40, food: 0 },
    baseProduction: { gold: 3 }, maxLevel: 10,
  },
  barracks: {
    name: 'Barracks', icon: '⚔️',
    description: 'Train warriors to defend your village and conquer your enemies.',
    baseCost: { gold: 80, wood: 60, stone: 40, food: 20 }, maxLevel: 8,
  },
  wall: {
    name: 'Wall', icon: '🧱',
    description: 'Fortify your village against invaders.',
    baseCost: { gold: 20, wood: 10, stone: 60, food: 0 }, maxLevel: 10,
  },
  watchtower: {
    name: 'Watchtower', icon: '🗼',
    description: 'Spots incoming threats from afar.',
    baseCost: { gold: 50, wood: 40, stone: 30, food: 0 }, maxLevel: 5,
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

export interface Village {
  id: string;
  user_id: string;
  name: string;
  gold: number;
  wood: number;
  stone: number;
  food: number;
  level: number;
}

export interface PlayerVillage {
  village: Village;
  profile: { display_name: string; avatar_emoji: string };
}

interface GameContextType {
  resources: Resources;
  buildings: Building[];
  villageName: string;
  villageId: string | null;
  playerLevel: number;
  displayName: string;
  buildAt: (position: number, type: Exclude<BuildingType, 'empty'>) => Promise<boolean>;
  upgradeBuilding: (id: string) => Promise<boolean>;
  canAfford: (cost: Resources) => boolean;
  totalProduction: Resources;
  allVillages: PlayerVillage[];
  loading: boolean;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resources>({ gold: 0, wood: 0, stone: 0, food: 0 });
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [villageName, setVillageName] = useState('');
  const [villageId, setVillageId] = useState<string | null>(null);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [displayName, setDisplayName] = useState('Wanderer');
  const [allVillages, setAllVillages] = useState<PlayerVillage[]>([]);
  const [loading, setLoading] = useState(true);

  // Load player data
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      // Load profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (profile) setDisplayName(profile.display_name);

      // Load village
      const { data: village } = await supabase
        .from('villages')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (village) {
        setVillageId(village.id);
        setVillageName(village.name);
        setPlayerLevel(village.level);
        setResources({
          gold: Number(village.gold),
          wood: Number(village.wood),
          stone: Number(village.stone),
          food: Number(village.food),
        });

        // Load buildings
        const { data: blds } = await supabase
          .from('buildings')
          .select('*')
          .eq('village_id', village.id);
        if (blds) {
          setBuildings(blds.map(b => ({
            id: b.id,
            type: b.type as BuildingType,
            level: b.level,
            position: b.position,
            village_id: b.village_id,
          })));
        }
      }

      // Load all villages for world map
      const { data: villages } = await supabase
        .from('villages')
        .select('*, profiles!villages_user_id_fkey(display_name, avatar_emoji)')
        .limit(50);

      // The join returns profiles as an object (one-to-one via user_id)
      // We need to handle the shape properly
      if (villages) {
        const mapped: PlayerVillage[] = [];
        for (const v of villages) {
          // Get profile separately if join doesn't work
          const profileData = (v as any).profiles;
          mapped.push({
            village: {
              id: v.id,
              user_id: v.user_id,
              name: v.name,
              gold: Number(v.gold),
              wood: Number(v.wood),
              stone: Number(v.stone),
              food: Number(v.food),
              level: v.level,
            },
            profile: profileData
              ? { display_name: profileData.display_name, avatar_emoji: profileData.avatar_emoji }
              : { display_name: 'Unknown', avatar_emoji: '🛡️' },
          });
        }
        setAllVillages(mapped);
      }

      setLoading(false);
    };

    loadData();

    // Real-time subscription for own village
    const villageChannel = supabase
      .channel('village-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'villages',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const v = payload.new;
        setResources({
          gold: Number(v.gold),
          wood: Number(v.wood),
          stone: Number(v.stone),
          food: Number(v.food),
        });
        setVillageName(v.name as string);
        setPlayerLevel(v.level as number);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(villageChannel);
    };
  }, [user]);

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

  // Resource tick every 3 seconds — save to DB every 30s
  useEffect(() => {
    if (!villageId || !user) return;

    const tickInterval = setInterval(() => {
      setResources(prev => ({
        gold: prev.gold + Math.max(1, Math.floor(totalProduction.gold / 20)),
        wood: prev.wood + Math.max(1, Math.floor(totalProduction.wood / 20)),
        stone: prev.stone + Math.max(1, Math.floor(totalProduction.stone / 20)),
        food: prev.food + Math.max(1, Math.floor(totalProduction.food / 20)),
      }));
    }, 3000);

    const saveInterval = setInterval(() => {
      setResources(current => {
        supabase.from('villages').update({
          gold: current.gold,
          wood: current.wood,
          stone: current.stone,
          food: current.food,
        }).eq('id', villageId).then();
        return current;
      });
    }, 30000);

    return () => {
      clearInterval(tickInterval);
      clearInterval(saveInterval);
    };
  }, [villageId, user, totalProduction]);

  // Save on unload
  useEffect(() => {
    if (!villageId) return;
    const save = () => {
      supabase.from('villages').update({
        gold: resources.gold,
        wood: resources.wood,
        stone: resources.stone,
        food: resources.food,
      }).eq('id', villageId).then();
    };
    window.addEventListener('beforeunload', save);
    return () => window.removeEventListener('beforeunload', save);
  }, [villageId, resources]);

  const buildAt = useCallback(async (position: number, type: Exclude<BuildingType, 'empty'>) => {
    if (!villageId || !user) return false;
    const cost = getUpgradeCost(type, 0);
    if (!canAfford(cost)) return false;

    const newResources = {
      gold: resources.gold - cost.gold,
      wood: resources.wood - cost.wood,
      stone: resources.stone - cost.stone,
      food: resources.food - cost.food,
    };

    // Insert building
    const { data, error } = await supabase.from('buildings').insert({
      village_id: villageId,
      user_id: user.id,
      type,
      level: 1,
      position,
    }).select().single();

    if (error) return false;

    // Update resources in DB
    await supabase.from('villages').update(newResources).eq('id', villageId);

    setResources(newResources);
    setBuildings(prev => [...prev, {
      id: data.id,
      type: type as BuildingType,
      level: 1,
      position,
      village_id: villageId,
    }]);

    return true;
  }, [villageId, user, resources, canAfford]);

  const upgradeBuilding = useCallback(async (id: string) => {
    if (!villageId || !user) return false;
    const building = buildings.find(b => b.id === id);
    if (!building || building.type === 'empty') return false;
    const info = BUILDING_INFO[building.type];
    if (building.level >= info.maxLevel) return false;
    const cost = getUpgradeCost(building.type, building.level);
    if (!canAfford(cost)) return false;

    const newResources = {
      gold: resources.gold - cost.gold,
      wood: resources.wood - cost.wood,
      stone: resources.stone - cost.stone,
      food: resources.food - cost.food,
    };
    const newLevel = building.level + 1;

    const { error } = await supabase.from('buildings').update({ level: newLevel }).eq('id', id);
    if (error) return false;

    await supabase.from('villages').update(newResources).eq('id', villageId);

    setResources(newResources);
    setBuildings(prev => prev.map(b => b.id === id ? { ...b, level: newLevel } : b));

    return true;
  }, [buildings, villageId, user, resources, canAfford]);

  return (
    <GameContext.Provider value={{
      resources, buildings, villageName, villageId, playerLevel, displayName,
      buildAt, upgradeBuilding, canAfford, totalProduction, allVillages, loading,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
