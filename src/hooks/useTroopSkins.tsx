import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { TroopType, BuildingType } from './useGameState';
import { toast } from 'sonner';
import { BUILDING_SPRITES } from '@/components/game/sprites';
import { FACTION_BUILDING_SPRITES } from '@/components/game/factionSprites';

export interface FactionSkin {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number;
  /** Optional accent color for UI tinting */
  accentHue: number;
  troops: Record<TroopType, { name: string; emoji: string }>;
}

export const FACTION_SKINS: FactionSkin[] = [
  {
    id: 'default',
    name: 'Kingdom',
    description: 'Standard kingdom troops and buildings.',
    icon: '🏰',
    cost: 0,
    accentHue: 0,
    troops: {
      militia: { name: 'Militia', emoji: '🗡️' },
      archer: { name: 'Archer', emoji: '🏹' },
      knight: { name: 'Knight', emoji: '🛡️' },
      cavalry: { name: 'Cavalry', emoji: '🐴' },
      siege: { name: 'Siege Ram', emoji: '🏗️' },
      scout: { name: 'Scout', emoji: '🏃' },
    },
  },
  {
    id: 'viking',
    name: 'Viking Horde',
    description: 'Cold northern aesthetic with longhouses and Norse architecture.',
    icon: '🪓',
    cost: 2000,
    accentHue: 190,
    troops: {
      militia: { name: 'Berserker', emoji: '🪓' },
      archer: { name: 'Bowman', emoji: '🎯' },
      knight: { name: 'Huscarl', emoji: '⚔️' },
      cavalry: { name: 'Raider', emoji: '🐎' },
      siege: { name: 'Battering Ram', emoji: '🔨' },
      scout: { name: 'Pathfinder', emoji: '🧭' },
    },
  },
  {
    id: 'samurai',
    name: 'Shogunate',
    description: 'Elegant Japanese architecture with pagodas and dojos.',
    icon: '⛩️',
    cost: 3000,
    accentHue: 320,
    troops: {
      militia: { name: 'Ashigaru', emoji: '🥷' },
      archer: { name: 'Yumi Archer', emoji: '🏹' },
      knight: { name: 'Samurai', emoji: '⛩️' },
      cavalry: { name: 'Mounted Samurai', emoji: '🐴' },
      siege: { name: 'Onager', emoji: '💥' },
      scout: { name: 'Shinobi', emoji: '🌙' },
    },
  },
  {
    id: 'undead',
    name: 'Undead Legion',
    description: 'Dark necromantic buildings with eerie green glow.',
    icon: '💀',
    cost: 4000,
    accentHue: 100,
    troops: {
      militia: { name: 'Skeleton', emoji: '💀' },
      archer: { name: 'Bone Archer', emoji: '☠️' },
      knight: { name: 'Death Knight', emoji: '⚰️' },
      cavalry: { name: 'Nightmare Rider', emoji: '🦇' },
      siege: { name: 'Bone Colossus', emoji: '🪦' },
      scout: { name: 'Wraith', emoji: '👻' },
    },
  },
  {
    id: 'roman',
    name: 'Imperial Legion',
    description: 'Grand Roman architecture with marble columns and red banners.',
    icon: '🦅',
    cost: 2500,
    accentHue: 40,
    troops: {
      militia: { name: 'Legionary', emoji: '🏛️' },
      archer: { name: 'Velite', emoji: '🎯' },
      knight: { name: 'Centurion', emoji: '🦅' },
      cavalry: { name: 'Equite', emoji: '🐎' },
      siege: { name: 'Ballista', emoji: '⚡' },
      scout: { name: 'Explorator', emoji: '👁️' },
    },
  },
];

interface TroopSkinContextType {
  activeSkin: FactionSkin;
  ownedSkins: string[];
  purchaseSkin: (skinId: string) => Promise<boolean>;
  setActiveSkin: (skinId: string) => Promise<void>;
  getTroopDisplay: (type: TroopType) => { name: string; emoji: string };
  getBuildingSprite: (type: Exclude<BuildingType, 'empty'>) => string;
  /** CSS filter string for tinting map sprites (army, outposts) to match faction */
  getSpriteFilter: () => string | undefined;
  loading: boolean;
}

const TroopSkinContext = createContext<TroopSkinContextType | null>(null);

export function TroopSkinProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [ownedSkins, setOwnedSkins] = useState<string[]>(['default']);
  const [activeSkinId, setActiveSkinId] = useState('default');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase.from('player_skins').select('*').eq('user_id', user.id).then(({ data }) => {
      if (data && data.length > 0) {
        setOwnedSkins(['default', ...data.map((s: any) => s.skin_id)]);
        const active = data.find((s: any) => s.is_active);
        if (active) setActiveSkinId(active.skin_id);
      }
      setLoading(false);
    });
  }, [user]);

  const activeSkin = FACTION_SKINS.find(s => s.id === activeSkinId) || FACTION_SKINS[0];

  const purchaseSkin = useCallback(async (skinId: string): Promise<boolean> => {
    if (!user) return false;
    if (ownedSkins.includes(skinId)) { toast.error('Already owned!'); return false; }
    const skin = FACTION_SKINS.find(s => s.id === skinId);
    if (!skin) return false;

    const { data: village } = await supabase
      .from('villages')
      .select('gold')
      .eq('user_id', user.id)
      .limit(1)
      .single();
    if (!village || village.gold < skin.cost) {
      toast.error(`Not enough gold! Need ${skin.cost} 🪙`);
      return false;
    }

    await supabase.from('villages').update({ gold: village.gold - skin.cost } as any).eq('user_id', user.id).limit(1);

    const { error } = await supabase.from('player_skins').insert({
      user_id: user.id, skin_id: skinId, is_active: false,
    } as any);
    if (error) { toast.error('Failed to purchase skin'); return false; }

    setOwnedSkins(prev => [...prev, skinId]);
    toast.success(`🎨 Purchased ${skin.name} skin pack!`);
    return true;
  }, [user, ownedSkins]);

  const setActiveSkinFn = useCallback(async (skinId: string) => {
    if (!user) return;
    if (!ownedSkins.includes(skinId)) return;

    await supabase.from('player_skins').update({ is_active: false } as any).eq('user_id', user.id);
    if (skinId !== 'default') {
      await supabase.from('player_skins').update({ is_active: true } as any).eq('user_id', user.id).eq('skin_id', skinId);
    }
    setActiveSkinId(skinId);
    const skin = FACTION_SKINS.find(s => s.id === skinId);
    toast.success(`⚔️ Equipped ${skin?.name || 'Default'} faction skin!`);
  }, [user, ownedSkins]);

  const getTroopDisplay = useCallback((type: TroopType) => {
    return activeSkin.troops[type];
  }, [activeSkin]);

  const getBuildingSprite = useCallback((type: Exclude<BuildingType, 'empty'>): string => {
    const skinId = activeSkin.id;
    if (skinId !== 'default' && FACTION_BUILDING_SPRITES[skinId]) {
      return FACTION_BUILDING_SPRITES[skinId][type] || BUILDING_SPRITES[type];
    }
    return BUILDING_SPRITES[type];
  }, [activeSkin]);

  const FACTION_FILTERS: Record<string, string> = {
    viking: 'hue-rotate(190deg) saturate(1.3) brightness(0.95)',
    samurai: 'hue-rotate(320deg) saturate(1.4) brightness(1.05)',
    undead: 'hue-rotate(100deg) saturate(1.5) brightness(0.8)',
    roman: 'hue-rotate(40deg) saturate(1.2) brightness(1.1)',
  };

  const getSpriteFilter = useCallback((): string | undefined => {
    if (activeSkin.id === 'default') return undefined;
    return FACTION_FILTERS[activeSkin.id];
  }, [activeSkin]);

  return (
    <TroopSkinContext.Provider value={{ activeSkin, ownedSkins, purchaseSkin, setActiveSkin: setActiveSkinFn, getTroopDisplay, getBuildingSprite, getSpriteFilter, loading }}>
      {children}
    </TroopSkinContext.Provider>
  );
}

export function useTroopSkins() {
  const ctx = useContext(TroopSkinContext);
  if (!ctx) throw new Error('useTroopSkins must be used within TroopSkinProvider');
  return ctx;
}
