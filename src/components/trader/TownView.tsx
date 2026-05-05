import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useTrader, MarketEntry } from '@/hooks/useTrader';
import { toast } from 'sonner';

const CATEGORY_TINT: Record<string, string> = {
  staple: 'text-foreground',
  luxury: 'text-primary',
  exotic: 'text-accent-foreground',
  contraband: 'text-destructive',
  ritual: 'text-[hsl(var(--food))]',
};

export default function TownView() {
  const { profile, townById, realmById, goodById, inventory, buyGood, sellGood, carriedWeight } = useTrader();
  const [market, setMarket] = useState<MarketEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');

  const town = profile?.current_town_id ? townById(profile.current_town_id) : undefined;
  const realm = town ? realmById(town.realm_id) : undefined;

  useEffect(() => {
    if (!town) return;
    setLoading(true);
    supabase.from('town_market').select('*').eq('town_id', town.id).then(({ data }) => {
      setMarket((data || []) as MarketEntry[]);
      setLoading(false);
    });
  }, [town?.id]);

  const reload = async () => {
    if (!town) return;
    const { data } = await supabase.from('town_market').select('*').eq('town_id', town.id);
    setMarket((data || []) as MarketEntry[]);
  };

  if (!town || !realm || !profile) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        Travel to a town from the map first.
      </div>
    );
  }

  const handleBuy = async (m: MarketEntry, qty: number) => {
    const res = await buyGood(m, qty);
    if (res.ok) {
      const g = goodById(m.good_id);
      toast.success(`Bought ${qty}× ${g?.name}`);
      reload();
    } else toast.error(res.err || 'Failed');
  };

  const handleSell = async (m: MarketEntry, qty: number) => {
    const res = await sellGood(m, qty);
    if (res.ok) {
      const g = goodById(m.good_id);
      toast.success(`Sold ${qty}× ${g?.name} for ${m.buy_price * qty}g`);
      reload();
    } else toast.error(res.err || 'Failed');
  };

  const buyableMarket = market.filter(m => m.stock > 0);
  const sellableMarket = market.filter(m => inventory.some(i => i.good_id === m.good_id && i.quantity > 0));

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      {/* Town header */}
      <div className="bg-card/60 border border-border/60 rounded-xl p-3">
        <div className="flex items-start gap-2">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0"
            style={{ background: `${realm.color}33`, color: realm.color }}
          >
            {realm.sigil}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-base text-foreground">{town.name}</h2>
            <p className="text-[11px] text-muted-foreground">
              {town.town_type.toUpperCase()} · {realm.name} · {realm.aether} aether
            </p>
            <p className="text-[10px] text-muted-foreground/80 mt-1 italic">{town.description || realm.lore}</p>
          </div>
        </div>
      </div>

      {/* Buy/Sell tabs */}
      <div className="flex gap-1 bg-muted/40 rounded-lg p-0.5">
        {(['buy', 'sell'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 font-display text-xs py-2 rounded-md transition-colors ${
              tab === t ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'buy' ? '⚖ Buy from town' : '🪙 Sell to town'}
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-muted-foreground text-xs py-4">Reading the ledger...</p>}

      {tab === 'buy' && (
        <div className="space-y-1.5">
          {buyableMarket.length === 0 && !loading && (
            <p className="text-center text-muted-foreground text-xs py-6">The market is empty today.</p>
          )}
          {buyableMarket.map(m => {
            const g = goodById(m.good_id);
            if (!g) return null;
            const isLocal = g.origin_realm_id === realm.id;
            const canAfford = profile.gold >= m.sell_price;
            const wtFree = profile.cart_capacity - carriedWeight >= g.weight;
            return (
              <motion.div
                key={m.id}
                whileTap={{ scale: 0.98 }}
                className="bg-card/40 border border-border/40 rounded-lg p-2 flex items-center gap-2"
              >
                <span className="text-2xl shrink-0">{g.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`font-display text-xs ${CATEGORY_TINT[g.category]}`}>{g.name}</p>
                    {isLocal && <span className="text-[8px] text-primary">LOCAL</span>}
                    {g.category === 'contraband' && <span className="text-[8px] text-destructive">CONTRABAND</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{g.description}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Stock {m.stock} · {g.weight}wt · ⭐{g.rarity}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="font-display text-sm text-primary">{m.sell_price}g</p>
                  <button
                    onClick={() => handleBuy(m, 1)}
                    disabled={!canAfford || !wtFree}
                    className="text-[10px] bg-primary/20 text-primary font-display px-2 py-1 rounded disabled:opacity-30"
                  >
                    Buy 1
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {tab === 'sell' && (
        <div className="space-y-1.5">
          {sellableMarket.length === 0 && (
            <p className="text-center text-muted-foreground text-xs py-6">
              Nothing in your cart that {town.name} buys.
            </p>
          )}
          {sellableMarket.map(m => {
            const g = goodById(m.good_id);
            const inv = inventory.find(i => i.good_id === m.good_id);
            if (!g || !inv) return null;
            const margin = m.buy_price - inv.avg_cost;
            return (
              <motion.div
                key={m.id}
                whileTap={{ scale: 0.98 }}
                className="bg-card/40 border border-border/40 rounded-lg p-2 flex items-center gap-2"
              >
                <span className="text-2xl shrink-0">{g.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`font-display text-xs ${CATEGORY_TINT[g.category]}`}>{g.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    You hold {inv.quantity} · cost {inv.avg_cost}g
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="font-display text-sm text-primary">{m.buy_price}g</p>
                  <p className={`text-[9px] font-display ${margin >= 0 ? 'text-[hsl(var(--food))]' : 'text-destructive'}`}>
                    {margin >= 0 ? '+' : ''}{margin}g
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleSell(m, 1)}
                      className="text-[10px] bg-primary/20 text-primary font-display px-2 py-0.5 rounded"
                    >
                      1
                    </button>
                    <button
                      onClick={() => handleSell(m, inv.quantity)}
                      className="text-[10px] bg-primary/30 text-primary font-display px-2 py-0.5 rounded"
                    >
                      All
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}