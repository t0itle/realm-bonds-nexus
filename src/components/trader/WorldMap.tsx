import { useMemo, useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTrader, RealmTown } from '@/hooks/useTrader';
import { toast } from 'sonner';

const MAP_W = 1000;
const MAP_H = 1000;

const TYPE_RADIUS: Record<string, number> = {
  capital: 9,
  city: 7,
  town: 6,
  village: 4,
  outpost: 3,
};

// Biome by aether — drives terrain glyphs
const BIOME: Record<string, 'forest' | 'mountain' | 'coast' | 'tundra' | 'dune' | 'marsh' | 'volcano' | 'plain' | 'oasis'> = {
  Verdant: 'forest',
  Storm: 'mountain',
  Tide: 'coast',
  Frost: 'tundra',
  Dust: 'dune',
  Hollow: 'marsh',
  None: 'volcano', // Karzûl
  Ember: 'plain',
  Concord: 'oasis',
};

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Deterministic pseudo-random for stable glyph scatter
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

interface Glyph { x: number; y: number; kind: string; s: number; }

export default function WorldMap({ onTownSelect }: { onTownSelect: () => void }) {
  const { realms, towns, profile, realmById, townById, travelTo } = useTrader();
  const currentTown = profile?.current_town_id ? townById(profile.current_town_id) : undefined;

  // Pan + zoom
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const pinchRef = useRef<{ dist: number; k: number } | null>(null);

  // Center on current town first time it loads
  useEffect(() => {
    if (currentTown && view.k === 1 && view.x === 0 && view.y === 0) {
      setView({ x: MAP_W / 2 - currentTown.x, y: MAP_H / 2 - currentTown.y, k: 1.4 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTown?.id]);

  // Build realm regions: each realm gets a soft blob around its capital
  const regions = useMemo(() => realms.filter(r => !r.is_central).map(r => {
    const biome = BIOME[r.aether] || 'plain';
    return { id: r.id, name: r.name, x: r.capital_x, y: r.capital_y, color: r.color, biome, sigil: r.sigil, aether: r.aether };
  }), [realms]);

  // Scatter terrain glyphs per realm
  const glyphs = useMemo(() => {
    const out: (Glyph & { color: string })[] = [];
    regions.forEach((r, i) => {
      const rng = mulberry32(i * 9301 + 49297);
      const count = r.biome === 'volcano' ? 14 : 22;
      for (let n = 0; n < count; n++) {
        const angle = rng() * Math.PI * 2;
        const radius = 30 + rng() * 70;
        const x = r.x + Math.cos(angle) * radius;
        const y = r.y + Math.sin(angle) * radius;
        out.push({ x, y, kind: r.biome, s: 0.7 + rng() * 0.6, color: r.color });
      }
    });
    // central oasis dunes
    const rng = mulberry32(777);
    for (let n = 0; n < 60; n++) {
      const angle = rng() * Math.PI * 2;
      const radius = 60 + rng() * 200;
      out.push({ x: 500 + Math.cos(angle) * radius, y: 500 + Math.sin(angle) * radius, kind: 'sand', s: 0.6 + rng() * 0.5, color: '#a8895a' });
    }
    return out;
  }, [regions]);

  // Trade road paths between adjacent realms in the crescent + spokes to Khar-Anum
  const roads = useMemo(() => {
    const center = realms.find(r => r.is_central);
    if (!center) return [];
    const order = ['Drakkanmar', 'Halqaran', 'Olethros', 'Vehruun', 'Ysmir Vale', 'Ainwyrd', 'Karzûl', 'Sephar-Tul'];
    const ord = order.map(n => realms.find(r => r.name === n)).filter(Boolean) as typeof realms;
    const lines: { d: string }[] = [];
    // arc through realms
    for (let i = 0; i < ord.length - 1; i++) {
      const a = ord[i], b = ord[i + 1];
      const mx = (a.capital_x + b.capital_x) / 2;
      const my = (a.capital_y + b.capital_y) / 2;
      // bulge outward from center
      const dx = mx - 500, dy = my - 500;
      const len = Math.hypot(dx, dy) || 1;
      const cx = mx + (dx / len) * 30;
      const cy = my + (dy / len) * 30;
      lines.push({ d: `M ${a.capital_x} ${a.capital_y} Q ${cx} ${cy} ${b.capital_x} ${b.capital_y}` });
    }
    // spokes
    ord.forEach(r => {
      lines.push({ d: `M ${center.capital_x} ${center.capital_y} L ${r.capital_x} ${r.capital_y}` });
    });
    return lines;
  }, [realms]);

  const handleTravel = async (town: RealmTown) => {
    if (!profile) return;
    if (town.id === profile.current_town_id) {
      onTownSelect();
      return;
    }
    const from = currentTown;
    const d = from ? dist(from, town) : 0;
    const cost = Math.max(2, Math.round(d * 0.05));
    if (profile.gold < cost) {
      toast.error(`Need ${cost}g to travel that far`);
      return;
    }
    await travelTo(town.id);
    toast.success(`Arrived at ${town.name} — ${cost}g spent on the road`);
    onTownSelect();
  };

  // Touch / mouse handlers
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dxp = e.clientX - d.x;
    const dyp = e.clientY - d.y;
    // convert pixel delta to svg units (approx — viewBox 1000 over container width)
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = MAP_W / rect.width;
    setView(v => ({ ...v, x: d.vx + dxp * scale / v.k, y: d.vy + dyp * scale / v.k }));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setView(v => {
      const nk = Math.max(0.6, Math.min(4, v.k * (e.deltaY < 0 ? 1.15 : 0.87)));
      return { ...v, k: nk };
    });
  };

  // pinch zoom
  const touchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const onTouchStart = (e: React.TouchEvent) => {
    Array.from(e.touches).forEach(t => touchesRef.current.set(t.identifier, { x: t.clientX, y: t.clientY }));
    if (e.touches.length === 2) {
      const [a, b] = Array.from(e.touches);
      pinchRef.current = { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), k: view.k };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const [a, b] = Array.from(e.touches);
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const nk = Math.max(0.6, Math.min(4, pinchRef.current.k * (d / pinchRef.current.dist)));
      setView(v => ({ ...v, k: nk }));
    }
  };
  const onTouchEnd = () => { pinchRef.current = null; touchesRef.current.clear(); };

  const zoom = (factor: number) => setView(v => ({ ...v, k: Math.max(0.6, Math.min(4, v.k * factor)) }));
  const recenter = () => {
    if (currentTown) setView({ x: MAP_W / 2 - currentTown.x, y: MAP_H / 2 - currentTown.y, k: 1.6 });
  };

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#e8d4a0' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="w-full h-full select-none"
        style={{ touchAction: 'none', cursor: dragRef.current ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <defs>
          {/* Parchment paper */}
          <filter id="paper" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
            <feColorMatrix values="0 0 0 0 0.55  0 0 0 0 0.42  0 0 0 0 0.25  0 0 0 0.18 0" />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
          <filter id="rough">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="5" />
            <feDisplacementMap in="SourceGraphic" scale="3" />
          </filter>
          <filter id="ink" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="2" />
            <feDisplacementMap in="SourceGraphic" scale="1.2" />
          </filter>
          <radialGradient id="vignette" cx="50%" cy="50%" r="65%">
            <stop offset="60%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#3a2a14" stopOpacity="0.45" />
          </radialGradient>
          <radialGradient id="centerSun" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f6d77a" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#e8b85a" stopOpacity="0" />
          </radialGradient>
          <pattern id="seaHatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(0)">
            <path d="M 0 3 Q 1.5 1.5 3 3 T 6 3" stroke="#3d6982" strokeWidth="0.6" fill="none" opacity="0.55" />
          </pattern>
          <pattern id="dunePattern" patternUnits="userSpaceOnUse" width="14" height="6">
            <path d="M 0 5 Q 3.5 1 7 5 T 14 5" stroke="#a8895a" strokeWidth="0.5" fill="none" opacity="0.4" />
          </pattern>
        </defs>

        {/* Group that handles pan/zoom */}
        <g transform={`translate(${MAP_W/2} ${MAP_H/2}) scale(${view.k}) translate(${-MAP_W/2 + view.x} ${-MAP_H/2 + view.y})`}>
          {/* Base parchment */}
          <rect x={-200} y={-200} width={MAP_W + 400} height={MAP_H + 400} fill="#e8d4a0" />
          <rect x={-200} y={-200} width={MAP_W + 400} height={MAP_H + 400} fill="#a07642" filter="url(#paper)" opacity="0.5" />

          {/* The Sundered Sea — wraps around outside of the crescent (east side) */}
          <path
            d="M 1000 0 L 1000 1000 L 850 1000 Q 720 850 720 500 Q 720 150 850 0 Z"
            fill="#bfd4dc"
            opacity="0.9"
          />
          <path
            d="M 1000 0 L 1000 1000 L 850 1000 Q 720 850 720 500 Q 720 150 850 0 Z"
            fill="url(#seaHatch)"
          />

          {/* Inner desert wilderness — The Wound */}
          <circle cx={500} cy={500} r={260} fill="#dcb87a" opacity="0.6" filter="url(#rough)" />
          <circle cx={500} cy={500} r={220} fill="url(#dunePattern)" />
          <circle cx={500} cy={500} r={180} fill="url(#centerSun)" />

          {/* Realm regions (organic blobs, ink-styled) */}
          {regions.map(r => (
            <g key={r.id}>
              <circle cx={r.x} cy={r.y} r={95} fill={r.color} fillOpacity={0.25} filter="url(#rough)" />
              <circle cx={r.x} cy={r.y} r={95} fill="none" stroke={r.color} strokeOpacity={0.55} strokeWidth={1.2} strokeDasharray="2 3" filter="url(#ink)" />
            </g>
          ))}

          {/* Trade roads */}
          {roads.map((rd, i) => (
            <path key={i} d={rd.d} fill="none" stroke="#5a3a1a" strokeWidth={1} strokeOpacity={0.45} strokeDasharray="3 4" filter="url(#ink)" />
          ))}

          {/* Crescent boundary inkline */}
          <path
            d="M 670 206 Q 580 80 476 161 Q 360 180 286 236 Q 180 290 175 401 Q 150 500 175 599 Q 180 710 286 764 Q 360 820 476 839 Q 580 920 670 794"
            fill="none"
            stroke="#4a2e14"
            strokeWidth={1.5}
            strokeOpacity={0.4}
            strokeDasharray="6 4"
            filter="url(#ink)"
          />

          {/* Terrain glyphs */}
          {glyphs.map((g, i) => (
            <Glyph key={i} g={g} />
          ))}

          {/* Towns */}
          {towns.map(town => {
            const realm = realmById(town.realm_id);
            if (!realm) return null;
            const r = TYPE_RADIUS[town.town_type] || 5;
            const isCurrent = profile?.current_town_id === town.id;
            const isCapital = town.town_type === 'capital';
            return (
              <g
                key={town.id}
                transform={`translate(${town.x} ${town.y})`}
                className="cursor-pointer"
                onClick={(e) => { e.stopPropagation(); handleTravel(town); }}
              >
                {isCurrent && (
                  <circle r={r + 9} fill="none" stroke="#7a3b1c" strokeWidth={1.5}>
                    <animate attributeName="r" values={`${r + 9};${r + 16};${r + 9}`} dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1;0.1;1" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                )}
                {isCapital ? (
                  // Tower icon for capitals
                  <g>
                    <path d={`M -6 4 L -6 -4 L -3 -8 L 0 -4 L 3 -8 L 6 -4 L 6 4 Z`} fill="#3a2410" stroke="#3a2410" strokeWidth="0.5" filter="url(#ink)" />
                    <rect x={-1} y={-1} width={2} height={5} fill="#e8d4a0" />
                  </g>
                ) : town.town_type === 'town' || town.town_type === 'city' ? (
                  <g>
                    <rect x={-r} y={-r/2} width={r*2} height={r} fill="#3a2410" filter="url(#ink)" />
                    <path d={`M ${-r} ${-r/2} L 0 ${-r} L ${r} ${-r/2} Z`} fill="#5a3418" />
                  </g>
                ) : (
                  // Village dot
                  <circle r={r} fill="#3a2410" stroke={realm.color} strokeWidth={0.8} filter="url(#ink)" />
                )}
                {(isCapital || isCurrent) && (
                  <text
                    textAnchor="middle"
                    y={-r - 6}
                    fontSize={isCapital ? 11 : 9}
                    fill="#2a1808"
                    style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, letterSpacing: 0.5, paintOrder: 'stroke', stroke: '#e8d4a0', strokeWidth: 2.5, strokeLinejoin: 'round' }}
                  >
                    {town.name}
                  </text>
                )}
                {!isCapital && !isCurrent && view.k > 1.8 && (
                  <text
                    textAnchor="middle"
                    y={r + 9}
                    fontSize={7}
                    fill="#3a2410"
                    style={{ fontFamily: 'Cinzel, serif', fontWeight: 500, paintOrder: 'stroke', stroke: '#e8d4a0', strokeWidth: 2, strokeLinejoin: 'round' }}
                  >
                    {town.name}
                  </text>
                )}
              </g>
            );
          })}

          {/* Khar-Anum label always visible */}
          <text x={500} y={478} textAnchor="middle" fontSize={13} fill="#5a2818" style={{ fontFamily: 'Cinzel, serif', fontWeight: 900, letterSpacing: 2, paintOrder: 'stroke', stroke: '#e8d4a0', strokeWidth: 3 }}>
            KHAR · ANUM
          </text>
          <text x={500} y={528} textAnchor="middle" fontSize={7} fill="#7a4818" style={{ fontFamily: 'Cinzel, serif', letterSpacing: 4 }}>
            THE FREE CITY
          </text>

          {/* Realm names — bold display labels */}
          {regions.map(r => (
            <g key={`lbl-${r.id}`} transform={`translate(${r.x} ${r.y - 70})`}>
              <text textAnchor="middle" fontSize={11} fill="#2a1808" style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, letterSpacing: 2.5, paintOrder: 'stroke', stroke: '#e8d4a0', strokeWidth: 3 }}>
                {r.name.toUpperCase()}
              </text>
              <text textAnchor="middle" y={11} fontSize={7} fill="#7a4818" style={{ fontFamily: 'Cinzel, serif', letterSpacing: 3 }}>
                ◈ {r.aether} ◈
              </text>
            </g>
          ))}

          {/* Compass rose */}
          <g transform="translate(920 920)">
            <circle r={28} fill="#e8d4a0" stroke="#3a2410" strokeWidth={0.8} filter="url(#ink)" />
            <path d="M 0 -22 L 4 0 L 0 22 L -4 0 Z" fill="#3a2410" />
            <path d="M -22 0 L 0 -4 L 22 0 L 0 4 Z" fill="#3a2410" opacity="0.7" />
            <text y={-30} textAnchor="middle" fontSize={9} fill="#2a1808" style={{ fontFamily: 'Cinzel, serif', fontWeight: 700 }}>N</text>
          </g>

          {/* Sea label */}
          <text x={870} y={500} textAnchor="middle" fontSize={14} fill="#2d4858" style={{ fontFamily: 'Cinzel, serif', fontWeight: 600, letterSpacing: 6, fontStyle: 'italic' }} transform="rotate(-90 870 500)">
            THE SUNDERED SEA
          </text>
        </g>

        {/* Vignette overlay (not transformed) */}
        <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="url(#vignette)" pointerEvents="none" />
      </svg>

      {/* Floating zoom controls */}
      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        <button onClick={() => zoom(1.25)} className="w-9 h-9 rounded-md bg-card/85 border border-border text-foreground font-display text-lg shadow">+</button>
        <button onClick={() => zoom(0.8)} className="w-9 h-9 rounded-md bg-card/85 border border-border text-foreground font-display text-lg shadow">−</button>
        <button onClick={recenter} className="w-9 h-9 rounded-md bg-card/85 border border-border text-foreground text-base shadow">⊙</button>
      </div>

      {/* Realm legend */}
      <div className="absolute bottom-3 left-3 right-3 flex gap-1.5 overflow-x-auto pb-1">
        {realms.map(r => (
          <motion.div
            key={r.id}
            whileTap={{ scale: 0.95 }}
            className="flex-shrink-0 bg-card/85 backdrop-blur border border-border rounded-md px-2 py-1 flex items-center gap-1.5"
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

function Glyph({ g }: { g: { x: number; y: number; kind: string; s: number; color: string } }) {
  const t = `translate(${g.x} ${g.y}) scale(${g.s})`;
  switch (g.kind) {
    case 'forest':
      return (
        <g transform={t}>
          <path d="M 0 3 L -4 3 L 0 -6 L 4 3 Z M 0 0 L -3 0 L 0 -8 L 3 0 Z" fill="#2d4a1c" opacity="0.8" />
        </g>
      );
    case 'mountain':
      return (
        <g transform={t}>
          <path d="M -6 4 L 0 -7 L 6 4 Z" fill="#5a4a3a" stroke="#2a1808" strokeWidth="0.5" />
          <path d="M -2 -1 L 0 -7 L 2 -1 Z" fill="#fff" opacity="0.5" />
        </g>
      );
    case 'tundra':
      return (
        <g transform={t}>
          <path d="M -5 3 L 0 -5 L 5 3 Z" fill="#cfd8dc" stroke="#5a6e78" strokeWidth="0.4" />
        </g>
      );
    case 'dune':
    case 'sand':
      return (
        <g transform={t}>
          <path d="M -5 1 Q 0 -3 5 1" fill="none" stroke={g.color} strokeWidth="0.7" opacity="0.7" />
        </g>
      );
    case 'marsh':
      return (
        <g transform={t}>
          <ellipse cx={0} cy={0} rx={4} ry={1.5} fill="#3a4a3a" opacity="0.5" />
          <path d="M -2 0 L -2 -3 M 0 0 L 0 -4 M 2 0 L 2 -2.5" stroke="#2d3a2a" strokeWidth="0.6" />
        </g>
      );
    case 'volcano':
      return (
        <g transform={t}>
          <path d="M -6 4 L -2 -5 L 2 -5 L 6 4 Z" fill="#3a1a0c" stroke="#1a0a04" strokeWidth="0.5" />
          <path d="M -1 -5 Q 0 -9 1 -5" fill="#c44d1c" />
        </g>
      );
    case 'coast':
      return (
        <g transform={t}>
          <path d="M -5 0 Q -2.5 -2 0 0 T 5 0" fill="none" stroke="#3d6982" strokeWidth="0.7" />
          <path d="M -5 2 Q -2.5 0 0 2 T 5 2" fill="none" stroke="#3d6982" strokeWidth="0.5" />
        </g>
      );
    case 'plain':
      return (
        <g transform={t}>
          <path d="M -3 1 L -3 -2 M 0 1 L 0 -3 M 3 1 L 3 -2" stroke="#7a6238" strokeWidth="0.6" />
        </g>
      );
    case 'oasis':
      return (
        <g transform={t}>
          <circle r={2} fill="#4a8a5a" />
          <path d="M -2 0 L -2 -3 M 0 -1 L 0 -4 M 2 0 L 2 -3" stroke="#2d4a1c" strokeWidth="0.6" />
        </g>
      );
    default:
      return null;
  }
}
