type RenderCell = {
  height: number;
  stateId: number;
};

type RenderState = {
  id: number;
  color: string;
};

type Vertex = [number, number];

type Rgb = { r: number; g: number; b: number };

// ── Parchment palette (Tolkien / classic D&D cartography) ──
const PARCHMENT_LIGHT: Rgb = { r: 244, g: 230, b: 196 };
const PARCHMENT_BASE: Rgb = { r: 234, g: 215, b: 170 };
const PARCHMENT_DARK: Rgb = { r: 210, g: 184, b: 134 };
const INK: Rgb = { r: 78, g: 52, b: 28 };
const INK_SOFT: Rgb = { r: 120, g: 84, b: 48 };
const OCEAN_PAPER: Rgb = { r: 198, g: 214, b: 218 };
const OCEAN_PAPER_DEEP: Rgb = { r: 168, g: 192, b: 200 };
const FOREST_INK: Rgb = { r: 64, g: 86, b: 52 };
const MOUNTAIN_INK: Rgb = { r: 70, g: 56, b: 44 };

export function buildDetailedAzgaarMapImage(
  cells: RenderCell[],
  states: RenderState[],
  vertices: number[][],
  cellVertices: number[][],
  mapWidth: number,
  mapHeight: number,
): string {
  const scale = getRenderScale(mapWidth, mapHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(mapWidth * scale);
  canvas.height = Math.ceil(mapHeight * scale);

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // ── 1. Parchment background ──
  drawParchmentBackground(ctx, mapWidth, mapHeight);

  const polygons = cellVertices.map((indices) => resolvePolygon(indices, vertices));
  const stateColors = new Map<number, Rgb>(states.map((s) => [s.id, hexToRgb(s.color)]));

  // ── 2. Ocean fill (paper tone, varies subtly with depth) ──
  for (let i = 0; i < cells.length; i += 1) {
    const poly = polygons[i];
    if (!poly) continue;
    const cell = cells[i];
    if (cell.stateId !== 0) continue;
    const depth = 1 - normalize(cell.height, 0, 20);
    tracePolygon(ctx, poly);
    ctx.fillStyle = rgbToCss(mixRgb(OCEAN_PAPER, OCEAN_PAPER_DEEP, depth));
    ctx.fill();
  }

  // ── 3. Land fill — parchment cream + faint state-color wash ──
  for (let i = 0; i < cells.length; i += 1) {
    const poly = polygons[i];
    if (!poly) continue;
    const cell = cells[i];
    if (cell.stateId === 0) continue;

    const stateRgb = stateColors.get(cell.stateId) ?? PARCHMENT_BASE;
    // Parchment base, then very light tint of state color (~15%), then height shading
    const base = mixRgb(PARCHMENT_BASE, stateRgb, 0.18);
    const elev = normalize(cell.height, 20, 74);
    const shaded = mixRgb(base, PARCHMENT_DARK, 0.25 - elev * 0.15);
    const lit = mixRgb(shaded, PARCHMENT_LIGHT, elev * 0.35);

    tracePolygon(ctx, poly);
    ctx.fillStyle = rgbToCss(lit);
    ctx.fill();
  }

  // Build edge maps once for borders + coastline
  const edgeKey = (a: Vertex, b: Vertex) => {
    const k1 = `${a[0].toFixed(3)},${a[1].toFixed(3)}`;
    const k2 = `${b[0].toFixed(3)},${b[1].toFixed(3)}`;
    return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
  };

  // ── 4. Dotted depth-line coastline shading (classic cartography) ──
  drawCoastalDepthLines(ctx, cells, polygons, edgeKey, mapWidth, mapHeight);

  // ── 5. Coastline — slightly jittered sepia ink ──
  ctx.strokeStyle = rgbaToCss(INK, 0.85);
  ctx.lineWidth = 1.4 / scale;
  const coastEdges: Array<[Vertex, Vertex]> = [];
  {
    const owner = new Map<string, number>();
    for (let i = 0; i < cells.length; i++) {
      const poly = polygons[i];
      if (!poly) continue;
      for (let v = 0; v < poly.length; v++) {
        const a = poly[v];
        const b = poly[(v + 1) % poly.length];
        const key = edgeKey(a, b);
        const other = owner.get(key);
        if (other === undefined) owner.set(key, i);
        else {
          const landA = cells[i].stateId !== 0;
          const landB = cells[other].stateId !== 0;
          if (landA !== landB) coastEdges.push([a, b]);
        }
      }
    }
  }
  for (const [a, b] of coastEdges) {
    drawJitteredLine(ctx, a, b, 0.35);
  }

  // ── 6. Dashed sepia state borders ──
  ctx.save();
  ctx.strokeStyle = rgbaToCss(INK_SOFT, 0.7);
  ctx.lineWidth = 0.9 / scale;
  ctx.setLineDash([2.2 / scale, 1.6 / scale]);
  {
    const owner = new Map<string, number>();
    for (let i = 0; i < cells.length; i++) {
      const poly = polygons[i];
      if (!poly) continue;
      for (let v = 0; v < poly.length; v++) {
        const a = poly[v];
        const b = poly[(v + 1) % poly.length];
        const key = edgeKey(a, b);
        const other = owner.get(key);
        if (other === undefined) owner.set(key, i);
        else {
          const sA = cells[i].stateId;
          const sB = cells[other].stateId;
          if (sA !== sB && sA !== 0 && sB !== 0) {
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
            ctx.stroke();
          }
        }
      }
    }
  }
  ctx.restore();

  // ── 7. Terrain glyphs: mountains, forests, hills, grass ──
  drawTerrainGlyphs(ctx, cells, polygons, scale);

  // ── 8. Final paper grain overlay for cohesion ──
  drawPaperGrain(ctx, mapWidth, mapHeight);

  return canvas.toDataURL('image/png');
}

// ─────────────────────────────────────────────────────────────
// Parchment background (cream + noise + vignette + stains)
// ─────────────────────────────────────────────────────────────
function drawParchmentBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Base cream
  const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
  grad.addColorStop(0, rgbToCss(PARCHMENT_LIGHT));
  grad.addColorStop(0.7, rgbToCss(PARCHMENT_BASE));
  grad.addColorStop(1, rgbToCss(PARCHMENT_DARK));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Aged stains
  const rng = mulberry32(91337);
  const stainCount = Math.round((w * h) / 8000);
  for (let i = 0; i < stainCount; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = 8 + rng() * 28;
    const stain = ctx.createRadialGradient(x, y, 0, x, y, r);
    const alpha = 0.04 + rng() * 0.06;
    stain.addColorStop(0, rgbaToCss(INK_SOFT, alpha));
    stain.addColorStop(1, rgbaToCss(INK_SOFT, 0));
    ctx.fillStyle = stain;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vignette
  const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.5, w / 2, h / 2, Math.max(w, h) * 0.85);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(60, 40, 20, 0.35)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}

function drawPaperGrain(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const rng = mulberry32(424242);
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = rgbToCss(INK);
  const dots = Math.round((w * h) / 6);
  for (let i = 0; i < dots; i++) {
    ctx.fillRect(rng() * w, rng() * h, 0.5, 0.5);
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
// Coastal depth-line shading (concentric dotted offsets)
// ─────────────────────────────────────────────────────────────
function drawCoastalDepthLines(
  ctx: CanvasRenderingContext2D,
  cells: RenderCell[],
  polygons: (Vertex[] | null)[],
  edgeKey: (a: Vertex, b: Vertex) => string,
  _w: number,
  _h: number,
) {
  const owner = new Map<string, number>();
  const coast: Array<[Vertex, Vertex]> = [];
  for (let i = 0; i < cells.length; i++) {
    const poly = polygons[i];
    if (!poly) continue;
    for (let v = 0; v < poly.length; v++) {
      const a = poly[v];
      const b = poly[(v + 1) % poly.length];
      const key = edgeKey(a, b);
      const other = owner.get(key);
      if (other === undefined) owner.set(key, i);
      else {
        const landA = cells[i].stateId !== 0;
        const landB = cells[other].stateId !== 0;
        if (landA !== landB) {
          // Order so 'a→b' has water on the LEFT of the segment
          const oceanIdx = landA ? other : i;
          const landIdx = landA ? i : other;
          // We just need a directional segment with water side known
          coast.push(orientCoastEdge(a, b, polygons[oceanIdx]!, polygons[landIdx]!));
        }
      }
    }
  }

  ctx.save();
  ctx.strokeStyle = rgbaToCss(INK_SOFT, 0.35);
  ctx.lineWidth = 0.4;
  for (let ring = 1; ring <= 3; ring++) {
    const offset = ring * 1.2;
    ctx.globalAlpha = 0.35 - ring * 0.08;
    for (const [a, b] of coast) {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      // perpendicular pointing into ocean (left of a→b)
      const nx = -dy / len;
      const ny = dx / len;
      const ax = a[0] + nx * offset;
      const ay = a[1] + ny * offset;
      const bx = b[0] + nx * offset;
      const by = b[1] + ny * offset;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function orientCoastEdge(a: Vertex, b: Vertex, oceanPoly: Vertex[], _landPoly: Vertex[]): [Vertex, Vertex] {
  // Compute centroid of ocean poly; ensure left-perp of a→b points toward it.
  let cx = 0, cy = 0;
  for (const v of oceanPoly) { cx += v[0]; cy += v[1]; }
  cx /= oceanPoly.length; cy /= oceanPoly.length;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const nx = -dy, ny = dx; // left perp
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dot = (cx - mx) * nx + (cy - my) * ny;
  if (dot < 0) return [b, a];
  return [a, b];
}

// ─────────────────────────────────────────────────────────────
// Jittered hand-drawn line
// ─────────────────────────────────────────────────────────────
function drawJitteredLine(ctx: CanvasRenderingContext2D, a: Vertex, b: Vertex, amount: number) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const segs = Math.max(2, Math.ceil(len / 1.5));
  const nx = -dy / (len || 1);
  const ny = dx / (len || 1);
  const seed = Math.floor((a[0] + b[0]) * 91 + (a[1] + b[1]) * 17);
  const rng = mulberry32(seed);
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const j = (rng() - 0.5) * amount;
    ctx.lineTo(a[0] + dx * t + nx * j, a[1] + dy * t + ny * j);
  }
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

// ─────────────────────────────────────────────────────────────
// Terrain glyphs (mountains / pines / hills / grass tufts)
// ─────────────────────────────────────────────────────────────
function drawTerrainGlyphs(
  ctx: CanvasRenderingContext2D,
  cells: RenderCell[],
  polygons: (Vertex[] | null)[],
  _scale: number,
) {
  for (let i = 0; i < cells.length; i++) {
    const poly = polygons[i];
    if (!poly) continue;
    const cell = cells[i];
    if (cell.stateId === 0) continue;

    const cx = polyCentroidX(poly);
    const cy = polyCentroidY(poly);
    const rng = mulberry32(i * 2654435761);

    if (cell.height >= 60) {
      // Mountains
      const count = 1 + Math.floor(rng() * 2);
      for (let k = 0; k < count; k++) {
        const x = cx + (rng() - 0.5) * 3.5;
        const y = cy + (rng() - 0.5) * 3.5;
        drawMountain(ctx, x, y, 1.2 + rng() * 0.8);
      }
    } else if (cell.height >= 45) {
      // Hills
      const x = cx + (rng() - 0.5) * 2.5;
      const y = cy + (rng() - 0.5) * 2.5;
      drawHill(ctx, x, y, 0.9 + rng() * 0.5);
    } else if (cell.height >= 28) {
      // Forests
      const count = 2 + Math.floor(rng() * 3);
      for (let k = 0; k < count; k++) {
        const x = cx + (rng() - 0.5) * 4;
        const y = cy + (rng() - 0.5) * 4;
        drawPine(ctx, x, y, 0.55 + rng() * 0.35);
      }
    } else if (cell.height >= 22) {
      // Grass tufts (sparse)
      if (rng() < 0.5) {
        const x = cx + (rng() - 0.5) * 3;
        const y = cy + (rng() - 0.5) * 3;
        drawGrassTuft(ctx, x, y);
      }
    }
  }
}

function drawMountain(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const w = 3.4 * s;
  const h = 3 * s;
  // Shaded face
  ctx.fillStyle = rgbaToCss(MOUNTAIN_INK, 0.55);
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  // Lit face
  ctx.fillStyle = rgbaToCss(PARCHMENT_LIGHT, 0.55);
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x - w / 2, y);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  // Outline
  ctx.strokeStyle = rgbaToCss(INK, 0.85);
  ctx.lineWidth = 0.25;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x, y - h);
  ctx.lineTo(x + w / 2, y);
  ctx.stroke();
  // Snow cap
  ctx.strokeStyle = rgbaToCss(PARCHMENT_LIGHT, 0.9);
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.18, y - h * 0.55);
  ctx.lineTo(x, y - h);
  ctx.lineTo(x + w * 0.18, y - h * 0.55);
  ctx.stroke();
}

function drawHill(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.strokeStyle = rgbaToCss(INK, 0.7);
  ctx.lineWidth = 0.25;
  ctx.beginPath();
  ctx.arc(x, y, 1.4 * s, Math.PI, 0, false);
  ctx.stroke();
}

function drawPine(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // tiny triangle pine
  ctx.fillStyle = rgbaToCss(FOREST_INK, 0.85);
  ctx.beginPath();
  ctx.moveTo(x, y - 1.6 * s);
  ctx.lineTo(x + 0.9 * s, y + 0.4 * s);
  ctx.lineTo(x - 0.9 * s, y + 0.4 * s);
  ctx.closePath();
  ctx.fill();
  // trunk
  ctx.fillStyle = rgbaToCss(INK, 0.8);
  ctx.fillRect(x - 0.12 * s, y + 0.4 * s, 0.24 * s, 0.4 * s);
}

function drawGrassTuft(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = rgbaToCss(FOREST_INK, 0.55);
  ctx.lineWidth = 0.18;
  ctx.beginPath();
  ctx.moveTo(x - 0.6, y);
  ctx.lineTo(x - 0.5, y - 0.7);
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 0.9);
  ctx.moveTo(x + 0.6, y);
  ctx.lineTo(x + 0.5, y - 0.7);
  ctx.stroke();
}

function polyCentroidX(poly: Vertex[]): number {
  let s = 0;
  for (const v of poly) s += v[0];
  return s / poly.length;
}
function polyCentroidY(poly: Vertex[]): number {
  let s = 0;
  for (const v of poly) s += v[1];
  return s / poly.length;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function getRenderScale(mapWidth = 384, mapHeight = 697) {
  // Browsers cap canvas around 16384px per side; stay under to ensure render.
  const MAX_DIM = 16384;
  const desired = 42;
  const maxByWidth = Math.floor(MAX_DIM / mapWidth);
  const maxByHeight = Math.floor(MAX_DIM / mapHeight);
  return Math.max(12, Math.min(desired, maxByWidth, maxByHeight));
}

function resolvePolygon(indices: number[] = [], vertices: number[][]): Vertex[] | null {
  const polygon: Vertex[] = [];
  for (const index of indices) {
    const vertex = vertices[index];
    if (!vertex || vertex.length < 2) continue;
    polygon.push([vertex[0], vertex[1]]);
  }
  return polygon.length >= 3 ? polygon : null;
}

function tracePolygon(ctx: CanvasRenderingContext2D, polygon: Vertex[]) {
  ctx.beginPath();
  ctx.moveTo(polygon[0][0], polygon[0][1]);
  for (let index = 1; index < polygon.length; index += 1) {
    ctx.lineTo(polygon[index][0], polygon[index][1]);
  }
  ctx.closePath();
}

function normalize(value: number, min: number, max: number) {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  const a = Math.max(0, Math.min(1, amount));
  return {
    r: clamp(from.r + (to.r - from.r) * a),
    g: clamp(from.g + (to.g - from.g) * a),
    b: clamp(from.b + (to.b - from.b) * a),
  };
}

function rgbToCss(rgb: Rgb) {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function rgbaToCss(rgb: Rgb, alpha: number) {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function hexToRgb(hex: string): Rgb {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return PARCHMENT_BASE;
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

// Deterministic PRNG (Mulberry32)
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
