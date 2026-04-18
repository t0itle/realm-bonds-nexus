import { useMemo } from 'react';
import { SVGOverlay } from 'react-leaflet';
import L from 'leaflet';

type Props = {
  mapHeight: number;
  mapWidth: number;
};

/**
 * Hand-drawn ouroboros serpent encircling the map boundary.
 * Rendered as an SVG overlay so we get crisp ink-on-parchment styling
 * with a proper body, scales, head, eye, fangs, and a tail being bitten.
 */
export default function OuroborosBoundary({ mapHeight, mapWidth }: Props) {
  const inset = 18;
  const w = mapWidth;
  const h = mapHeight;

  // Build a rounded-rectangle centerline path that hugs the map edge.
  const bodyPath = useMemo(() => {
    const r = Math.min(w, h) * 0.12; // corner radius
    const left = inset;
    const right = w - inset;
    const top = inset;
    const bottom = h - inset;
    const cx = w / 2;

    // Start just right-of-center on the top edge (where the head will bite the tail)
    // and travel clockwise back to just left-of-center.
    const startX = cx + 26;
    const endX = cx - 26;

    return [
      `M ${startX} ${top}`,
      `L ${right - r} ${top}`,
      `Q ${right} ${top} ${right} ${top + r}`,
      `L ${right} ${bottom - r}`,
      `Q ${right} ${bottom} ${right - r} ${bottom}`,
      `L ${left + r} ${bottom}`,
      `Q ${left} ${bottom} ${left} ${bottom - r}`,
      `L ${left} ${top + r}`,
      `Q ${left} ${top} ${left + r} ${top}`,
      `L ${endX} ${top}`,
    ].join(' ');
  }, [w, h]);

  // Tail tip (where the head bites)
  const tailTip = { x: w / 2 - 26, y: inset };
  // Head sits just to the right of center on the top edge, biting leftward toward tail
  const headCx = w / 2 + 8;
  const headCy = inset;
  const headR = 16;

  const bounds = L.latLngBounds([0, 0], [-h, w]);
  const viewBox = `0 0 ${w} ${h}`;

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
        <pattern id="snake-scales" x="0" y="0" width="14" height="10" patternUnits="userSpaceOnUse">
          <path
            d="M 0 5 Q 3.5 0 7 5 Q 10.5 10 14 5"
            fill="none"
            stroke="hsl(var(--foreground))"
            strokeWidth="0.6"
            opacity="0.55"
          />
        </pattern>
        <filter id="snake-ink" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="1.2" />
        </filter>
      </defs>

      {/* Soft drop shadow underbelly */}
      <path
        d={bodyPath}
        fill="none"
        stroke="hsl(var(--foreground) / 0.18)"
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(2, 3)"
      />

      {/* Body fill (warm sepia) */}
      <path
        d={bodyPath}
        fill="none"
        stroke="hsl(35 55% 42%)"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.92"
      />

      {/* Belly highlight */}
      <path
        d={bodyPath}
        fill="none"
        stroke="hsl(40 70% 78%)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
        transform="translate(0, 1.5)"
      />

      {/* Scale pattern overlay */}
      <path
        d={bodyPath}
        fill="none"
        stroke="url(#snake-scales)"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />

      {/* Ink outline */}
      <path
        d={bodyPath}
        fill="none"
        stroke="hsl(25 60% 18%)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
        filter="url(#snake-ink)"
      />

      {/* Tail tip (tapered) — peeks out from under the head */}
      <path
        d={`M ${tailTip.x} ${tailTip.y} Q ${tailTip.x - 14} ${tailTip.y - 4} ${tailTip.x - 22} ${tailTip.y + 2}`}
        fill="none"
        stroke="hsl(35 55% 42%)"
        strokeWidth="10"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d={`M ${tailTip.x} ${tailTip.y} Q ${tailTip.x - 14} ${tailTip.y - 4} ${tailTip.x - 22} ${tailTip.y + 2}`}
        fill="none"
        stroke="hsl(25 60% 18%)"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* HEAD — diamond/arrow shape biting the tail */}
      <g transform={`translate(${headCx}, ${headCy})`}>
        {/* head shadow */}
        <path
          d="M 2 3 L 22 -6 L 14 0 L 22 6 Z"
          fill="hsl(var(--foreground) / 0.22)"
        />
        {/* main head */}
        <path
          d="M 0 0 L 20 -8 Q 26 0 20 8 Z"
          fill="hsl(35 60% 38%)"
          stroke="hsl(25 60% 16%)"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        {/* head highlight */}
        <path
          d="M 2 -1 L 18 -6 Q 22 -3 20 0"
          fill="none"
          stroke="hsl(40 70% 78%)"
          strokeWidth="1.2"
          opacity="0.7"
        />
        {/* eye */}
        <circle cx="14" cy="-2" r="2.2" fill="hsl(50 90% 88%)" stroke="hsl(25 60% 16%)" strokeWidth="0.7" />
        <ellipse cx="14" cy="-2" rx="0.8" ry="1.6" fill="hsl(25 60% 12%)" />
        {/* fangs biting down on the tail */}
        <path d="M 4 2 L 2 8" stroke="hsl(50 95% 92%)" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M 7 3 L 6 9" stroke="hsl(50 95% 92%)" strokeWidth="1.2" strokeLinecap="round" />
        {/* nostril */}
        <circle cx="22" cy="-1" r="0.6" fill="hsl(25 60% 12%)" />
      </g>

      {/* Mystical glow dots at corners — runic accent */}
      {[
        [inset + 6, inset + 6],
        [w - inset - 6, inset + 6],
        [w - inset - 6, h - inset - 6],
        [inset + 6, h - inset - 6],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="3" fill="hsl(var(--primary) / 0.4)" />
          <circle cx={x} cy={y} r="1.2" fill="hsl(var(--primary))" />
        </g>
      ))}
    </SVGOverlay>
  );
}
