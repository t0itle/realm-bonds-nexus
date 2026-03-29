import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame, TroopType } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Virtual world coordinates (large logical space)
const MAP_SIZE = 200000;

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
    x: 5000 + Math.random() * (MAP_SIZE - 10000),
    y: 5000 + Math.random() * (MAP_SIZE - 10000),
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

  // Camera: center is world coordinate the viewport is looking at
  // pixelsPerUnit: how many screen pixels per world unit
  const [camera, setCamera] = useState(() => ({ cx: 100000, cy: 100000, ppu: 0.003 }));
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const lastTouchDist = useRef<number | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 400, h: 600 });

  // Track container size safely via effect instead of reading ref during render
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Convert world coord to screen pixel
  const worldToScreen = useCallback((wx: number, wy: number) => {
    return {
      sx: (wx - camera.cx) * camera.ppu + containerSize.w / 2,
      sy: (wy - camera.cy) * camera.ppu + containerSize.h / 2,
    };
  }, [camera, containerSize]);

  // Check if a world point is visible with margin
  const isVisible = useCallback((wx: number, wy: number, margin = 60) => {
    const { sx, sy } = worldToScreen(wx, wy);
    return sx > -margin && sx < containerSize.w + margin && sy > -margin && containerSize.h + margin > sy;
  }, [worldToScreen, containerSize]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-map-item]')) return;
    dragStart.current = { x: e.clientX, y: e.clientY, cx: camera.cx, cy: camera.cy };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [camera]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setCamera(prev => ({
      ...prev,
      cx: dragStart.current!.cx - dx / prev.ppu,
      cy: dragStart.current!.cy - dy / prev.ppu,
    }));
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
      setCamera(prev => ({ ...prev, ppu: Math.max(0.0005, Math.min(0.05, prev.ppu * scale)) }));
      lastTouchDist.current = d;
    }
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.85 : 1.18;
    setCamera(prev => ({ ...prev, ppu: Math.max(0.0005, Math.min(0.05, prev.ppu * factor)) }));
  }, []);

  const getPlayerPos = (id: string, index: number) => {
    const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return { x: 80000 + (hash * 1300 + index * 13700) % 40000, y: 80000 + (hash * 1700 + index * 17300) % 40000 };
  };

  const goHome = useCallback(() => {
    setCamera({ cx: 100000, cy: 100000, ppu: 0.003 });
  }, []);

  const handleInvestigate = useCallback((event: WorldEvent, index: number) => {
    if (event.claimed) return;
    const hasTroops = Object.values(army).some(v => v > 0);
    if (event.power > 0 && !hasTroops) { toast.error('You need troops to investigate dangerous events!'); return; }
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

  // Compute icon sizes based on zoom
  const iconSize = Math.max(24, Math.min(64, camera.ppu * 8000));
  const fontSize = Math.max(9, Math.min(14, camera.ppu * 3000));
  const eventSize = Math.max(20, Math.min(48, camera.ppu * 6000));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Map header */}
      <div className="px-3 pt-2 pb-1 flex items-center justify-between">
        <h2 className="font-display text-sm text-foreground text-shadow-gold">World Map</h2>
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
          <span>⚔️{power.attack} 🛡️{power.defense}</span>
          <span>×{(camera.ppu * 1000).toFixed(1)}</span>
        </div>
      </div>

      {/* Pannable map */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing touch-none"
        style={{ background: 'linear-gradient(135deg, hsl(216 28% 5%), hsl(216 28% 10%), hsl(216 25% 7%))' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onWheel={handleWheel}
      >
        {/* Grid lines rendered as screen-space SVG */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
          {(() => {
            const w = containerSize.w;
            const h = containerSize.h;
            if (w === 0 || h === 0) return null;
            const gridStep = camera.ppu > 0.01 ? 10000 : camera.ppu > 0.003 ? 20000 : camera.ppu > 0.001 ? 50000 : 100000;
            const lines: JSX.Element[] = [];
            const startX = Math.floor((camera.cx - w / 2 / camera.ppu) / gridStep) * gridStep;
            const endX = camera.cx + w / 2 / camera.ppu;
            const startY = Math.floor((camera.cy - h / 2 / camera.ppu) / gridStep) * gridStep;
            const endY = camera.cy + h / 2 / camera.ppu;
            for (let gx = startX; gx <= endX; gx += gridStep) {
              const { sx } = worldToScreen(gx, 0);
              lines.push(
                <line key={`gx-${gx}`} x1={sx} y1={0} x2={sx} y2={h} stroke="hsl(42 72% 52% / 0.08)" strokeWidth={1} />,
              );
              lines.push(
                <text key={`lx-${gx}`} x={sx + 4} y={14} fill="hsl(42 72% 52% / 0.3)" fontSize={10} fontFamily="Inter">{(gx / 1000).toFixed(0)}k</text>
              );
            }
            for (let gy = startY; gy <= endY; gy += gridStep) {
              const { sy } = worldToScreen(0, gy);
              lines.push(
                <line key={`gy-${gy}`} x1={0} y1={sy} x2={w} y2={sy} stroke="hsl(42 72% 52% / 0.08)" strokeWidth={1} />,
              );
              lines.push(
                <text key={`ly-${gy}`} x={4} y={sy - 4} fill="hsl(42 72% 52% / 0.3)" fontSize={10} fontFamily="Inter">{(gy / 1000).toFixed(0)}k</text>
              );
            }
            return lines;
          })()}
        </svg>

        {/* NPC territory circles */}
        {NPC_REALMS.map(realm => {
          const { sx, sy } = worldToScreen(realm.x, realm.y);
          const r = realm.territory * camera.ppu;
          if (r < 3) return null; // too small to see
          const borderColor = realm.type === 'hostile' ? 'hsl(0 72% 50% / 0.15)' : realm.type === 'friendly' ? 'hsl(130 45% 40% / 0.15)' : 'hsl(216 12% 50% / 0.15)';
          return (
            <div
              key={`t-${realm.id}`}
              className="absolute rounded-full pointer-events-none"
              style={{
                left: sx - r, top: sy - r, width: r * 2, height: r * 2,
                background: `radial-gradient(circle, ${borderColor}, transparent 70%)`,
              }}
            />
          );
        })}

        {/* NPC Realms */}
        {NPC_REALMS.map(realm => {
          if (!isVisible(realm.x, realm.y, 100)) return null;
          const { sx, sy } = worldToScreen(realm.x, realm.y);
          return (
            <button
              key={realm.id}
              data-map-item
              onClick={(e) => { e.stopPropagation(); setSelected({ kind: 'npc', data: realm }); }}
              className="absolute flex flex-col items-center z-10 hover:z-20"
              style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)' }}
            >
              <div className={`rounded-full ${TYPE_COLORS[realm.type]} flex items-center justify-center shadow-lg border-2 border-background/30`}
                style={{ width: iconSize, height: iconSize, fontSize: iconSize * 0.5 }}>
                {realm.emoji}
              </div>
              {iconSize > 28 && (
                <div className="text-center bg-background/80 rounded mt-0.5 px-1.5 py-0.5">
                  <p className="font-display text-foreground leading-tight whitespace-nowrap" style={{ fontSize: Math.max(8, fontSize - 2) }}>{realm.name}</p>
                  <p className="text-muted-foreground" style={{ fontSize: Math.max(7, fontSize - 3) }}>⚔️{realm.power}</p>
                </div>
              )}
              {realm.type === 'hostile' && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-destructive animate-pulse border border-background" />
              )}
            </button>
          );
        })}

        {/* Events */}
        {events.map((event, i) => {
          if (event.claimed) return null;
          if (!isVisible(event.x, event.y, 60)) return null;
          const { sx, sy } = worldToScreen(event.x, event.y);
          return (
            <button
              key={event.id}
              data-map-item
              onClick={(e) => { e.stopPropagation(); setSelected({ kind: 'event', data: event, index: i }); }}
              className={`absolute z-20 rounded-full border-2 ${EVENT_COLORS[event.type]} flex items-center justify-center shadow-md animate-float`}
              style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)', width: eventSize, height: eventSize, fontSize: eventSize * 0.5, animationDelay: `${i * 0.3}s` }}
            >
              {event.emoji}
            </button>
          );
        })}

        {/* Player villages */}
        {allVillages.map((pv, i) => {
          const pos = getPlayerPos(pv.village.id, i);
          if (!isVisible(pos.x, pos.y, 80)) return null;
          const { sx, sy } = worldToScreen(pos.x, pos.y);
          const isMe = pv.village.user_id === user?.id;
          return (
            <button
              key={pv.village.id}
              data-map-item
              onClick={(e) => { e.stopPropagation(); setSelected({ kind: 'player', data: pv }); }}
              className="absolute z-30 flex flex-col items-center hover:z-40"
              style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)' }}
            >
              <div className={`rounded-lg flex items-center justify-center shadow-lg ${
                isMe ? 'bg-primary animate-pulse-gold ring-2 ring-primary/50' : 'bg-secondary border border-border'
              }`} style={{ width: iconSize * 0.9, height: iconSize * 0.9, fontSize: iconSize * 0.45 }}>🏰</div>
              {iconSize > 28 && (
                <div className="text-center bg-background/80 rounded mt-0.5 px-1 py-0.5">
                  <p className="font-display text-foreground whitespace-nowrap" style={{ fontSize: Math.max(7, fontSize - 2) }}>{isMe ? '⭐ You' : pv.profile.display_name}</p>
                  <p className="text-muted-foreground" style={{ fontSize: Math.max(6, fontSize - 3) }}>Lv.{pv.village.level}</p>
                </div>
              )}
            </button>
          );
        })}

        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-50">
          <button onClick={() => setCamera(prev => ({ ...prev, ppu: Math.min(0.05, prev.ppu * 1.5) }))}
            className="w-8 h-8 game-panel border-glow rounded-lg flex items-center justify-center text-foreground text-sm font-bold">+</button>
          <button onClick={() => setCamera(prev => ({ ...prev, ppu: Math.max(0.0005, prev.ppu / 1.5) }))}
            className="w-8 h-8 game-panel border-glow rounded-lg flex items-center justify-center text-foreground text-sm font-bold">−</button>
          <button onClick={goHome}
            className="w-8 h-8 game-panel border-glow rounded-lg flex items-center justify-center text-foreground text-[9px]">⌂</button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg p-2 space-y-1 text-[8px] z-50 border border-border">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-destructive" /><span className="text-foreground">Hostile</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-muted-foreground" /><span className="text-foreground">Neutral</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-food" /><span className="text-foreground">Friendly</span></div>
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
