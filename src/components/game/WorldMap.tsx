import { motion } from 'framer-motion';
import { useGame } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';

const COLORS = ['bg-primary', 'bg-destructive', 'bg-accent', 'bg-food', 'bg-wood', 'bg-stone'];

export default function WorldMap() {
  const { allVillages } = useGame();
  const { user } = useAuth();

  // Assign deterministic positions based on village ID
  const getPosition = (id: string, index: number) => {
    const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return {
      x: 10 + (hash * 13 + index * 37) % 80,
      y: 10 + (hash * 17 + index * 43) % 80,
    };
  };

  return (
    <div className="flex-1 flex flex-col p-4">
      <h2 className="font-display text-lg text-foreground text-shadow-gold mb-3">World Map</h2>
      <div className="flex-1 game-panel border-glow rounded-xl relative overflow-hidden min-h-[400px]">
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(hsl(42 72% 52% / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(42 72% 52% / 0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {allVillages.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            Discovering the realm...
          </div>
        )}

        {allVillages.map((pv, i) => {
          const pos = getPosition(pv.village.id, i);
          const isMe = pv.village.user_id === user?.id;

          return (
            <motion.button
              key={pv.village.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              whileTap={{ scale: 0.9 }}
              className="absolute flex flex-col items-center gap-1 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <div className={`w-4 h-4 rounded-full ${isMe ? 'bg-primary animate-pulse-gold ring-2 ring-primary/50' : COLORS[i % COLORS.length]}`} />
              <div className="text-center">
                <p className="text-[9px] font-display text-foreground leading-tight">{pv.village.name}</p>
                <p className="text-[8px] text-muted-foreground">
                  {isMe ? 'You' : pv.profile.display_name} • Lv.{pv.village.level}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-2 font-display">
        {allVillages.length} {allVillages.length === 1 ? 'kingdom' : 'kingdoms'} in the realm
      </p>
    </div>
  );
}
