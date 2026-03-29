import { motion } from 'framer-motion';

const REGIONS = [
  { name: 'Shadowmere', x: 45, y: 40, owner: 'You', color: 'bg-primary' },
  { name: 'Iron Keep', x: 20, y: 25, owner: 'Lord Vex', color: 'bg-destructive' },
  { name: 'Thornwood', x: 70, y: 30, owner: 'Free', color: 'bg-muted' },
  { name: 'Ashfall', x: 30, y: 65, owner: 'DragonClan', color: 'bg-accent' },
  { name: 'Frostgate', x: 65, y: 70, owner: 'Free', color: 'bg-muted' },
  { name: 'Sunspire', x: 80, y: 50, owner: 'Alliance of Light', color: 'bg-food' },
  { name: "Dragon's Maw", x: 15, y: 55, owner: 'Free', color: 'bg-muted' },
];

export default function WorldMap() {
  return (
    <div className="flex-1 flex flex-col p-4">
      <h2 className="font-display text-lg text-foreground text-shadow-gold mb-3">World Map</h2>
      <div className="flex-1 game-panel border-glow rounded-xl relative overflow-hidden min-h-[400px]">
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(hsl(42 72% 52% / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(42 72% 52% / 0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {REGIONS.map((region, i) => (
          <motion.button
            key={region.name}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            whileTap={{ scale: 0.9 }}
            className="absolute flex flex-col items-center gap-1 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${region.x}%`, top: `${region.y}%` }}
          >
            <div className={`w-4 h-4 rounded-full ${region.color} ${region.owner === 'You' ? 'animate-pulse-gold ring-2 ring-primary/50' : ''}`} />
            <div className="text-center">
              <p className="text-[9px] font-display text-foreground leading-tight">{region.name}</p>
              <p className="text-[8px] text-muted-foreground">{region.owner}</p>
            </div>
          </motion.button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-2 font-display">
        Tap a region to scout or conquer
      </p>
    </div>
  );
}
