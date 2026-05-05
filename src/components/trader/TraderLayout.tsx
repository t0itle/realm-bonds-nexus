import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTrader } from '@/hooks/useTrader';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import WorldMap from './WorldMap';
import TownView from './TownView';
import InventoryView from './InventoryView';
import LedgerView from './LedgerView';

type Tab = 'map' | 'town' | 'inventory' | 'ledger';

const TIER_LABEL: Record<string, string> = {
  caravaneer: 'Caravaneer',
  merchant: 'Merchant',
  tradehouse: 'Trade House',
  magnate: 'Magnate',
};

export default function TraderLayout() {
  const { loading, profile, townById, realmById, carriedWeight } = useTrader();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<Tab>('map');

  if (loading || !profile) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-3">
        <div className="text-4xl animate-pulse">✶</div>
        <p className="font-display text-sm text-muted-foreground">The Concord opens its ledger...</p>
      </div>
    );
  }

  const currentTown = profile.current_town_id ? townById(profile.current_town_id) : undefined;
  const homeRealm = profile.home_realm_id ? realmById(profile.home_realm_id) : undefined;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border/60 bg-card/40 backdrop-blur px-4 py-2 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-base text-primary truncate flex items-center gap-2">
            <span>{TIER_LABEL[profile.tier]}</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="text-foreground">{profile.trader_name}</span>
          </h1>
          <p className="text-[10px] text-muted-foreground truncate">
            {currentTown ? `📍 ${currentTown.name}` : '📍 Unaligned'}
            {homeRealm && <> · {homeRealm.sigil} {homeRealm.name}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="font-display text-sm text-primary leading-none">{profile.gold.toLocaleString()}g</p>
            <p className="text-[9px] text-muted-foreground leading-none mt-0.5">{carriedWeight}/{profile.cart_capacity} wt</p>
          </div>
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-full bg-muted/40 hover:bg-muted/60 text-foreground text-xs"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button
            onClick={() => signOut()}
            className="text-[10px] text-muted-foreground hover:text-foreground px-2"
          >
            ↪
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0"
          >
            {tab === 'map' && <WorldMap onTownSelect={() => setTab('town')} />}
            {tab === 'town' && <TownView />}
            {tab === 'inventory' && <InventoryView />}
            {tab === 'ledger' && <LedgerView />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom tab bar */}
      <nav className="border-t border-border/60 bg-card/60 backdrop-blur grid grid-cols-4">
        {([
          ['map', '🗺', 'Crescent'],
          ['town', '⚖', 'Market'],
          ['inventory', '📦', 'Cart'],
          ['ledger', '📜', 'Ledger'],
        ] as const).map(([key, icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex flex-col items-center gap-0.5 py-2 transition-colors ${
              tab === key ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="text-lg">{icon}</span>
            <span className="font-display text-[10px]">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}