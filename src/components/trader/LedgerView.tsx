import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTrader } from '@/hooks/useTrader';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface RepRow { id: string; realm_id: string; reputation: number; trades_in_realm: number; }

const TIERS = [
  { tier: 'caravaneer', label: 'Caravaneer', trades: 0, profit: 0, capacity: 20, slots: 1 },
  { tier: 'merchant', label: 'Merchant', trades: 10, profit: 500, capacity: 60, slots: 2 },
  { tier: 'tradehouse', label: 'Trade House', trades: 50, profit: 5000, capacity: 200, slots: 4 },
  { tier: 'magnate', label: 'Magnate', trades: 200, profit: 50000, capacity: 600, slots: 8 },
] as const;

export default function LedgerView() {
  const { profile, realms, realmById, setHomeRealm, refresh } = useTrader();
  const { user } = useAuth();
  const [reps, setReps] = useState<RepRow[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from('realm_reputation').select('*').eq('user_id', user.id).then(({ data }) => setReps((data || []) as RepRow[]));
  }, [user, profile?.trades_completed]);

  if (!profile) return null;
  const idx = TIERS.findIndex(t => t.tier === profile.tier);
  const next = TIERS[idx + 1];
  const canPromote = !!next && profile.trades_completed >= next.trades && profile.total_profit >= next.profit;

  const promote = async () => {
    if (!next || !canPromote || !user) return;
    await supabase.from('trader_profiles').update({ tier: next.tier, cart_capacity: next.capacity, caravan_slots: next.slots }).eq('user_id', user.id);
    toast.success(`You are now a ${next.label}!`);
    refresh();
  };

  const homeRealm = profile.home_realm_id ? realmById(profile.home_realm_id) : null;

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      <div className="bg-card/60 border border-border/60 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base text-foreground">{profile.trader_name}</h2>
            <p className="text-[11px] text-primary font-display uppercase tracking-wider">{TIERS[idx]?.label}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-lg text-primary">{profile.gold.toLocaleString()}g</p>
            <p className="text-[9px] text-muted-foreground">treasury</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40">
          <div className="text-center"><p className="font-display text-sm text-foreground">{profile.trades_completed}</p><p className="text-[9px] text-muted-foreground uppercase tracking-wider">Trades</p></div>
          <div className="text-center"><p className="font-display text-sm text-foreground">{profile.total_profit.toLocaleString()}g</p><p className="text-[9px] text-muted-foreground uppercase tracking-wider">Profit</p></div>
          <div className="text-center"><p className="font-display text-sm text-foreground">{profile.cart_capacity}wt</p><p className="text-[9px] text-muted-foreground uppercase tracking-wider">Cart</p></div>
        </div>
      </div>

      {next && (
        <div className="bg-card/60 border border-border/60 rounded-xl p-3">
          <p className="font-display text-sm text-foreground mb-1">Next: {next.label}</p>
          <p className="text-[11px] text-muted-foreground mb-2">Requires {next.trades} trades · {next.profit.toLocaleString()}g profit</p>
          <div className="space-y-1">
            <div><p className="text-[10px] text-muted-foreground">Trades {profile.trades_completed}/{next.trades}</p><div className="h-1 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.min(100, (profile.trades_completed / next.trades) * 100)}%` }} /></div></div>
            <div><p className="text-[10px] text-muted-foreground">Profit {profile.total_profit}/{next.profit}</p><div className="h-1 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.min(100, (profile.total_profit / next.profit) * 100)}%` }} /></div></div>
          </div>
          <button onClick={promote} disabled={!canPromote} className="w-full mt-2 bg-primary/20 text-primary font-display text-xs py-2 rounded-lg disabled:opacity-30">
            {canPromote ? `Ascend to ${next.label}` : 'Not yet eligible'}
          </button>
        </div>
      )}

      <div className="bg-card/60 border border-border/60 rounded-xl p-3">
        <p className="font-display text-sm text-foreground mb-1">Home Realm</p>
        <p className="text-[11px] text-muted-foreground mb-2">Allocate yourself to a realm — trade their goods at discount and gain favor faster.</p>
        {homeRealm ? (
          <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
            <span className="text-2xl" style={{ color: homeRealm.color }}>{homeRealm.sigil}</span>
            <div className="flex-1"><p className="font-display text-xs text-foreground">{homeRealm.name}</p><p className="text-[10px] text-muted-foreground">{homeRealm.epithet}</p></div>
            <button onClick={() => setHomeRealm('')} className="text-[10px] text-muted-foreground hover:text-destructive">Renounce</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {realms.filter(r => !r.is_central).map(r => (
              <motion.button key={r.id} whileTap={{ scale: 0.95 }} onClick={() => { setHomeRealm(r.id); toast.success(`Allegiance: ${r.name}`); }} className="bg-muted/30 hover:bg-muted/50 rounded-lg p-2 text-left">
                <div className="flex items-center gap-1"><span style={{ color: r.color }}>{r.sigil}</span><p className="font-display text-[10px] text-foreground truncate">{r.name}</p></div>
                <p className="text-[9px] text-muted-foreground">{r.aether}</p>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card/60 border border-border/60 rounded-xl p-3 space-y-1.5">
        <p className="font-display text-sm text-foreground mb-1">Standing across the Crescent</p>
        {realms.map(r => {
          const rep = reps.find(re => re.realm_id === r.id);
          const v = rep?.reputation ?? 0;
          return (
            <div key={r.id} className="flex items-center gap-2">
              <span style={{ color: r.color }} className="w-4 text-center">{r.sigil}</span>
              <p className="flex-1 text-[11px] text-foreground truncate">{r.name}</p>
              <span className={`text-[10px] font-display ${v > 0 ? 'text-[hsl(var(--food))]' : v < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{v > 0 ? '+' : ''}{v}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
