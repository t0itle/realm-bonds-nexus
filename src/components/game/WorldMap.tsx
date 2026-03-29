import { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame, TROOP_INFO, TroopType } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import worldmapBg from '@/assets/worldmap-bg.jpg';
import { toast } from 'sonner';

// Map is 200000x200000 virtual units (massive world)
const MAP_SIZE = 200000;
const MIN_ZOOM = 0.01;
const MAX_ZOOM = 2.0;

const NPC_REALMS = [
  { id: 'npc-1', name: 'Iron Dominion', ruler: 'King Valthor', power: 120, x: 15000, y: 18000, emoji: '👑', type: 'hostile' as const, desc: 'An aggressive militaristic kingdom. Their iron legions threaten all neighbors.', territory: 12000 },
  { id: 'npc-2', name: 'Thornwood Enclave', ruler: 'Elder Moss', power: 80, x: 42000, y: 55000, emoji: '🌿', type: 'neutral' as const, desc: 'Ancient druids who guard the deep forest. They trade rare herbs for peace.', territory: 10000 },
  { id: 'npc-3', name: 'Ashfall Citadel', ruler: 'Warlord Cindra', power: 200, x: 145000, y: 22000, emoji: '🔥', type: 'hostile' as const, desc: 'Built atop a dormant volcano. Their fire mages are feared across the realm.', territory: 15000 },
  { id: 'npc-4', name: 'Frostgate Hold', ruler: 'Jarl Hrimfaxi', power: 150, x: 25000, y: 150000, emoji: '❄️', type: 'neutral' as const, desc: 'Mountain dwellers who control the northern passes. Expert smiths and miners.', territory: 13000 },
  { id: 'npc-5', name: 'Sunspire Sanctum', ruler: 'High Priestess Solara', power: 60, x: 170000, y: 165000, emoji: '☀️', type: 'friendly' as const, desc: 'A holy order that offers healing and blessings to worthy allies.', territory: 8000 },
  { id: 'npc-6', name: "Dragon's Maw", ruler: 'The Broodmother', power: 350, x: 100000, y: 8000, emoji: '🐉', type: 'hostile' as const, desc: "A dragon's lair. Only the bravest dare approach. Legendary rewards await.", territory: 20000 },
  { id: 'npc-7', name: 'Mistwood Coven', ruler: 'The Three Sisters', power: 130, x: 60000, y: 120000, emoji: '🌙', type: 'neutral' as const, desc: 'Witches who brew potions and cast curses. They offer dark bargains.', territory: 11000 },
  { id: 'npc-8', name: 'Goldport Haven', ruler: 'Merchant Prince Auric', power: 50, x: 185000, y: 90000, emoji: '⚓', type: 'friendly' as const, desc: 'A bustling trade port. Lucrative trade routes for allied kingdoms.', territory: 9000 },
  { id: 'npc-9', name: 'The Blighted Wastes', ruler: 'Lich King Mordrath', power: 400, x: 120000, y: 80000, emoji: '💀', type: 'hostile' as const, desc: 'An undead wasteland ruled by a powerful lich. Dark magic permeates everything.', territory: 18000 },
  { id: 'npc-10', name: 'Emerald Coast', ruler: 'Admiral Sirena', power: 90, x: 190000, y: 35000, emoji: '🌊', type: 'friendly' as const, desc: 'Seafaring traders who control the eastern coast. Great allies for naval support.', territory: 14000 },
  { id: 'npc-11', name: 'Obsidian Forge', ruler: 'Master Smith Kragg', power: 110, x: 48000, y: 90000, emoji: '🔨', type: 'neutral' as const, desc: 'Legendary blacksmiths who forge weapons of immense power for the right price.', territory: 7000 },
  { id: 'npc-12', name: 'Whispering Ruins', ruler: 'The Oracle', power: 70, x: 85000, y: 175000, emoji: '🏛️', type: 'neutral' as const, desc: 'Ancient ruins housing a powerful oracle. Seek wisdom for a price.', territory: 6000 },
  { id: 'npc-13', name: 'Shadowfen Marshes', ruler: 'Bog Queen Miretha', power: 95, x: 70000, y: 40000, emoji: '🐊', type: 'hostile' as const, desc: 'Toxic swamplands teeming with monstrous beasts and poisonous fog.', territory: 16000 },
  { id: 'npc-14', name: 'Skyreach Eyrie', ruler: 'Storm Lord Aethon', power: 280, x: 130000, y: 140000, emoji: '⚡', type: 'hostile' as const, desc: 'A floating fortress above the clouds. Lightning strikes all who approach uninvited.', territory: 14000 },
  { id: 'npc-15', name: 'Verdant Republic', ruler: 'Chancellor Thalia', power: 75, x: 160000, y: 60000, emoji: '🏰', type: 'friendly' as const, desc: 'A prosperous democracy of farmers and scholars. They value knowledge above all.', territory: 11000 },
  { id: 'npc-16', name: 'Crimson Horde', ruler: 'Khan Bloodfang', power: 310, x: 35000, y: 170000, emoji: '🐺', type: 'hostile' as const, desc: 'Nomadic warriors who roam the southern steppes. Unstoppable cavalry charges.', territory: 19000 },
  { id: 'npc-17', name: 'Crystal Depths', ruler: 'Gem King Prismo', power: 140, x: 110000, y: 110000, emoji: '💎', type: 'neutral' as const, desc: 'Underground caverns filled with magical crystals. Rare resources abound.', territory: 10000 },
  { id: 'npc-18', name: 'Ashen Theocracy', ruler: 'Prophet Ignatius', power: 180, x: 80000, y: 65000, emoji: '⛪', type: 'neutral' as const, desc: 'Fanatical fire worshippers who command devastating rituals.', territory: 13000 },
];

interface WorldEvent {
  id: string;
  name: string;
  description: string;
  emoji: string;
  x: number;
  y: number;
  type: 'danger' | 'opportunity' | 'mystery';
  reward: { gold?: number; wood?: number; stone?: number; food?: number };
  power: number;
  claimed: boolean;
}

function generateEvents(): WorldEvent[] {
  const templates = [
    { name: 'Goblin Raid', description: 'A horde of goblins terrorizes nearby.', emoji: '👺', type: 'danger' as const, reward: { gold: 200 }, power: 40 },
    { name: 'Ancient Ruins', description: 'Crumbling ruins with hidden treasures.', emoji: '🏛️', type: 'mystery' as const, reward: { stone: 150, gold: 100 }, power: 30 },
    { name: 'Wandering Merchant', description: 'A rare merchant offers exotic goods.', emoji: '🧙', type: 'opportunity' as const, reward: { gold: 80, wood: 80, stone: 80, food: 80 }, power: 0 },
    { name: 'Dragon Sighting', description: 'A young dragon roams. Slay or tame it?', emoji: '🐲', type: 'danger' as const, reward: { gold: 500 }, power: 100 },
    { name: 'Harvest Festival', description: 'A nearby village celebrates harvest.', emoji: '🎪', type: 'opportunity' as const, reward: { food: 200 }, power: 0 },
    { name: 'Dark Portal', description: 'A mysterious portal pulses with energy.', emoji: '🌀', type: 'mystery' as const, reward: { gold: 300, stone: 200 }, power: 80 },
    { name: 'Bandit Camp', description: 'Bandits block a trade route. Clear them!', emoji: '🗡️', type: 'danger' as const, reward: { gold: 300 }, power: 50 },
    { name: 'Lost Caravan', description: 'An abandoned supply caravan. Claim it!', emoji: '🏕️', type: 'opportunity' as const, reward: { wood: 150, food: 100 }, power: 0 },
    { name: 'Cursed Tomb', description: 'An ancient tomb emanates eerie glow.', emoji: '⚰️', type: 'mystery' as const, reward: { gold: 400 }, power: 70 },
    { name: 'Sacred Grove', description: 'A hidden grove with magical energy.', emoji: '✨', type: 'opportunity' as const, reward: { gold: 50, wood: 50, stone: 50, food: 50 }, power: 0 },
    { name: 'Orc Warband', description: 'Orcs march towards settlements!', emoji: '👹', type: 'danger' as const, reward: { gold: 250, food: 150 }, power: 60 },
    { name: 'Fairy Ring', description: 'Mysterious mushroom circle glows.', emoji: '🍄', type: 'mystery' as const, reward: { food: 300 }, power: 20 },
    { name: 'Iron Deposits', description: 'Rich mineral veins discovered!', emoji: '⛰️', type: 'opportunity' as const, reward: { stone: 250, gold: 100 }, power: 0 },
    { name: 'Pirate Cove', description: 'Pirates hoard stolen treasure here.', emoji: '🏴‍☠️', type: 'danger' as const, reward: { gold: 600 }, power: 90 },
  ];
  const count = 8 + Math.floor(Math.random() * 6);
  const shuffled = [...templates].sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled.map((t, i) => ({
    ...t, id: `event-${i}`, claimed: false,
    x: 100 + Math.random() * (MAP_SIZE - 200),
    y: 100 + Math.random() * (MAP_SIZE - 200),
  }));
}

const TYPE_COLORS = { hostile: 'bg-destructive', neutral: 'bg-muted-foreground', friendly: 'bg-food' };
const EVENT_COLORS = { danger: 'border-destructive/60 bg-destructive/20', opportunity: 'border-primary/60 bg-primary/20', mystery: 'border-accent/60 bg-accent/20' };

type SelectedItem =
  | { kind: 'npc'; data: typeof NPC_REALMS[number] }
  | { kind: 'event'; data: WorldEvent; index: number }
  | { kind: 'player'; data: any }
  | null;

export default function WorldMap() {
  const { allVillages, addResources, army, totalArmyPower, attackTarget } = useGame();
  const { user } = useAuth();
  const [selected, setSelected] = useState<SelectedItem>(null);
  const [events, setEvents] = useState(() => generateEvents());

  // Pan/zoom state
  const [offset, setOffset] = useState({ x: -600, y: -600 });
  const [zoom, setZoom] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const lastTouchDist = useRef<number | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-map-item]')) return;
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [offset]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy });
  }, []);

  const handlePointerUp = useCallback(() => { dragStart.current = null; }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      lastTouchDist.current = d;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDist.current) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const scale = d / lastTouchDist.current;
      setZoom(prev => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev * scale)));
      lastTouchDist.current = d;
    }
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev - e.deltaY * 0.001)));
  }, []);

  const getPlayerPos = (id: string, index: number) => {
    const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return { x: 600 + (hash * 13 + index * 137) % 800, y: 600 + (hash * 17 + index * 173) % 800 };
  };

  const handleInvestigate = useCallback((event: WorldEvent, index: number) => {
    if (event.claimed) return;
    const hasTroops = Object.values(army).some(v => v > 0);

    if (event.power > 0 && !hasTroops) {
      toast.error('You need troops to investigate dangerous events!');
      return;
    }

    if (event.power > 0) {
      const log = attackTarget(event.name, event.power);
      if (log.result === 'victory') {
        addResources(event.reward);
        setEvents(prev => prev.map((e, i) => i === index ? { ...e, claimed: true } : e));
        toast.success(`Victory at ${event.name}! Resources gained.`);
      } else {
        toast.error(`Defeated at ${event.name}! Your troops suffered losses.`);
      }
    } else {
      addResources(event.reward);
      setEvents(prev => prev.map((e, i) => i === index ? { ...e, claimed: true } : e));
      toast.success(`${event.name} — Resources claimed!`);
    }
    setSelected(null);
  }, [army, attackTarget, addResources]);

  const handleAttackNPC = useCallback((realm: typeof NPC_REALMS[number]) => {
    const hasTroops = Object.values(army).some(v => v > 0);
    if (!hasTroops) { toast.error('You need troops to attack!'); return; }
    const log = attackTarget(realm.name, realm.power);
    if (log.result === 'victory') {
      toast.success(`Victory against ${realm.name}! Spoils of war collected.`);
    } else {
      toast.error(`Defeated by ${realm.name}! Retreat and rebuild.`);
    }
    setSelected(null);
  }, [army, attackTarget]);

  const handleEnvoy = useCallback((realm: typeof NPC_REALMS[number]) => {
    const tribute = { gold: Math.floor(realm.power * 0.3) };
    addResources({ gold: -tribute.gold });
    const reward = realm.type === 'friendly'
      ? { gold: Math.floor(realm.power * 0.5), food: Math.floor(realm.power * 0.3) }
      : { gold: Math.floor(realm.power * 0.2), wood: Math.floor(realm.power * 0.15) };
    setTimeout(() => {
      addResources(reward);
      toast.success(`${realm.name} accepted your envoy! Trade deal secured.`);
    }, 1000);
    toast('Envoy dispatched with tribute...');
    setSelected(null);
  }, [addResources]);

  const power = totalArmyPower();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Map header */}
      <div className="px-3 pt-2 pb-1 flex items-center justify-between">
        <h2 className="font-display text-sm text-foreground text-shadow-gold">World Map</h2>
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
          <span>⚔️{power.attack} 🛡️{power.defense}</span>
          <span>Zoom: {Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* Pannable map */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onWheel={handleWheel}
      >
        <div
          className="absolute"
          style={{
            width: MAP_SIZE,
            height: MAP_SIZE,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Background tiles */}
          <img src={worldmapBg} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ imageRendering: 'auto' }} />
          <div className="absolute inset-0 bg-background/20" />

          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-10">
            {Array.from({ length: 21 }, (_, i) => (
              <g key={i}>
                <line x1={i * 100} y1={0} x2={i * 100} y2={MAP_SIZE} stroke="hsl(42 72% 52%)" strokeWidth={0.5} />
                <line x1={0} y1={i * 100} x2={MAP_SIZE} y2={i * 100} stroke="hsl(42 72% 52%)" strokeWidth={0.5} />
              </g>
            ))}
          </svg>

          {/* Coordinate labels */}
          {Array.from({ length: 5 }, (_, i) => {
            const pos = i * 500;
            return (
              <g key={`coords-${i}`}>
                <text x={pos + 5} y={15} fill="hsl(42 72% 52% / 0.4)" fontSize={10} fontFamily="Cinzel">{pos}</text>
                <text x={5} y={pos + 15} fill="hsl(42 72% 52% / 0.4)" fontSize={10} fontFamily="Cinzel">{pos}</text>
              </g>
            );
          })}

          {/* NPC territory circles */}
          {NPC_REALMS.map(realm => (
            <div
              key={`territory-${realm.id}`}
              className={`absolute rounded-full border opacity-10 ${
                realm.type === 'hostile' ? 'border-destructive bg-destructive' :
                realm.type === 'friendly' ? 'border-food bg-food' : 'border-muted-foreground bg-muted-foreground'
              }`}
              style={{
                left: realm.x - realm.territory / 2,
                top: realm.y - realm.territory / 2,
                width: realm.territory,
                height: realm.territory,
              }}
            />
          ))}

          {/* NPC Realms */}
          {NPC_REALMS.map(realm => (
            <button
              key={realm.id}
              data-map-item
              onClick={(e) => { e.stopPropagation(); setSelected({ kind: 'npc', data: realm }); }}
              className="absolute flex flex-col items-center gap-0.5 -translate-x-1/2 -translate-y-1/2 z-10 hover:z-20"
              style={{ left: realm.x, top: realm.y }}
            >
              <div className="relative">
                <div className={`w-10 h-10 rounded-full ${TYPE_COLORS[realm.type]} flex items-center justify-center text-lg shadow-lg border-2 border-background/30`}>
                  {realm.emoji}
                </div>
                {realm.type === 'hostile' && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-destructive animate-pulse border border-background" />
                )}
              </div>
              <div className="text-center bg-background/80 px-1.5 py-0.5 rounded">
                <p className="text-[8px] font-display text-foreground leading-tight whitespace-nowrap">{realm.name}</p>
                <p className="text-[7px] text-muted-foreground">⚔️{realm.power}</p>
              </div>
            </button>
          ))}

          {/* Events */}
          {events.map((event, i) => !event.claimed && (
            <button
              key={event.id}
              data-map-item
              onClick={(e) => { e.stopPropagation(); setSelected({ kind: 'event', data: event, index: i }); }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full border-2 ${EVENT_COLORS[event.type]} flex items-center justify-center text-sm shadow-md`}
              style={{ left: event.x, top: event.y, animation: `float 3s ease-in-out infinite ${i * 0.3}s` }}
            >
              {event.emoji}
            </button>
          ))}

          {/* Player villages */}
          {allVillages.map((pv, i) => {
            const pos = getPlayerPos(pv.village.id, i);
            const isMe = pv.village.user_id === user?.id;
            return (
              <button
                key={pv.village.id}
                data-map-item
                onClick={(e) => { e.stopPropagation(); setSelected({ kind: 'player', data: pv }); }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-0.5 hover:z-40"
                style={{ left: pos.x, top: pos.y }}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shadow-lg ${
                  isMe ? 'bg-primary animate-pulse-gold ring-2 ring-primary/50' : 'bg-secondary border border-border'
                }`}>🏰</div>
                <div className="text-center bg-background/80 px-1 py-0.5 rounded">
                  <p className="text-[8px] font-display text-foreground whitespace-nowrap">{isMe ? '⭐ You' : pv.profile.display_name}</p>
                  <p className="text-[7px] text-muted-foreground">Lv.{pv.village.level}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-50">
          <button onClick={() => setZoom(prev => Math.min(MAX_ZOOM, prev + 0.15))}
            className="w-8 h-8 game-panel border-glow rounded-lg flex items-center justify-center text-foreground text-sm font-bold">+</button>
          <button onClick={() => setZoom(prev => Math.max(MIN_ZOOM, prev - 0.15))}
            className="w-8 h-8 game-panel border-glow rounded-lg flex items-center justify-center text-foreground text-sm font-bold">−</button>
          <button onClick={() => { setZoom(0.5); setOffset({ x: -600, y: -600 }); }}
            className="w-8 h-8 game-panel border-glow rounded-lg flex items-center justify-center text-foreground text-[9px]">⌂</button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg p-2 space-y-1 text-[8px] z-50 border border-border">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-destructive" /><span className="text-foreground">Hostile NPC</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-muted-foreground" /><span className="text-foreground">Neutral NPC</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-food" /><span className="text-foreground">Friendly NPC</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full border border-primary bg-primary/20" /><span className="text-foreground">Event</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-lg bg-secondary" /><span className="text-foreground">Player</span></div>
        </div>
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-14 inset-x-0 z-50 mx-3 game-panel border-glow rounded-xl p-3"
          >
            <button onClick={() => setSelected(null)} className="absolute top-2 right-2 text-muted-foreground text-xs">✕</button>

            {selected.kind === 'npc' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">{selected.data.emoji}</span>
                  <div className="flex-1">
                    <h3 className="font-display text-sm text-foreground">{selected.data.name}</h3>
                    <p className="text-[10px] text-muted-foreground">Ruled by {selected.data.ruler}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    selected.data.type === 'hostile' ? 'bg-destructive/20 text-destructive' :
                    selected.data.type === 'friendly' ? 'bg-food/20 text-food' : 'bg-muted text-muted-foreground'
                  }`}>{selected.data.type}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{selected.data.desc}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-foreground font-bold">⚔️ Power: {selected.data.power}</span>
                  <div className="flex gap-1.5">
                    {selected.data.type !== 'hostile' && (
                      <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleEnvoy(selected.data)}
                        className="bg-primary/20 text-primary font-display text-[10px] py-1.5 px-3 rounded-lg">
                        Send Envoy 💰{Math.floor(selected.data.power * 0.3)}
                      </motion.button>
                    )}
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleAttackNPC(selected.data)}
                      className="bg-destructive/20 text-destructive font-display text-[10px] py-1.5 px-3 rounded-lg">
                      ⚔️ Attack
                    </motion.button>
                  </div>
                </div>
              </div>
            )}

            {selected.kind === 'event' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">{selected.data.emoji}</span>
                  <div className="flex-1">
                    <h3 className="font-display text-sm text-foreground">{selected.data.name}</h3>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      selected.data.type === 'danger' ? 'bg-destructive/20 text-destructive' :
                      selected.data.type === 'opportunity' ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent-foreground'
                    }`}>{selected.data.type}{selected.data.power > 0 ? ` ⚔️${selected.data.power}` : ''}</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">{selected.data.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5 text-[10px] text-primary font-bold">
                    {Object.entries(selected.data.reward).filter(([, v]) => v > 0).map(([k, v]) => (
                      <span key={k}>+{v} {k}</span>
                    ))}
                  </div>
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => handleInvestigate(selected.data, selected.index)}
                    className="bg-primary text-primary-foreground font-display text-[10px] py-1.5 px-4 rounded-lg glow-gold-sm">
                    {selected.data.power > 0 ? '⚔️ Fight & Claim' : '✋ Claim'}
                  </motion.button>
                </div>
              </div>
            )}

            {selected.kind === 'player' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">🏰</span>
                  <div>
                    <h3 className="font-display text-sm text-foreground">{selected.data.village.name}</h3>
                    <p className="text-[10px] text-muted-foreground">{selected.data.profile.display_name} • Lv.{selected.data.village.level}</p>
                  </div>
                </div>
                {selected.data.village.user_id !== user?.id && (
                  <div className="flex gap-2">
                    <motion.button whileTap={{ scale: 0.95 }}
                      className="flex-1 bg-primary/20 text-primary font-display text-[10px] py-1.5 rounded-lg">
                      📨 Message
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        const hasTroops = Object.values(army).some(v => v > 0);
                        if (!hasTroops) { toast.error('You need troops to attack!'); return; }
                        attackTarget(selected.data.village.name, selected.data.village.level * 30);
                        toast.success('Attack launched!');
                        setSelected(null);
                      }}
                      className="flex-1 bg-destructive/20 text-destructive font-display text-[10px] py-1.5 rounded-lg">
                      ⚔️ Attack
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
