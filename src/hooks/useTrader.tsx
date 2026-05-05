import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Realm {
  id: string;
  slug: string;
  name: string;
  epithet: string;
  aether: string;
  culture: string;
  ruler_title: string;
  ruler_name: string;
  capital_x: number;
  capital_y: number;
  color: string;
  sigil: string;
  lore: string;
  arc_index: number;
  is_central: boolean;
}

export interface RealmTown {
  id: string;
  realm_id: string;
  name: string;
  town_type: 'capital' | 'city' | 'town' | 'village' | 'outpost';
  x: number;
  y: number;
  population: number;
  description: string | null;
}

export interface Good {
  id: string;
  slug: string;
  name: string;
  category: 'staple' | 'luxury' | 'exotic' | 'contraband' | 'ritual';
  rarity: number;
  base_price: number;
  weight: number;
  origin_realm_id: string | null;
  icon: string;
  description: string;
}

export interface MarketEntry {
  id: string;
  town_id: string;
  good_id: string;
  buy_price: number;   // town pays this when player sells to it
  sell_price: number;  // town charges this when player buys from it
  stock: number;
  demand: number;
}

export interface InventoryEntry {
  id: string;
  good_id: string;
  quantity: number;
  avg_cost: number;
}

export interface TraderProfile {
  id: string;
  user_id: string;
  trader_name: string;
  home_realm_id: string | null;
  current_town_id: string | null;
  tier: 'caravaneer' | 'merchant' | 'tradehouse' | 'magnate';
  gold: number;
  cart_capacity: number;
  caravan_slots: number;
  guild_standing: number;
  total_profit: number;
  trades_completed: number;
}

interface TraderContextValue {
  loading: boolean;
  profile: TraderProfile | null;
  realms: Realm[];
  towns: RealmTown[];
  goods: Good[];
  inventory: InventoryEntry[];
  refresh: () => Promise<void>;
  carriedWeight: number;
  goodById: (id: string) => Good | undefined;
  realmById: (id: string) => Realm | undefined;
  townById: (id: string) => RealmTown | undefined;
  travelTo: (townId: string) => Promise<void>;
  buyGood: (market: MarketEntry, qty: number) => Promise<{ ok: boolean; err?: string }>;
  sellGood: (market: MarketEntry, qty: number) => Promise<{ ok: boolean; err?: string }>;
  setHomeRealm: (realmId: string) => Promise<void>;
}

const TraderContext = createContext<TraderContextValue | null>(null);

export function TraderProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<TraderProfile | null>(null);
  const [realms, setRealms] = useState<Realm[]>([]);
  const [towns, setTowns] = useState<RealmTown[]>([]);
  const [goods, setGoods] = useState<Good[]>([]);
  const [inventory, setInventory] = useState<InventoryEntry[]>([]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [pRes, rRes, tRes, gRes, iRes] = await Promise.all([
      supabase.from('trader_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('realms').select('*').order('arc_index'),
      supabase.from('realm_towns').select('*'),
      supabase.from('goods').select('*'),
      supabase.from('trader_inventory').select('*').eq('user_id', user.id),
    ]);
    if (pRes.data) setProfile(pRes.data as TraderProfile);
    if (rRes.data) setRealms(rRes.data as Realm[]);
    if (tRes.data) setTowns(tRes.data as RealmTown[]);
    if (gRes.data) setGoods(gRes.data as Good[]);
    setInventory((iRes.data || []) as InventoryEntry[]);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [user, refresh]);

  const goodMap = useMemo(() => new Map(goods.map(g => [g.id, g])), [goods]);
  const realmMap = useMemo(() => new Map(realms.map(r => [r.id, r])), [realms]);
  const townMap = useMemo(() => new Map(towns.map(t => [t.id, t])), [towns]);

  const carriedWeight = useMemo(
    () => inventory.reduce((sum, inv) => sum + inv.quantity * (goodMap.get(inv.good_id)?.weight || 1), 0),
    [inventory, goodMap],
  );

  const travelTo = useCallback(async (townId: string) => {
    if (!user || !profile) return;
    setProfile({ ...profile, current_town_id: townId });
    await supabase.from('trader_profiles').update({ current_town_id: townId }).eq('user_id', user.id);
  }, [user, profile]);

  const setHomeRealm = useCallback(async (realmId: string) => {
    if (!user || !profile) return;
    setProfile({ ...profile, home_realm_id: realmId });
    await supabase.from('trader_profiles').update({ home_realm_id: realmId }).eq('user_id', user.id);
  }, [user, profile]);

  const buyGood = useCallback(async (market: MarketEntry, qty: number) => {
    if (!user || !profile) return { ok: false, err: 'Not signed in' };
    if (qty <= 0) return { ok: false, err: 'Invalid quantity' };
    if (qty > market.stock) return { ok: false, err: 'Not enough stock' };
    const cost = market.sell_price * qty;
    if (profile.gold < cost) return { ok: false, err: 'Not enough gold' };
    const good = goodMap.get(market.good_id);
    if (!good) return { ok: false, err: 'Unknown good' };
    const addedWeight = qty * good.weight;
    if (carriedWeight + addedWeight > profile.cart_capacity) {
      return { ok: false, err: `Cart full (${carriedWeight}/${profile.cart_capacity})` };
    }

    // Update gold
    const newGold = profile.gold - cost;
    await supabase.from('trader_profiles').update({ gold: newGold }).eq('user_id', user.id);

    // Upsert inventory
    const existing = inventory.find(i => i.good_id === market.good_id);
    if (existing) {
      const newQty = existing.quantity + qty;
      const newAvg = Math.round((existing.avg_cost * existing.quantity + cost) / newQty);
      await supabase.from('trader_inventory').update({ quantity: newQty, avg_cost: newAvg }).eq('id', existing.id);
    } else {
      await supabase.from('trader_inventory').insert({
        user_id: user.id,
        good_id: market.good_id,
        quantity: qty,
        avg_cost: market.sell_price,
      });
    }

    // Decrement market stock
    await supabase.from('town_market').update({ stock: market.stock - qty }).eq('id', market.id);
    await refresh();
    return { ok: true };
  }, [user, profile, goodMap, carriedWeight, inventory, refresh]);

  const sellGood = useCallback(async (market: MarketEntry, qty: number) => {
    if (!user || !profile) return { ok: false, err: 'Not signed in' };
    if (qty <= 0) return { ok: false, err: 'Invalid quantity' };
    const inv = inventory.find(i => i.good_id === market.good_id);
    if (!inv || inv.quantity < qty) return { ok: false, err: 'Not enough in inventory' };
    const earned = market.buy_price * qty;
    const profit = earned - inv.avg_cost * qty;

    const newGold = profile.gold + earned;
    const newProfit = profile.total_profit + (profit > 0 ? profit : 0);
    const newTrades = profile.trades_completed + 1;
    await supabase.from('trader_profiles')
      .update({ gold: newGold, total_profit: newProfit, trades_completed: newTrades })
      .eq('user_id', user.id);

    if (inv.quantity === qty) {
      await supabase.from('trader_inventory').delete().eq('id', inv.id);
    } else {
      await supabase.from('trader_inventory').update({ quantity: inv.quantity - qty }).eq('id', inv.id);
    }

    await supabase.from('town_market').update({ stock: market.stock + qty }).eq('id', market.id);

    // Reputation +1 with town's realm if profit positive
    if (profit > 0) {
      const town = townMap.get(market.town_id);
      if (town) {
        const { data: existingRep } = await supabase
          .from('realm_reputation').select('*').eq('user_id', user.id).eq('realm_id', town.realm_id).maybeSingle();
        if (existingRep) {
          await supabase.from('realm_reputation')
            .update({ reputation: existingRep.reputation + 1, trades_in_realm: existingRep.trades_in_realm + 1 })
            .eq('id', existingRep.id);
        } else {
          await supabase.from('realm_reputation').insert({
            user_id: user.id, realm_id: town.realm_id, reputation: 1, trades_in_realm: 1,
          });
        }
      }
    }

    await refresh();
    return { ok: true };
  }, [user, profile, inventory, townMap, refresh]);

  const value: TraderContextValue = {
    loading,
    profile,
    realms,
    towns,
    goods,
    inventory,
    refresh,
    carriedWeight,
    goodById: (id) => goodMap.get(id),
    realmById: (id) => realmMap.get(id),
    townById: (id) => townMap.get(id),
    travelTo,
    buyGood,
    sellGood,
    setHomeRealm,
  };

  return <TraderContext.Provider value={value}>{children}</TraderContext.Provider>;
}

export function useTrader() {
  const ctx = useContext(TraderContext);
  if (!ctx) throw new Error('useTrader must be used within TraderProvider');
  return ctx;
}