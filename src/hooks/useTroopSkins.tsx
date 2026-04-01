import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { TroopType } from './useGameState';
import { toast } from 'sonner';

export interface FactionSkin {
  id: string;
  name: string;
  description: string;
  cost: number; // gold cost
  troops: Record<TroopType, { name: string; emoji: string }>;
}

export const FACTION_SKINS: FactionSkin[] = [
  {
    id: 'default',
    name: 'Kingdom',
    description: 'Standard kingdom troops.',
    cost: 0,
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
    description: 'Norse raiders from the frozen north.',
    cost: 2000,
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
    description: 'Disciplined warriors of the east.',
    cost: 3000,
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
    description: 'Risen warriors from beyond the grave.',
    cost: 4000,
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
    description: 'The might of Rome marches forth.',
    cost: 2500,
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

    // Check gold via village
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

    // Deduct gold
    await supabase.from('villages').update({ gold: village.gold - skin.cost } as any).eq('user_id', user.id).limit(1);

    // Insert skin
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

    // Deactivate all, then activate chosen
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

  return (
    <TroopSkinContext.Provider value={{ activeSkin, ownedSkins, purchaseSkin, setActiveSkin: setActiveSkinFn, getTroopDisplay, loading }}>
      {children}
    </TroopSkinContext.Provider>
  );
}

export function useTroopSkins() {
  const ctx = useContext(TroopSkinContext);
  if (!ctx) throw new Error('useTroopSkins must be used within TroopSkinProvider');
  return ctx;
}
