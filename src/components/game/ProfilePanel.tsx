import { useState } from 'react';
import { useGame, BUILDING_INFO, BuildingType, TROOP_INFO, TroopType } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import { lovable } from '@/integrations/lovable';
import { motion } from 'framer-motion';

export default function ProfilePanel() {
  const { villageName, playerLevel, buildings, totalProduction, displayName, army, totalArmyPower } = useGame();
  const { signOut, user } = useAuth();
  const totalBuildingLevels = buildings.reduce((sum, b) => sum + b.level, 0);
  const power = totalArmyPower();
  const totalTroops = Object.values(army).reduce((s, v) => s + v, 0);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkMsg, setLinkMsg] = useState('');

  const hasGoogle = user?.app_metadata?.providers?.includes('google') ||
    user?.identities?.some(i => i.provider === 'google');

  const handleLinkGoogle = async () => {
    setLinkLoading(true);
    setLinkMsg('');
    try {
      const { error } = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
        extraParams: { prompt: 'select_account' },
      });
      if (error) setLinkMsg(error.message);
    } catch (err: any) {
      setLinkMsg(err?.message || 'Failed to link');
    }
    setLinkLoading(false);
  };

  return (
    <div className="flex-1 flex flex-col p-4 space-y-4 pb-20 overflow-y-auto">
      <h2 className="font-display text-lg text-foreground text-shadow-gold">Profile</h2>

      <div className="game-panel border-glow rounded-xl p-4 text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-secondary flex items-center justify-center text-3xl glow-gold">🛡️</div>
        <h3 className="font-display text-foreground">{displayName}</h3>
        <p className="text-xs text-muted-foreground">{villageName}</p>
        <p className="text-xs text-primary font-bold">Level {playerLevel}</p>
        <p className="text-xs text-muted-foreground">Power: {(totalBuildingLevels * 100 + power.attack + power.defense).toLocaleString()}</p>
      </div>

      <div className="game-panel border-glow rounded-xl p-4 space-y-2">
        <h3 className="font-display text-sm text-foreground">Production Rates</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2"><span>💰</span><span className="text-foreground">{totalProduction.gold} gold/min</span></div>
          <div className="flex items-center gap-2"><span>🪵</span><span className="text-foreground">{totalProduction.wood} wood/min</span></div>
          <div className="flex items-center gap-2"><span>🪨</span><span className="text-foreground">{totalProduction.stone} stone/min</span></div>
          <div className="flex items-center gap-2"><span>🌾</span><span className="text-foreground">{totalProduction.food} food/min</span></div>
        </div>
      </div>

      {totalTroops > 0 && (
        <div className="game-panel border-glow rounded-xl p-4 space-y-2">
          <h3 className="font-display text-sm text-foreground">Army ({totalTroops} troops)</h3>
          <div className="flex items-center gap-3 mb-1 text-xs">
            <span className="text-primary font-bold">⚔️ {power.attack} ATK</span>
            <span className="text-foreground font-bold">🛡️ {power.defense} DEF</span>
          </div>
          <div className="space-y-1">
            {Object.entries(army).filter(([, v]) => v > 0).map(([type, count]) => {
              const info = TROOP_INFO[type as TroopType];
              return (
                <div key={type} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{info.emoji} {info.name}</span>
                  <span className="text-primary font-bold">x{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="game-panel border-glow rounded-xl p-4 space-y-2">
        <h3 className="font-display text-sm text-foreground">Buildings ({buildings.length})</h3>
        <div className="space-y-1">
          {buildings.map(b => {
            const type = b.type as Exclude<BuildingType, 'empty'>;
            const info = BUILDING_INFO[type];
            return (
              <div key={b.id} className="flex items-center justify-between text-xs">
                <span className="text-foreground">{info.icon} {info.name}</span>
                <span className="text-primary font-bold">Lv.{b.level}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Google Link */}
      {!hasGoogle && (
        <div className="game-panel border-glow rounded-xl p-4 space-y-2">
          <h3 className="font-display text-sm text-foreground">Link Account</h3>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleLinkGoogle}
            disabled={linkLoading}
            className="w-full flex items-center justify-center gap-2 bg-card border border-border rounded-lg px-3 py-2.5 hover:bg-secondary/50 transition-colors disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="text-xs font-display font-bold text-foreground">
              {linkLoading ? '...' : 'Link Google Account'}
            </span>
          </motion.button>
          {linkMsg && <p className="text-xs text-destructive">{linkMsg}</p>}
        </div>
      )}
      {hasGoogle && (
        <div className="game-panel border-glow rounded-xl p-4 flex items-center gap-2">
          <span className="text-xs text-primary">✓</span>
          <span className="text-xs text-muted-foreground">Google account linked</span>
        </div>
      )}

      <motion.button whileTap={{ scale: 0.95 }} onClick={signOut}
        className="bg-destructive/20 text-destructive font-display text-sm py-2.5 rounded-lg w-full">
        Leave Realm
      </motion.button>
    </div>
  );
}
