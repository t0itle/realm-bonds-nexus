import { useTrader } from '@/hooks/useTrader';

export default function InventoryView() {
  const { inventory, goodById, realmById, profile, carriedWeight } = useTrader();
  if (!profile) return null;
  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      <div className="bg-card/60 border border-border/60 rounded-xl p-3">
        <h2 className="font-display text-base text-foreground">📦 Cart</h2>
        <p className="text-[11px] text-muted-foreground">{carriedWeight} / {profile.cart_capacity} weight · {inventory.length} unique goods</p>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
          <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, (carriedWeight / profile.cart_capacity) * 100)}%` }} />
        </div>
      </div>
      {inventory.length === 0 && (
        <p className="text-center text-muted-foreground text-xs py-12">Your cart is empty. Travel the crescent and buy low.</p>
      )}
      <div className="space-y-1.5">
        {inventory.map(inv => {
          const g = goodById(inv.good_id);
          if (!g) return null;
          const origin = g.origin_realm_id ? realmById(g.origin_realm_id) : null;
          return (
            <div key={inv.id} className="bg-card/40 border border-border/40 rounded-lg p-2 flex items-center gap-2">
              <span className="text-2xl">{g.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-display text-xs text-foreground">{g.name}</p>
                <p className="text-[10px] text-muted-foreground">{origin ? `From ${origin.name}` : 'Origin unknown'} · paid {inv.avg_cost}g/ea</p>
              </div>
              <div className="text-right">
                <p className="font-display text-sm text-primary">×{inv.quantity}</p>
                <p className="text-[9px] text-muted-foreground">{inv.quantity * g.weight}wt</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
