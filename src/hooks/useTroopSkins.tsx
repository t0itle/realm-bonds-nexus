import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { TroopType } from './useGameState';
import { toast } from 'sonner';

export interface FactionSkin {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number;
  /** CSS filter applied to building & troop sprites */
  spriteFilter: string;
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
    spriteFilter: 'none',
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
    description: 'Cold northern aesthetic. Buildings gain a frosty blue-steel tint.',
    icon: '🪓',
    cost: 2000,
    spriteFilter: 'hue-rotate(190deg) saturate(1.3) brightness(0.95)',
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
    description: 'Elegant eastern design. Cherry-blossom pink tint on all structures.',
    icon: '⛩️',
    cost: 3000,
    spriteFilter: 'hue-rotate(320deg) saturate(1.2) brightness(1.05)',
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
    description: 'Dark necromantic palette. Eerie green glow on all sprites.',
    icon: '💀',
    cost: 4000,
    spriteFilter: 'hue-rotate(100deg) saturate(0.6) brightness(0.75) contrast(1.3)',
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
    description: 'Warm golden Roman architecture. Gilded warmth across all buildings.',
    icon: '🦅',
    cost: 2500,
    spriteFilter: 'sepia(0.4) saturate(1.4) brightness(1.05)',
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
  getSpriteFilter: () => string;
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

  const getSpriteFilter = useCallback(() => {
    return activeSkin.spriteFilter;
  }, [activeSkin]);

  return (
    <TroopSkinContext.Provider value={{ activeSkin, ownedSkins, purchaseSkin, setActiveSkin: setActiveSkinFn, getTroopDisplay, getSpriteFilter, loading }}>
      {children}
    </TroopSkinContext.Provider>
  );
}

export function useTroopSkins() {
  const ctx = useContext(TroopSkinContext);
  if (!ctx) throw new Error('useTroopSkins must be used within TroopSkinProvider');
  return ctx;
}
