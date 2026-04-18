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

export type PreparedAzgaarTileData = {
  borderTileIndex: Map<string, number[]>;
  borders: Array<{ a: Vertex; b: Vertex }>;
  cells: RenderCell[];
  coastTileIndex: Map<string, number[]>;
  coastlines: Array<{ a: Vertex; b: Vertex }>;
  depthLineTileIndex: Map<string, number[]>;
  mapHeight: number;
  mapWidth: number;
  polygonTileIndex: Map<string, number[]>;
  polygons: (Vertex[] | null)[];
  tileSize: number;
};

const PARCHMENT_LIGHT: Rgb = { r: 244, g: 230, b: 196 };
const PARCHMENT_BASE: Rgb = { r: 234, g: 215, b: 170 };
const PARCHMENT_DARK: Rgb = { r: 210, g: 184, b: 134 };
const INK: Rgb = { r: 78, g: 52, b: 28 };
const INK_SOFT: Rgb = { r: 120, g: 84, b: 48 };
const OCEAN_PAPER: Rgb = { r: 198, g: 214, b: 218 };
const OCEAN_PAPER_DEEP: Rgb = { r: 168, g: 192, b: 200 };
const FOREST_INK: Rgb = { r: 64, g: 86, b: 52 };
const MOUNTAIN_INK: Rgb = { r: 70, g: 56, b: 44 };

export function prepareAzgaarTileData(
  cells: RenderCell[],
  states: RenderState[],
  vertices: number[][],
  cellVertices: number[][],
  mapWidth: number,
  mapHeight: number,
  tileSize: number,
): PreparedAzgaarTileData {
  const polygons = cellVertices.map((indices) => resolvePolygon(indices, vertices));
  const stateColors = new Map<number, Rgb>(states.map((s) => [s.id, hexToRgb(s.color)]));
  const polygonTileIndex = new Map<string, number[]>();
  const boundsByPolygon = polygons.map((polygon) => getPolygonBounds(polygon));

  boundsByPolygon.forEach((bounds, index) => {
    if (!bounds) return;
    addIndexToTileRange(polygonTileIndex, index, bounds.minX, bounds.minY, bounds.maxX, bounds.maxY, tileSize);
  });

  const owner = new Map<string, number>();
  const coastlines: Array<{ a: Vertex; b: Vertex }> = [];
  const borders: Array<{ a: Vertex; b: Vertex }> = [];
  const coastTileIndex = new Map<string, number[]>();
  const borderTileIndex = new Map<string, number[]>();
  const depthLineTileIndex = new Map<string, number[]>();

  for (let i = 0; i < cells.length; i += 1) {
    const polygon = polygons[i];
    if (!polygon) continue;

    for (let vertexIndex = 0; vertexIndex < polygon.length; vertexIndex += 1) {
      const a = polygon[vertexIndex];
      const b = polygon[(vertexIndex + 1) % polygon.length];
      const key = edgeKey(a, b);
      const other = owner.get(key);

      if (other === undefined) {
        owner.set(key, i);
        continue;
      }

      const landA = cells[i].stateId !== 0;
      const landB = cells[other].stateId !== 0;

      if (landA !== landB) {
        const coast = orientCoastEdge(a, b, polygons[landA ? other : i]!);
        const index = coastlines.push({ a: coast[0], b: coast[1] }) - 1;
        const edgeBounds = getEdgeBounds(coast[0], coast[1], 4);
        addIndexToTileRange(coastTileIndex, index, edgeBounds.minX, edgeBounds.minY, edgeBounds.maxX, edgeBounds.maxY, tileSize);
        addIndexToTileRange(depthLineTileIndex, index, edgeBounds.minX, edgeBounds.minY, edgeBounds.maxX, edgeBounds.maxY, tileSize);
      }

      const stateA = cells[i].stateId;
      const stateB = cells[other].stateId;
      if (stateA !== stateB && stateA !== 0 && stateB !== 0) {
        const index = borders.push({ a, b }) - 1;
        const edgeBounds = getEdgeBounds(a, b, 2);
        addIndexToTileRange(borderTileIndex, index, edgeBounds.minX, edgeBounds.minY, edgeBounds.maxX, edgeBounds.maxY, tileSize);
      }
    }
  }

  for (let i = 0; i < cells.length; i += 1) {
    const polygon = polygons[i];
    if (!polygon) continue;
    const stateRgb = stateColors.get(cells[i].stateId) ?? PARCHMENT_BASE;
    void stateRgb;
  }

  return {
    borderTileIndex,
    borders,
    cells,
    coastTileIndex,
    coastlines,
    depthLineTileIndex,
    mapHeight,
    mapWidth,
    polygonTileIndex,
    polygons,
    tileSize,
  };
}

export function buildDetailedAzgaarMapTile(
  prepared: PreparedAzgaarTileData,
  tileX: number,
  tileY: number,
  scale: number,
): string {
  const tileWidth = Math.min(prepared.tileSize, prepared.mapWidth - tileX);
  const tileHeight = Math.min(prepared.tileSize, prepared.mapHeight - tileY);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(tileWidth * scale));
  canvas.height = Math.max(1, Math.ceil(tileHeight * scale));

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(scale, scale);
  ctx.translate(-tileX, -tileY);
  ctx.beginPath();
  ctx.rect(tileX, tileY, tileWidth, tileHeight);
  ctx.clip();

  drawParchmentBackground(ctx, prepared.mapWidth, prepared.mapHeight);

  const tileKey = getTileKey(tileX, tileY, prepared.tileSize);
  const polygonIndexes = prepared.polygonTileIndex.get(tileKey) ?? [];
  const coastIndexes = prepared.coastTileIndex.get(tileKey) ?? [];
  const borderIndexes = prepared.borderTileIndex.get(tileKey) ?? [];

  for (const index of polygonIndexes) {
    const polygon = prepared.polygons[index];
    if (!polygon) continue;
    const cell = prepared.cells[index];
    if (cell.stateId !== 0) continue;
    const depth = 1 - normalize(cell.height, 0, 20);
    tracePolygon(ctx, polygon);
    ctx.fillStyle = rgbToCss(mixRgb(OCEAN_PAPER, OCEAN_PAPER_DEEP, depth));
    ctx.fill();
  }

  for (const index of polygonIndexes) {
    const polygon = prepared.polygons[index];
    if (!polygon) continue;
    const cell = prepared.cells[index];
    if (cell.stateId === 0) continue;

    const elev = normalize(cell.height, 20, 74);
    const base = mixRgb(PARCHMENT_BASE, PARCHMENT_DARK, 0.08 + (cell.stateId % 5) * 0.015);
    const shaded = mixRgb(base, PARCHMENT_DARK, 0.25 - elev * 0.15);
    const lit = mixRgb(shaded, PARCHMENT_LIGHT, elev * 0.35);

    tracePolygon(ctx, polygon);
    ctx.fillStyle = rgbToCss(lit);
    ctx.fill();
  }

  drawCoastalDepthLines(ctx, prepared.coastlines, coastIndexes);

  ctx.strokeStyle = rgbaToCss(INK, 0.85);
  ctx.lineWidth = 1.1 / scale;
  for (const index of coastIndexes) {
    const coast = prepared.coastlines[index];
    drawJitteredLine(ctx, coast.a, coast.b, 0.35);
  }

  ctx.save();
  ctx.strokeStyle = rgbaToCss(INK_SOFT, 0.7);
  ctx.lineWidth = 0.8 / scale;
  ctx.setLineDash([2 / scale, 1.5 / scale]);
  for (const index of borderIndexes) {
    const border = prepared.borders[index];
    ctx.beginPath();
    ctx.moveTo(border.a[0], border.a[1]);
    ctx.lineTo(border.b[0], border.b[1]);
    ctx.stroke();
  }
  ctx.restore();

  drawTerrainGlyphs(ctx, prepared.cells, prepared.polygons, polygonIndexes);
  drawTilePaperGrain(ctx, tileX, tileY, tileWidth, tileHeight);

  return canvas.toDataURL('image/png');
}

function drawParchmentBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
  grad.addColorStop(0, rgbToCss(PARCHMENT_LIGHT));
  grad.addColorStop(0.7, rgbToCss(PARCHMENT_BASE));
  grad.addColorStop(1, rgbToCss(PARCHMENT_DARK));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const rng = mulberry32(91337);
  const stainCount = Math.round((w * h) / 8000);
  for (let i = 0; i < stainCount; i += 1) {
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

function drawTilePaperGrain(ctx: CanvasRenderingContext2D, tileX: number, tileY: number, tileWidth: number, tileHeight: number) {
  const rng = mulberry32(Math.floor(tileX * 73856093 + tileY * 19349663));
  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.fillStyle = rgbToCss(INK);
  const dots = Math.round((tileWidth * tileHeight) * 1.8);
  for (let i = 0; i < dots; i += 1) {
    ctx.fillRect(tileX + rng() * tileWidth, tileY + rng() * tileHeight, 0.35, 0.35);
  }
  ctx.restore();
}

function drawCoastalDepthLines(
  ctx: CanvasRenderingContext2D,
  coastlines: Array<{ a: Vertex; b: Vertex }>,
  indexes: number[],
) {
  ctx.save();
  ctx.strokeStyle = rgbaToCss(INK_SOFT, 0.35);
  ctx.lineWidth = 0.4;
  for (let ring = 1; ring <= 3; ring += 1) {
    const offset = ring * 1.2;
    ctx.globalAlpha = 0.35 - ring * 0.08;
    for (const index of indexes) {
      const { a, b } = coastlines[index];
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
  for (let i = 1; i < segs; i += 1) {
    const t = i / segs;
    const j = (rng() - 0.5) * amount;
    ctx.lineTo(a[0] + dx * t + nx * j, a[1] + dy * t + ny * j);
  }
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

function drawTerrainGlyphs(
  ctx: CanvasRenderingContext2D,
  cells: RenderCell[],
  polygons: (Vertex[] | null)[],
  indexes: number[],
) {
  for (const index of indexes) {
    const polygon = polygons[index];
    if (!polygon) continue;
    const cell = cells[index];
    if (cell.stateId === 0) continue;

    const cx = polyCentroidX(polygon);
    const cy = polyCentroidY(polygon);
    const rng = mulberry32(index * 2654435761);

    if (cell.height >= 60) {
      const count = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < count; i += 1) {
        drawMountain(ctx, cx + (rng() - 0.5) * 3.5, cy + (rng() - 0.5) * 3.5, 1.2 + rng() * 0.8);
      }
    } else if (cell.height >= 45) {
      drawHill(ctx, cx + (rng() - 0.5) * 2.5, cy + (rng() - 0.5) * 2.5, 0.9 + rng() * 0.5);
    } else if (cell.height >= 28) {
      const count = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < count; i += 1) {
        drawPine(ctx, cx + (rng() - 0.5) * 4, cy + (rng() - 0.5) * 4, 0.55 + rng() * 0.35);
      }
    } else if (cell.height >= 22 && rng() < 0.5) {
      drawGrassTuft(ctx, cx + (rng() - 0.5) * 3, cy + (rng() - 0.5) * 3);
    }
  }
}

function drawMountain(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const w = 3.4 * s;
  const h = 3 * s;
  ctx.fillStyle = rgbaToCss(MOUNTAIN_INK, 0.55);
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgbaToCss(PARCHMENT_LIGHT, 0.55);
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x - w / 2, y);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgbaToCss(INK, 0.85);
  ctx.lineWidth = 0.25;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x, y - h);
  ctx.lineTo(x + w / 2, y);
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
  ctx.fillStyle = rgbaToCss(FOREST_INK, 0.85);
  ctx.beginPath();
  ctx.moveTo(x, y - 1.6 * s);
  ctx.lineTo(x + 0.9 * s, y + 0.4 * s);
  ctx.lineTo(x - 0.9 * s, y + 0.4 * s);
  ctx.closePath();
  ctx.fill();
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

function getPolygonBounds(polygon: Vertex[] | null) {
  if (!polygon) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of polygon) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { maxX, maxY, minX, minY };
}

function getEdgeBounds(a: Vertex, b: Vertex, padding: number) {
  return {
    maxX: Math.max(a[0], b[0]) + padding,
    maxY: Math.max(a[1], b[1]) + padding,
    minX: Math.min(a[0], b[0]) - padding,
    minY: Math.min(a[1], b[1]) - padding,
  };
}

function addIndexToTileRange(
  indexMap: Map<string, number[]>,
  index: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  tileSize: number,
) {
  const startTileX = Math.max(0, Math.floor(minX / tileSize));
  const endTileX = Math.max(startTileX, Math.floor(maxX / tileSize));
  const startTileY = Math.max(0, Math.floor(minY / tileSize));
  const endTileY = Math.max(startTileY, Math.floor(maxY / tileSize));

  for (let tileY = startTileY; tileY <= endTileY; tileY += 1) {
    for (let tileX = startTileX; tileX <= endTileX; tileX += 1) {
      const key = `${tileX}:${tileY}`;
      const bucket = indexMap.get(key);
      if (bucket) bucket.push(index);
      else indexMap.set(key, [index]);
    }
  }
}

function getTileKey(tileX: number, tileY: number, tileSize: number) {
  return `${Math.floor(tileX / tileSize)}:${Math.floor(tileY / tileSize)}`;
}

function edgeKey(a: Vertex, b: Vertex) {
  const k1 = `${a[0].toFixed(3)},${a[1].toFixed(3)}`;
  const k2 = `${b[0].toFixed(3)},${b[1].toFixed(3)}`;
  return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
}

function orientCoastEdge(a: Vertex, b: Vertex, oceanPolygon: Vertex[]): [Vertex, Vertex] {
  let cx = 0;
  let cy = 0;
  for (const vertex of oceanPolygon) {
    cx += vertex[0];
    cy += vertex[1];
  }
  cx /= oceanPolygon.length;
  cy /= oceanPolygon.length;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const nx = -dy;
  const ny = dx;
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dot = (cx - mx) * nx + (cy - my) * ny;
  return dot < 0 ? [b, a] : [a, b];
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
  for (let i = 1; i < polygon.length; i += 1) {
    ctx.lineTo(polygon[i][0], polygon[i][1]);
  }
  ctx.closePath();
}

function polyCentroidX(poly: Vertex[]) {
  let sum = 0;
  for (const vertex of poly) sum += vertex[0];
  return sum / poly.length;
}

function polyCentroidY(poly: Vertex[]) {
  let sum = 0;
  for (const vertex of poly) sum += vertex[1];
  return sum / poly.length;
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