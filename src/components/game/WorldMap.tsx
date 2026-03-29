import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import worldmapBg from '@/assets/worldmap-bg.jpg';

// NPC Realms - persistent on map
const NPC_REALMS = [
  { id: 'npc-1', name: 'Iron Dominion', ruler: 'King Valthor', power: 12500, x: 12, y: 15, emoji: '👑', type: 'hostile' as const, desc: 'An aggressive militaristic kingdom. Their iron legions threaten all neighbors.' },
  { id: 'npc-2', name: 'Thornwood Enclave', ruler: 'Elder Moss', power: 8200, x: 22, y: 35, emoji: '🌿', type: 'neutral' as const, desc: 'Ancient druids who guard the deep forest. They trade rare herbs for peace.' },
  { id: 'npc-3', name: 'Ashfall Citadel', ruler: 'Warlord Cindra', power: 15000, x: 75, y: 18, emoji: '🔥', type: 'hostile' as const, desc: 'Built atop a dormant volcano. Their fire mages are feared across the realm.' },
  { id: 'npc-4', name: 'Frostgate Hold', ruler: 'Jarl Hrimfaxi', power: 9800, x: 15, y: 72, emoji: '❄️', type: 'neutral' as const, desc: 'Mountain dwellers who control the northern passes. Expert smiths and miners.' },
  { id: 'npc-5', name: 'Sunspire Sanctum', ruler: 'High Priestess Solara', power: 7500, x: 82, y: 75, emoji: '☀️', type: 'friendly' as const, desc: 'A holy order that offers healing and blessings to worthy allies.' },
  { id: 'npc-6', name: "Dragon's Maw", ruler: 'The Broodmother', power: 25000, x: 50, y: 12, emoji: '🐉', type: 'hostile' as const, desc: 'A dragon\'s lair surrounded by scorched earth. Only the bravest dare approach.' },
  { id: 'npc-7', name: 'Mistwood Coven', ruler: 'The Three Sisters', power: 11000, x: 35, y: 60, emoji: '🌙', type: 'neutral' as const, desc: 'Witches who brew potions and cast curses. They offer dark bargains.' },
  { id: 'npc-8', name: 'Goldport Haven', ruler: 'Merchant Prince Auric', power: 6000, x: 88, y: 48, emoji: '⚓', type: 'friendly' as const, desc: 'A bustling trade port. They offer lucrative trade routes to allied kingdoms.' },
];

// Dynamic world events
interface WorldEvent {
  id: string;
  name: string;
  description: string;
  emoji: string;
  x: number;
  y: number;
  type: 'danger' | 'opportunity' | 'mystery';
  reward?: string;
}

function generateEvents(): WorldEvent[] {
  const templates = [
    { name: 'Goblin Raid', description: 'A horde of goblins terrorizes the countryside. Defeat them for gold!', emoji: '👺', type: 'danger' as const, reward: '+200 Gold' },
    { name: 'Ancient Ruins', description: 'Crumbling ruins have been discovered. Explore for hidden treasures.', emoji: '🏛️', type: 'mystery' as const, reward: '+150 Stone' },
    { name: 'Wandering Merchant', description: 'A rare merchant offers exotic goods at discount prices.', emoji: '🧙', type: 'opportunity' as const, reward: 'Trade Bonus' },
    { name: 'Dragon Sighting', description: 'A young dragon has been spotted. Will you slay it or tame it?', emoji: '🐲', type: 'danger' as const, reward: '+500 Gold' },
    { name: 'Harvest Festival', description: 'A neighboring village celebrates. Join for resource bonuses!', emoji: '🎪', type: 'opportunity' as const, reward: '+100 Food' },
    { name: 'Dark Portal', description: 'A mysterious portal pulses with dark energy. What lies within?', emoji: '🌀', type: 'mystery' as const, reward: '??? Mystery' },
    { name: 'Bandit Camp', description: 'Bandits have set up camp on a trade route. Clear them out!', emoji: '⚔️', type: 'danger' as const, reward: '+300 Gold' },
    { name: 'Lost Caravan', description: 'An abandoned supply caravan sits along the road. Claim it!', emoji: '🏕️', type: 'opportunity' as const, reward: '+100 Wood' },
    { name: 'Cursed Tomb', description: 'An ancient tomb emanates an eerie glow. Dare you enter?', emoji: '💀', type: 'mystery' as const, reward: 'Ancient Artifact' },
    { name: 'Sacred Grove', description: 'A hidden grove radiates magical energy. Meditate for blessings.', emoji: '✨', type: 'opportunity' as const, reward: '+50 All Resources' },
  ];

  // Pick 4-6 random events
  const count = 4 + Math.floor(Math.random() * 3);
  const shuffled = [...templates].sort(() => Math.random() - 0.5).slice(0, count);

  return shuffled.map((t, i) => ({
    ...t,
    id: `event-${i}`,
    x: 20 + Math.random() * 60,
    y: 20 + Math.random() * 60,
  }));
}

const TYPE_COLORS = {
  hostile: 'bg-destructive',
  neutral: 'bg-muted-foreground',
  friendly: 'bg-food',
};

const EVENT_COLORS = {
  danger: 'border-destructive/60 bg-destructive/20',
  opportunity: 'border-primary/60 bg-primary/20',
  mystery: 'border-accent/60 bg-accent/20',
};

type SelectedItem = 
  | { kind: 'npc'; data: typeof NPC_REALMS[number] }
  | { kind: 'event'; data: WorldEvent }
  | { kind: 'player'; data: any }
  | null;

export default function WorldMap() {
  const { allVillages } = useGame();
  const { user } = useAuth();
  const [selected, setSelected] = useState<SelectedItem>(null);
  const events = useMemo(() => generateEvents(), []);

  const getPosition = (id: string, index: number) => {
    const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return {
      x: 30 + (hash * 13 + index * 37) % 40,
      y: 30 + (hash * 17 + index * 43) % 40,
    };
  };

  return (
    <div className="flex-1 flex flex-col p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-lg text-foreground text-shadow-gold">World Map</h2>
        <span className="text-[10px] text-muted-foreground">{allVillages.length} players • {NPC_REALMS.length} NPC realms • {events.length} events</span>
      </div>

      <div className="flex-1 rounded-xl relative overflow-hidden min-h-[420px] border border-border">
        {/* Map background */}
        <img
          src={worldmapBg}
          alt="World Map"
          className="absolute inset-0 w-full h-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-background/30" />

        {/* NPC Realms */}
        {NPC_REALMS.map((realm, i) => (
          <motion.button
            key={realm.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            whileTap={{ scale: 0.85 }}
            onClick={() => setSelected({ kind: 'npc', data: realm })}
            className="absolute flex flex-col items-center gap-0.5 -translate-x-1/2 -translate-y-1/2 z-10"
            style={{ left: `${realm.x}%`, top: `${realm.y}%` }}
          >
            <div className="relative">
              <div className={`w-6 h-6 rounded-full ${TYPE_COLORS[realm.type]} flex items-center justify-center text-xs shadow-lg`}>
                {realm.emoji}
              </div>
              {realm.type === 'hostile' && (
                <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-destructive animate-pulse" />
              )}
            </div>
            <span className="text-[7px] font-display text-foreground bg-background/70 px-1 rounded whitespace-nowrap">
              {realm.name}
            </span>
          </motion.button>
        ))}

        {/* World Events */}
        {events.map((event, i) => (
          <motion.button
            key={event.id}
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ delay: 0.5 + i * 0.1 }}
            whileTap={{ scale: 0.85 }}
            onClick={() => setSelected({ kind: 'event', data: event })}
            className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 w-5 h-5 rounded-full border ${EVENT_COLORS[event.type]} flex items-center justify-center text-[10px] animate-float shadow-md`}
            style={{
              left: `${event.x}%`,
              top: `${event.y}%`,
              animationDelay: `${i * 0.5}s`,
            }}
          >
            {event.emoji}
          </motion.button>
        ))}

        {/* Player villages */}
        {allVillages.map((pv, i) => {
          const pos = getPosition(pv.village.id, i);
          const isMe = pv.village.user_id === user?.id;
          return (
            <motion.button
              key={pv.village.id}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3 + i * 0.08 }}
              whileTap={{ scale: 0.85 }}
              onClick={() => setSelected({ kind: 'player', data: pv })}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-0.5"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <div className={`w-5 h-5 rounded-sm flex items-center justify-center text-[10px] shadow-lg ${
                isMe ? 'bg-primary animate-pulse-gold ring-2 ring-primary/50' : 'bg-secondary'
              }`}>
                🏰
              </div>
              <span className="text-[7px] font-display text-foreground bg-background/70 px-1 rounded whitespace-nowrap">
                {isMe ? 'You' : pv.profile.display_name}
              </span>
            </motion.button>
          );
        })}

        {/* Legend */}
        <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm rounded-lg p-1.5 space-y-0.5 text-[8px] z-40">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-destructive" /> Hostile</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-muted-foreground" /> Neutral</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-food" /> Friendly</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full border border-primary bg-primary/20" /> Event</div>
        </div>
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="game-panel border-glow rounded-xl p-3 mt-2 relative"
          >
            <button onClick={() => setSelected(null)} className="absolute top-2 right-2 text-muted-foreground text-xs">✕</button>

            {selected.kind === 'npc' && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{selected.data.emoji}</span>
                  <div>
                    <h3 className="font-display text-sm text-foreground">{selected.data.name}</h3>
                    <p className="text-[10px] text-muted-foreground">Ruled by {selected.data.ruler}</p>
                  </div>
                  <span className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    selected.data.type === 'hostile' ? 'bg-destructive/20 text-destructive' :
                    selected.data.type === 'friendly' ? 'bg-food/20 text-food' :
                    'bg-muted text-muted-foreground'
                  }`}>{selected.data.type}</span>
                </div>
                <p className="text-xs text-muted-foreground">{selected.data.desc}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-foreground">Power: {selected.data.power.toLocaleString()}</span>
                  {selected.data.type !== 'hostile' && (
                    <motion.button whileTap={{ scale: 0.95 }}
                      className="bg-primary/20 text-primary font-display text-[10px] py-1 px-3 rounded-lg">
                      Send Envoy
                    </motion.button>
                  )}
                  {selected.data.type === 'hostile' && (
                    <motion.button whileTap={{ scale: 0.95 }}
                      className="bg-destructive/20 text-destructive font-display text-[10px] py-1 px-3 rounded-lg">
                      Scout Forces
                    </motion.button>
                  )}
                </div>
              </div>
            )}

            {selected.kind === 'event' && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{selected.data.emoji}</span>
                  <div>
                    <h3 className="font-display text-sm text-foreground">{selected.data.name}</h3>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      selected.data.type === 'danger' ? 'bg-destructive/20 text-destructive' :
                      selected.data.type === 'opportunity' ? 'bg-primary/20 text-primary' :
                      'bg-accent/20 text-accent-foreground'
                    }`}>{selected.data.type}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{selected.data.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-primary font-bold">Reward: {selected.data.reward}</span>
                  <motion.button whileTap={{ scale: 0.95 }}
                    className="bg-primary text-primary-foreground font-display text-[10px] py-1 px-3 rounded-lg glow-gold-sm">
                    Investigate
                  </motion.button>
                </div>
              </div>
            )}

            {selected.kind === 'player' && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏰</span>
                  <div>
                    <h3 className="font-display text-sm text-foreground">{selected.data.village.name}</h3>
                    <p className="text-[10px] text-muted-foreground">{selected.data.profile.display_name} • Lv.{selected.data.village.level}</p>
                  </div>
                </div>
                {selected.data.village.user_id !== user?.id && (
                  <div className="flex gap-2">
                    <motion.button whileTap={{ scale: 0.95 }}
                      className="flex-1 bg-primary/20 text-primary font-display text-[10px] py-1 rounded-lg">
                      Send Message
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }}
                      className="flex-1 bg-destructive/20 text-destructive font-display text-[10px] py-1 rounded-lg">
                      Scout
                    </motion.button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
