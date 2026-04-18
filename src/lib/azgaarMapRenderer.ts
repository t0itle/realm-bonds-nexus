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
const RIVER_INK: Rgb = { r: 70, g: 110, b: 150 };
const FOREST_INK: Rgb = { r: 64, g: 86, b: 52 };
const TAIGA_INK: Rgb = { r: 50, g: 72, b: 44 };
const TROPIC_INK: Rgb = { r: 78, g: 120, b: 56 };
const MOUNTAIN_INK: Rgb = { r: 70, g: 56, b: 44 };
const SWAMP_INK: Rgb = { r: 70, g: 92, b: 64 };

// Biome IDs (mirrors Azgaar)
const BIOME = {
  MARINE: 0,
  HOT_DESERT: 1,
  COLD_DESERT: 2,
  SAVANNA: 3,
  GRASSLAND: 4,
  TROPICAL_FOREST: 5,
  TEMPERATE_FOREST: 6,
  TROPICAL_RAINFOREST: 7,
  TEMPERATE_RAINFOREST: 8,
  TAIGA: 9,
  TUNDRA: 10,
  GLACIER: 11,
  WETLAND: 12,
} as const;

// Biome → faint paper-wash tint applied to land cells
const BIOME_TINT: Record<number, Rgb> = {
  [BIOME.HOT_DESERT]: { r: 240, g: 215, b: 140 },
  [BIOME.COLD_DESERT]: { r: 200, g: 195, b: 150 },
  [BIOME.SAVANNA]: { r: 220, g: 200, b: 130 },
  [BIOME.GRASSLAND]: { r: 195, g: 210, b: 140 },
  [BIOME.TROPICAL_FOREST]: { r: 150, g: 185, b: 95 },
  [BIOME.TEMPERATE_FOREST]: { r: 130, g: 170, b: 100 },
  [BIOME.TROPICAL_RAINFOREST]: { r: 110, g: 170, b: 80 },
  [BIOME.TEMPERATE_RAINFOREST]: { r: 100, g: 150, b: 90 },
  [BIOME.TAIGA]: { r: 95, g: 120, b: 80 },
  [BIOME.TUNDRA]: { r: 175, g: 165, b: 135 },
  [BIOME.GLACIER]: { r: 225, g: 232, b: 235 },
  [BIOME.WETLAND]: { r: 110, g: 140, b: 110 },
};

/**
 * Derive biome per cell from height + latitude.
 * y=0 is north (cold), y=mapHeight is south (warm).
 * Approximates Azgaar's biome assignment without temperature/moisture data.
 */
function deriveBiome(height: number, y: number, mapHeight: number, rngVal: number): number {
  if (height < 20) return BIOME.MARINE;

  // Latitude band: 0=arctic, 0.5=temperate, 1=equator
  // Map y in [0, mapHeight] → latitudeFactor (warm in middle band)
  const lat = y / mapHeight; // 0 (north) → 1 (south)
  const arctic = lat < 0.12 || lat > 0.92;
  const subarctic = (lat >= 0.12 && lat < 0.22) || (lat > 0.82 && lat <= 0.92);
  const temperate = (lat >= 0.22 && lat < 0.38) || (lat > 0.66 && lat <= 0.82);
  const subtropic = (lat >= 0.38 && lat < 0.46) || (lat > 0.58 && lat <= 0.66);
  const tropic = lat >= 0.46 && lat <= 0.58;

  // Glaciers on very high arctic peaks
  if (arctic && height >= 60) return BIOME.GLACIER;
  if (arctic) return BIOME.TUNDRA;
  if (subarctic) return height >= 50 ? BIOME.TUNDRA : BIOME.TAIGA;

  // Wetlands in low coastal flats (deterministic pockets)
  if (height >= 20 && height < 24 && rngVal < 0.18) return BIOME.WETLAND;

  if (temperate) {
    if (height >= 55) return BIOME.TAIGA;
    if (rngVal < 0.55) return BIOME.TEMPERATE_FOREST;
    return rngVal < 0.85 ? BIOME.GRASSLAND : BIOME.TEMPERATE_RAINFOREST;
  }

  if (subtropic) {
    if (rngVal < 0.35) return BIOME.HOT_DESERT;
    if (rngVal < 0.6) return BIOME.SAVANNA;
    return BIOME.GRASSLAND;
  }

  if (tropic) {
    if (rngVal < 0.45) return BIOME.TROPICAL_RAINFOREST;
    if (rngVal < 0.75) return BIOME.TROPICAL_FOREST;
    return BIOME.SAVANNA;
  }

  return BIOME.GRASSLAND;
}

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

  drawParchmentBackground(ctx, mapWidth, mapHeight);

  const polygons = cellVertices.map((indices) => resolvePolygon(indices, vertices));
  const stateColors = new Map<number, Rgb>(states.map((s) => [s.id, hexToRgb(s.color)]));

  // Pre-compute centroids + biomes
  const centroids: Array<{ x: number; y: number } | null> = polygons.map((p) =>
    p ? { x: polyCentroidX(p), y: polyCentroidY(p) } : null,
  );
  const biomes = new Int8Array(cells.length);
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const ctr = centroids[i];
    if (!ctr) {
      biomes[i] = BIOME.MARINE;
      continue;
    }
    const r = mulberry32(i * 2654435761)();
    biomes[i] = deriveBiome(c.height, ctr.y, mapHeight, r);
  }

  // ── Ocean fill ──
  for (let i = 0; i < cells.length; i += 1) {
    const poly = polygons[i];
    if (!poly) continue;
    const cell = cells[i];
    if (cell.stateId !== 0 && cell.height >= 20) continue;
    const depth = 1 - normalize(cell.height, 0, 20);
    tracePolygon(ctx, poly);
    ctx.fillStyle = rgbToCss(mixRgb(OCEAN_PAPER, OCEAN_PAPER_DEEP, depth));
    ctx.fill();
  }

  // ── Land fill — parchment + biome wash + faint state tint + height shading ──
  for (let i = 0; i < cells.length; i += 1) {
    const poly = polygons[i];
    if (!poly) continue;
    const cell = cells[i];
    if (cell.height < 20) continue;

    const biomeRgb = BIOME_TINT[biomes[i]] ?? PARCHMENT_BASE;
    let base = mixRgb(PARCHMENT_BASE, biomeRgb, 0.42);
    if (cell.stateId !== 0) {
      const stateRgb = stateColors.get(cell.stateId) ?? PARCHMENT_BASE;
      base = mixRgb(base, stateRgb, 0.1);
    }
    const elev = normalize(cell.height, 20, 74);
    const shaded = mixRgb(base, PARCHMENT_DARK, 0.2 - elev * 0.12);
    const lit = mixRgb(shaded, PARCHMENT_LIGHT, elev * 0.32);

    tracePolygon(ctx, poly);
    ctx.fillStyle = rgbToCss(lit);
    ctx.fill();
  }

  // Edge map shared by coast/borders/adjacency
  const edgeKey = (a: Vertex, b: Vertex) => {
    const k1 = `${a[0].toFixed(3)},${a[1].toFixed(3)}`;
    const k2 = `${b[0].toFixed(3)},${b[1].toFixed(3)}`;
    return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
  };

  // Build adjacency once (used by rivers)
  const neighbors: number[][] = Array.from({ length: cells.length }, () => []);
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
          neighbors[i].push(other);
          neighbors[other].push(i);
        }
      }
    }
  }

  drawCoastalDepthLines(ctx, cells, polygons, edgeKey);

  // Coastline jittered ink
  ctx.strokeStyle = rgbaToCss(INK, 0.85);
  ctx.lineWidth = 1.4 / scale;
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
          const landA = cells[i].height >= 20;
          const landB = cells[other].height >= 20;
          if (landA !== landB) drawJitteredLine(ctx, a, b, 0.35);
        }
      }
    }
  }

  // ── Procedural rivers (downhill walk from high inland cells to ocean) ──
  drawRivers(ctx, cells, centroids, neighbors, scale);

  // Dashed sepia state borders
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

  // Biome-aware glyphs
  drawTerrainGlyphs(ctx, cells, polygons, biomes);

  drawPaperGrain(ctx, mapWidth, mapHeight);

  return canvas.toDataURL('image/png');
}

// ─────────────────────────────────────────────────────────────
// Rivers — walk downhill via cell adjacency, draw winding ink
// ─────────────────────────────────────────────────────────────
function drawRivers(
  ctx: CanvasRenderingContext2D,
  cells: RenderCell[],
  centroids: Array<{ x: number; y: number } | null>,
  neighbors: number[][],
  scale: number,
) {
  // Pick seed cells: high-elevation land, well distributed
  const seeds: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].height < 55) continue;
    // sparse sampling — every ~25th eligible cell
    if ((i * 2654435761) % 25 !== 0) continue;
    seeds.push(i);
  }

  const visited = new Set<number>();
  const paths: Array<Array<{ x: number; y: number }>> = [];

  for (const seed of seeds) {
    if (visited.has(seed)) continue;
    let cur = seed;
    const path: Array<{ x: number; y: number }> = [];
    let steps = 0;
    while (steps++ < 200) {
      const ctr = centroids[cur];
      if (!ctr) break;
      path.push(ctr);
      visited.add(cur);
      // reached water?
      if (cells[cur].height < 20) break;
      // find lowest neighbor strictly lower
      let next = -1;
      let bestH = cells[cur].height;
      for (const n of neighbors[cur]) {
        if (cells[n].height < bestH) {
          bestH = cells[n].height;
          next = n;
        }
      }
      if (next === -1 || visited.has(next)) break;
      cur = next;
    }
    if (path.length >= 4) paths.push(path);
  }

  // Render — Catmull-Rom-ish smooth, widening downstream
  ctx.save();
  for (const path of paths) {
    const n = path.length;
    for (let i = 0; i < n - 1; i++) {
      const t = i / (n - 1);
      const width = (0.25 + t * 1.6) / scale * 2;
      ctx.strokeStyle = rgbaToCss(RIVER_INK, 0.75);
      ctx.lineWidth = width;
      const p0 = path[Math.max(0, i - 1)];
      const p1 = path[i];
      const p2 = path[i + 1];
      const p3 = path[Math.min(n - 1, i + 2)];
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      // simple bezier toward p2 with mild control points
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
// Parchment background
// ─────────────────────────────────────────────────────────────
function drawParchmentBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
  grad.addColorStop(0, rgbToCss(PARCHMENT_LIGHT));
  grad.addColorStop(0.7, rgbToCss(PARCHMENT_BASE));
  grad.addColorStop(1, rgbToCss(PARCHMENT_DARK));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

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
// Coastal depth lines
// ─────────────────────────────────────────────────────────────
function drawCoastalDepthLines(
  ctx: CanvasRenderingContext2D,
  cells: RenderCell[],
  polygons: (Vertex[] | null)[],
  edgeKey: (a: Vertex, b: Vertex) => string,
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
        const landA = cells[i].height >= 20;
        const landB = cells[other].height >= 20;
        if (landA !== landB) {
          const oceanIdx = landA ? other : i;
          const landIdx = landA ? i : other;
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
  let cx = 0, cy = 0;
  for (const v of oceanPoly) { cx += v[0]; cy += v[1]; }
  cx /= oceanPoly.length; cy /= oceanPoly.length;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const nx = -dy, ny = dx;
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dot = (cx - mx) * nx + (cy - my) * ny;
  if (dot < 0) return [b, a];
  return [a, b];
}

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
// Biome-aware terrain glyphs
// ─────────────────────────────────────────────────────────────
function drawTerrainGlyphs(
  ctx: CanvasRenderingContext2D,
  cells: RenderCell[],
  polygons: (Vertex[] | null)[],
  biomes: Int8Array,
) {
  for (let i = 0; i < cells.length; i++) {
    const poly = polygons[i];
    if (!poly) continue;
    const cell = cells[i];
    if (cell.height < 20) continue;

    const cx = polyCentroidX(poly);
    const cy = polyCentroidY(poly);
    const rng = mulberry32(i * 2654435761);
    const biome = biomes[i];

    // Mountains override biome at very high elevation
    if (cell.height >= 60) {
      const count = 1 + Math.floor(rng() * 2);
      for (let k = 0; k < count; k++) {
        const x = cx + (rng() - 0.5) * 3.5;
        const y = cy + (rng() - 0.5) * 3.5;
        drawMountain(ctx, x, y, 1.2 + rng() * 0.8, biome === BIOME.GLACIER || biome === BIOME.TUNDRA);
      }
      return; // skip further glyphs on this cell
    }

    switch (biome) {
      case BIOME.GLACIER:
        if (rng() < 0.6) drawIceShard(ctx, cx + (rng() - 0.5) * 2, cy + (rng() - 0.5) * 2);
        break;
      case BIOME.TUNDRA:
        if (rng() < 0.4) drawTundraDot(ctx, cx + (rng() - 0.5) * 3, cy + (rng() - 0.5) * 3);
        break;
      case BIOME.TAIGA: {
        const count = 2 + Math.floor(rng() * 3);
        for (let k = 0; k < count; k++) {
          drawPine(ctx, cx + (rng() - 0.5) * 4, cy + (rng() - 0.5) * 4, 0.55 + rng() * 0.35, TAIGA_INK);
        }
        break;
      }
      case BIOME.TEMPERATE_FOREST:
      case BIOME.TEMPERATE_RAINFOREST: {
        const count = 2 + Math.floor(rng() * 3);
        for (let k = 0; k < count; k++) {
          drawDeciduous(ctx, cx + (rng() - 0.5) * 4, cy + (rng() - 0.5) * 4, 0.6 + rng() * 0.3);
        }
        break;
      }
      case BIOME.TROPICAL_FOREST:
      case BIOME.TROPICAL_RAINFOREST: {
        const count = 2 + Math.floor(rng() * 3);
        for (let k = 0; k < count; k++) {
          drawPalm(ctx, cx + (rng() - 0.5) * 4, cy + (rng() - 0.5) * 4, 0.6 + rng() * 0.3);
        }
        break;
      }
      case BIOME.HOT_DESERT:
        if (rng() < 0.7) drawDune(ctx, cx + (rng() - 0.5) * 3, cy + (rng() - 0.5) * 3, 0.8 + rng() * 0.5);
        if (rng() < 0.15) drawCactus(ctx, cx + (rng() - 0.5) * 3, cy + (rng() - 0.5) * 3);
        break;
      case BIOME.COLD_DESERT:
        if (rng() < 0.5) drawDune(ctx, cx + (rng() - 0.5) * 3, cy + (rng() - 0.5) * 3, 0.7 + rng() * 0.4);
        break;
      case BIOME.SAVANNA:
        if (rng() < 0.4) drawSavannaTree(ctx, cx + (rng() - 0.5) * 3, cy + (rng() - 0.5) * 3);
        if (rng() < 0.3) drawGrassTuft(ctx, cx + (rng() - 0.5) * 3, cy + (rng() - 0.5) * 3, FOREST_INK);
        break;
      case BIOME.WETLAND:
        if (rng() < 0.7) drawSwampReeds(ctx, cx + (rng() - 0.5) * 3, cy + (rng() - 0.5) * 3);
        break;
      case BIOME.GRASSLAND:
      default:
        if (cell.height >= 45 && rng() < 0.6) {
          drawHill(ctx, cx + (rng() - 0.5) * 2.5, cy + (rng() - 0.5) * 2.5, 0.9 + rng() * 0.5);
        } else if (rng() < 0.5) {
          drawGrassTuft(ctx, cx + (rng() - 0.5) * 3, cy + (rng() - 0.5) * 3, FOREST_INK);
        }
    }
  }
}

function drawMountain(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, snowy: boolean) {
  const w = 3.4 * s;
  const h = 3 * s;
  ctx.fillStyle = rgbaToCss(MOUNTAIN_INK, 0.55);
  ctx.beginPath();
  ctx.moveTo(x, y - h); ctx.lineTo(x + w / 2, y); ctx.lineTo(x, y); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgbaToCss(PARCHMENT_LIGHT, 0.55);
  ctx.beginPath();
  ctx.moveTo(x, y - h); ctx.lineTo(x - w / 2, y); ctx.lineTo(x, y); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgbaToCss(INK, 0.85);
  ctx.lineWidth = 0.25;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y); ctx.lineTo(x, y - h); ctx.lineTo(x + w / 2, y);
  ctx.stroke();
  ctx.strokeStyle = rgbaToCss(snowy ? { r: 255, g: 255, b: 255 } : PARCHMENT_LIGHT, snowy ? 1 : 0.9);
  ctx.lineWidth = snowy ? 0.45 : 0.3;
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

function drawPine(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: Rgb = FOREST_INK) {
  ctx.fillStyle = rgbaToCss(color, 0.85);
  ctx.beginPath();
  ctx.moveTo(x, y - 1.6 * s);
  ctx.lineTo(x + 0.9 * s, y + 0.4 * s);
  ctx.lineTo(x - 0.9 * s, y + 0.4 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgbaToCss(INK, 0.8);
  ctx.fillRect(x - 0.12 * s, y + 0.4 * s, 0.24 * s, 0.4 * s);
}

function drawDeciduous(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // round canopy with trunk
  ctx.fillStyle = rgbaToCss(FOREST_INK, 0.85);
  ctx.beginPath();
  ctx.arc(x, y - 0.8 * s, 1.0 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgbaToCss(INK, 0.8);
  ctx.fillRect(x - 0.12 * s, y, 0.24 * s, 0.55 * s);
}

function drawPalm(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // curved trunk + frond strokes
  ctx.strokeStyle = rgbaToCss(INK, 0.85);
  ctx.lineWidth = 0.22;
  ctx.beginPath();
  ctx.moveTo(x, y + 0.4 * s);
  ctx.quadraticCurveTo(x + 0.3 * s, y - 0.5 * s, x, y - 1.3 * s);
  ctx.stroke();
  ctx.strokeStyle = rgbaToCss(TROPIC_INK, 0.9);
  ctx.lineWidth = 0.28;
  for (let k = 0; k < 5; k++) {
    const ang = -Math.PI / 2 + (k - 2) * 0.55;
    const tx = x + Math.cos(ang) * 1.1 * s;
    const ty = y - 1.3 * s + Math.sin(ang) * 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(x, y - 1.3 * s);
    ctx.quadraticCurveTo((x + tx) / 2, (y - 1.3 * s + ty) / 2 - 0.2, tx, ty);
    ctx.stroke();
  }
}

function drawSavannaTree(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // flat-topped acacia
  ctx.fillStyle = rgbaToCss(FOREST_INK, 0.8);
  ctx.beginPath();
  ctx.ellipse(x, y - 1.0, 1.4, 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgbaToCss(INK, 0.9);
  ctx.lineWidth = 0.2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 0.8);
  ctx.stroke();
}

function drawDune(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.strokeStyle = rgbaToCss(INK_SOFT, 0.55);
  ctx.lineWidth = 0.22;
  ctx.beginPath();
  ctx.moveTo(x - 1.4 * s, y);
  ctx.quadraticCurveTo(x, y - 0.7 * s, x + 1.4 * s, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 0.6 * s, y + 0.4 * s);
  ctx.quadraticCurveTo(x + 0.4 * s, y - 0.1 * s, x + 1.6 * s, y + 0.4 * s);
  ctx.stroke();
}

function drawCactus(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = rgbaToCss(TROPIC_INK, 0.85);
  ctx.fillRect(x - 0.18, y - 1.2, 0.36, 1.5);
  ctx.fillRect(x - 0.7, y - 0.6, 0.32, 0.7);
  ctx.fillRect(x + 0.4, y - 0.7, 0.32, 0.6);
}

function drawSwampReeds(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = rgbaToCss(SWAMP_INK, 0.8);
  ctx.lineWidth = 0.22;
  ctx.beginPath();
  ctx.moveTo(x - 0.8, y); ctx.lineTo(x - 0.7, y - 1.0);
  ctx.moveTo(x - 0.3, y); ctx.lineTo(x - 0.2, y - 1.2);
  ctx.moveTo(x + 0.2, y); ctx.lineTo(x + 0.3, y - 1.1);
  ctx.moveTo(x + 0.7, y); ctx.lineTo(x + 0.8, y - 0.9);
  ctx.stroke();
  // water dashes underneath
  ctx.strokeStyle = rgbaToCss(RIVER_INK, 0.55);
  ctx.lineWidth = 0.18;
  ctx.beginPath();
  ctx.moveTo(x - 1, y + 0.3); ctx.lineTo(x - 0.4, y + 0.3);
  ctx.moveTo(x + 0.2, y + 0.3); ctx.lineTo(x + 0.9, y + 0.3);
  ctx.stroke();
}

function drawIceShard(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = rgbaToCss({ r: 230, g: 240, b: 245 }, 0.95);
  ctx.beginPath();
  ctx.moveTo(x, y - 0.9);
  ctx.lineTo(x + 0.5, y);
  ctx.lineTo(x, y + 0.3);
  ctx.lineTo(x - 0.5, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgbaToCss({ r: 120, g: 150, b: 170 }, 0.7);
  ctx.lineWidth = 0.15;
  ctx.stroke();
}

function drawTundraDot(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = rgbaToCss(INK_SOFT, 0.55);
  ctx.beginPath();
  ctx.arc(x, y, 0.25, 0, Math.PI * 2);
  ctx.fill();
}

function drawGrassTuft(ctx: CanvasRenderingContext2D, x: number, y: number, color: Rgb = FOREST_INK) {
  ctx.strokeStyle = rgbaToCss(color, 0.55);
  ctx.lineWidth = 0.18;
  ctx.beginPath();
  ctx.moveTo(x - 0.6, y); ctx.lineTo(x - 0.5, y - 0.7);
  ctx.moveTo(x, y); ctx.lineTo(x, y - 0.9);
  ctx.moveTo(x + 0.6, y); ctx.lineTo(x + 0.5, y - 0.7);
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
