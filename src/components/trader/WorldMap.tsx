import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTrader, RealmTown } from '@/hooks/useTrader';
import { toast } from 'sonner';

const MAP_W = 1000;
const MAP_H = 1000;

const TYPE_RADIUS: Record<string, number> = {
  capital: 14,
  city: 11,
  town: 8,
  village: 6,
  outpost: 5,
};

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default function WorldMap({ onTownSelect }: { onTownSelect: () => void }) {
  const { realms, towns, profile, realmById, townById, travelTo } = useTrader();
  const currentTown = profile?.current_town_id ? townById(profile.current_town_id) : undefined;

  // Build a soft "realm aura" — a translucent disc behind each realm's capital
  const realmAuras = useMemo(() => realms.filter(r => !r.is_central).map(r => ({
    id: r.id,
    cx: r.capital_x,
    cy: r.capital_y,
    color: r.color,
    sigil: r.sigil,
    name: r.name,
  })), [realms]);

  const handleTravel = async (town: RealmTown) => {
    if (!profile) return;
    if (town.id === profile.current_town_id) {
      onTownSelect();
      return;
    }
    const from = currentTown;
    const dist = from ? distance(from, town) : 0;
    const cost = Math.max(2, Math.round(dist * 0.05));
    if (profile.gold < cost) {
      toast.error(`Need ${cost}g to travel that far`);
      return;
    }
    await travelTo(town.id);
    toast.success(`Arrived at ${town.name} — ${cost}g spent on the road`);
    onTownSelect();
  };

  return (
    <div className="w-full h-full bg-[hsl(var(--map-bg-1))] relative overflow-hidden">
      {/* Parchment ambient glow */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-radial from-primary/5 via-transparent to-transparent" />

      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="w-full h-full"
        style={{ touchAction: 'manipulation' }}
      >
        <defs>
          <radialGradient id="desert" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(38, 35%, 28%)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(38, 35%, 12%)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(42, 80%, 55%)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(42, 80%, 55%)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* The Wound (desert around Khar-Anum) */}
        <circle cx={500} cy={500} r={280} fill="url(#desert)" />

        {/* The Crescent — a faint dotted arc connecting the 8 realms */}
        <path
          d={`M 220 200 Q 500 -50 780 220 M 220 200 Q 100 500 320 820 M 780 220 Q 900 500 680 800 M 320 820 Q 500 950 680 800`}
          fill="none"
          stroke="hsl(var(--primary) / 0.18)"
          strokeWidth="1.5"
          strokeDasharray="4 8"
        />

        {/* Realm auras */}
        {realmAuras.map(a => (
          <g key={a.id}>
            <circle cx={a.cx} cy={a.cy} r={70} fill={a.color} fillOpacity={0.08} />
            <circle cx={a.cx} cy={a.cy} r={45} fill={a.color} fillOpacity={0.12} />
          </g>
        ))}

        {/* Khar-Anum center glow */}
        <circle cx={500} cy={500} r={120} fill="url(#centerGlow)" />

        {/* Towns */}
        {towns.map(town => {
          const realm = realmById(town.realm_id);
          if (!realm) return null;
          const r = TYPE_RADIUS[town.town_type] || 6;
          const isCurrent = profile?.current_town_id === town.id;
          const isCapital = town.town_type === 'capital';
          return (
            <g
              key={town.id}
              transform={`translate(${town.x} ${town.y})`}
              className="cursor-pointer"
              onClick={() => handleTravel(town)}
            >
              {isCurrent && (
                <circle r={r + 8} fill="none" stroke="hsl(var(--primary))" strokeWidth="2">
                  <animate attributeName="r" values={`${r + 8};${r + 14};${r + 8}`} dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0;1" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle r={r + 2} fill="hsl(var(--background))" stroke={realm.color} strokeWidth="2" />
              <circle r={r} fill={realm.color} fillOpacity={0.7} />
              {isCapital && (
                <text textAnchor="middle" dy="4" fontSize="14" fill="hsl(var(--background))" style={{ fontWeight: 700 }}>
                  {realm.sigil}
                </text>
              )}
              {(isCapital || town.town_type === 'city' || isCurrent) && (
                <text
                  textAnchor="middle"
                  y={r + 16}
                  fontSize="12"
                  fill="hsl(var(--foreground))"
                  style={{ fontFamily: 'Cinzel, serif', fontWeight: 600, paintOrder: 'stroke', stroke: 'hsl(var(--background))', strokeWidth: 3, strokeLinejoin: 'round' }}
                >
                  {town.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 right-3 flex gap-1.5 overflow-x-auto pb-1">
        {realms.map(r => (
          <motion.div
            key={r.id}
            whileTap={{ scale: 0.95 }}
            className="flex-shrink-0 bg-card/80 backdrop-blur border border-border/60 rounded-lg px-2 py-1 flex items-center gap-1.5"
          >
            <span style={{ color: r.color }} className="text-base leading-none">{r.sigil}</span>
            <div>
              <p className="font-display text-[10px] text-foreground leading-tight">{r.name}</p>
              <p className="text-[8px] text-muted-foreground leading-tight">{r.aether}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}