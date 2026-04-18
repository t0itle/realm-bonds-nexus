import { useMemo } from 'react';
import { SVGOverlay } from 'react-leaflet';
import L from 'leaflet';

type Props = {
  mapHeight: number;
  mapWidth: number;
};

/**
 * Round, black-and-white hand-drawn ouroboros encircling the map.
 * Pure ink on parchment — no color, no glow. The serpent forms a perfect
 * circle inscribed in the map; head bites tail at the top.
 */
export default function OuroborosBoundary({ mapHeight, mapWidth }: Props) {
  const cx = mapWidth / 2;
  const cy = mapHeight / 2;
  // Inscribed circle: largest circle that fits inside the map
  const radius = Math.min(mapWidth, mapHeight) / 2 - Math.min(mapWidth, mapHeight) * 0.04;

  // Head sits at the top (12 o'clock) and bites the tail just to its left.
  // We draw the body as a near-full circle: from just-right-of-top, clockwise
  // back to just-left-of-top (where the tail sits in the head's mouth).
  const headAngle = -Math.PI / 2; // top
  const headOffset = 0.09; // radians of arc the head occupies
  const startAngle = headAngle + headOffset; // start just clockwise of head
  const endAngle = headAngle + 2 * Math.PI - headOffset * 0.4; // wrap around

  const bodyPath = useMemo(() => {
    const sx = cx + radius * Math.cos(startAngle);
    const sy = cy + radius * Math.sin(startAngle);
    const ex = cx + radius * Math.cos(endAngle);
    const ey = cy + radius * Math.sin(endAngle);
    // Sweep is large arc, clockwise
    return `M ${sx} ${sy} A ${radius} ${radius} 0 1 1 ${ex} ${ey}`;
  }, [cx, cy, radius, startAngle, endAngle]);

  // Tail tip: continues just past endAngle into the head's mouth
  const tailAngle = headAngle - headOffset * 0.6;
  const tailX = cx + radius * Math.cos(tailAngle);
  const tailY = cy + radius * Math.sin(tailAngle);
  // The tail tip extends slightly outward then curves into the mouth
  const tailMidX = cx + (radius + 4) * Math.cos(tailAngle - 0.04);
  const tailMidY = cy + (radius + 4) * Math.sin(tailAngle - 0.04);

  // Head position
  const headBaseX = cx + radius * Math.cos(startAngle);
  const headBaseY = cy + radius * Math.sin(startAngle);
  // Head points back toward the tail (counter-clockwise direction)
  const headTipAngle = startAngle - 0.18;
  const headTipX = cx + (radius - 1) * Math.cos(headTipAngle);
  const headTipY = cy + (radius - 1) * Math.sin(headTipAngle);

  // Outward normal at head base (for jaw thickness)
  const nx = Math.cos(startAngle);
  const ny = Math.sin(startAngle);

  // Scale tick marks along body — perpendicular hatches
  const scaleHatches = useMemo(() => {
    const hatches: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const arcSpan = endAngle - startAngle;
    const count = 96;
    const inkR1 = radius - 7;
    const inkR2 = radius + 7;
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const a = startAngle + arcSpan * t;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      // Skip a few near the head/tail
      if (i > count - 3 || i < 2) continue;
      hatches.push({
        x1: cx + inkR1 * cosA,
        y1: cy + inkR1 * sinA,
        x2: cx + inkR2 * cosA,
        y2: cy + inkR2 * sinA,
      });
    }
    return hatches;
  }, [cx, cy, radius, startAngle, endAngle]);

  // Belly line — thinner inner arc for the underside
  const bellyPath = useMemo(() => {
    const r = radius - 4;
    const sx = cx + r * Math.cos(startAngle + 0.02);
    const sy = cy + r * Math.sin(startAngle + 0.02);
    const ex = cx + r * Math.cos(endAngle - 0.02);
    const ey = cy + r * Math.sin(endAngle - 0.02);
    return `M ${sx} ${sy} A ${r} ${r} 0 1 1 ${ex} ${ey}`;
  }, [cx, cy, radius, startAngle, endAngle]);

  const bounds = L.latLngBounds([0, 0], [-mapHeight, mapWidth]);
  const viewBox = `0 0 ${mapWidth} ${mapHeight}`;

  // Ink colors — pure black on parchment cream (no theme tokens, this is hand-ink)
  const INK = '#1a1410';
  const INK_SOFT = '#2b211a';

  return (
    <SVGOverlay
      attributes={{
        viewBox,
        preserveAspectRatio: 'none',
        style: 'pointer-events: none;',
      }}
      bounds={bounds}
    >
      <defs>
        <filter id="ink-jitter" x="-2%" y="-2%" width="104%" height="104%">
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="11" />
          <feDisplacementMap in="SourceGraphic" scale="0.9" />
        </filter>
      </defs>

      {/* Outer body outline — thick ink */}
      <path
        d={bodyPath}
        fill="none"
        stroke={INK}
        strokeWidth="14"
        strokeLinecap="round"
        opacity="0.95"
        filter="url(#ink-jitter)"
      />

      {/* Inner hollow — leave the belly cream-colored */}
      <path
        d={bodyPath}
        fill="none"
        stroke="#f4e8cc"
        strokeWidth="9"
        strokeLinecap="round"
      />

      {/* Belly line (thin) */}
      <path
        d={bellyPath}
        fill="none"
        stroke={INK_SOFT}
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* Scale hatches across the body */}
      <g stroke={INK} strokeWidth="0.9" strokeLinecap="round" opacity="0.78">
        {scaleHatches.map((h, i) => (
          <line key={i} x1={h.x1} y1={h.y1} x2={h.x2} y2={h.y2} />
        ))}
      </g>

      {/* Crosshatch shading on outer back (every 4th hatch) */}
      <g stroke={INK} strokeWidth="0.6" strokeLinecap="round" opacity="0.5">
        {scaleHatches.filter((_, i) => i % 4 === 0).map((h, i) => {
          const mx = (h.x1 + h.x2) / 2;
          const my = (h.y1 + h.y2) / 2;
          return <line key={`cx-${i}`} x1={mx - 1.4} y1={my - 0.4} x2={mx + 1.4} y2={my + 0.4} />;
        })}
      </g>

      {/* Tail tip — tapered, sliding into the head's mouth */}
      <path
        d={`M ${tailMidX} ${tailMidY} Q ${tailX} ${tailY} ${headBaseX - nx * 2} ${headBaseY - ny * 2}`}
        fill="none"
        stroke={INK}
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.95"
      />
      <path
        d={`M ${tailMidX} ${tailMidY} Q ${tailX} ${tailY} ${headBaseX - nx * 2} ${headBaseY - ny * 2}`}
        fill="none"
        stroke="#f4e8cc"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* HEAD — diamond/arrow pointing toward tail */}
      {(() => {
        const upperJawX = headBaseX + nx * 9;
        const upperJawY = headBaseY + ny * 9;
        const lowerJawX = headBaseX - nx * 7;
        const lowerJawY = headBaseY - ny * 7;
        // Eye position: midway along head, offset outward
        const eyeX = (headTipX + headBaseX) / 2 + nx * 4;
        const eyeY = (headTipY + headBaseY) / 2 + ny * 4;

        return (
          <g>
            {/* Upper jaw / head dome */}
            <path
              d={`M ${headBaseX} ${headBaseY}
                  L ${upperJawX} ${upperJawY}
                  Q ${headTipX + nx * 4} ${headTipY + ny * 4} ${headTipX} ${headTipY}
                  Z`}
              fill={INK}
              stroke={INK}
              strokeWidth="1"
              strokeLinejoin="round"
            />
            {/* Lower jaw — biting down on tail */}
            <path
              d={`M ${headBaseX} ${headBaseY}
                  L ${lowerJawX} ${lowerJawY}
                  Q ${headTipX - nx * 1} ${headTipY - ny * 1} ${headTipX} ${headTipY}
                  Z`}
              fill={INK}
              stroke={INK}
              strokeWidth="1"
              strokeLinejoin="round"
            />
            {/* Highlight stripe on upper jaw */}
            <path
              d={`M ${headBaseX + nx * 2} ${headBaseY + ny * 2} Q ${(headTipX + headBaseX) / 2 + nx * 5} ${(headTipY + headBaseY) / 2 + ny * 5} ${headTipX + nx * 1} ${headTipY + ny * 1}`}
              fill="none"
              stroke="#f4e8cc"
              strokeWidth="0.8"
              opacity="0.5"
            />
            {/* Eye — white sclera with black pupil */}
            <circle cx={eyeX} cy={eyeY} r="2.4" fill="#f4e8cc" stroke={INK} strokeWidth="0.6" />
            <circle cx={eyeX + nx * 0.4} cy={eyeY + ny * 0.4} r="1.2" fill={INK} />
            {/* Fang gleam */}
            <line
              x1={headTipX + nx * 0.5}
              y1={headTipY + ny * 0.5}
              x2={headTipX - nx * 0.5}
              y2={headTipY - ny * 0.5}
              stroke="#f4e8cc"
              strokeWidth="0.6"
              opacity="0.6"
            />
          </g>
        );
      })()}
    </SVGOverlay>
  );
}
