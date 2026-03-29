import { useGame, BUILDING_INFO, BuildingType } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';

export default function ProfilePanel() {
  const { villageName, playerLevel, buildings, totalProduction, displayName } = useGame();
  const { signOut } = useAuth();

  const totalBuildingLevels = buildings.reduce((sum, b) => sum + b.level, 0);

  return (
    <div className="flex-1 flex flex-col p-4 space-y-4">
      <h2 className="font-display text-lg text-foreground text-shadow-gold">Profile</h2>

      <div className="game-panel border-glow rounded-xl p-4 text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-secondary flex items-center justify-center text-3xl glow-gold">
          🛡️
        </div>
        <h3 className="font-display text-foreground">{displayName}</h3>
        <p className="text-xs text-muted-foreground">{villageName}</p>
        <p className="text-xs text-primary font-bold">Level {playerLevel}</p>
        <p className="text-xs text-muted-foreground">Power: {(totalBuildingLevels * 100).toLocaleString()}</p>
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

      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={signOut}
        className="bg-destructive/20 text-destructive font-display text-sm py-2.5 rounded-lg w-full"
      >
        Leave Realm
      </motion.button>
    </div>
  );
}
